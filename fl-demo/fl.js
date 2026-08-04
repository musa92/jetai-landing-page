// Federated averaging with per-client gradient-update clipping + Gaussian noise
// (DP-FedAvg, McMahan et al. 2017 style). Runs real TensorFlow.js training —
// no server, no backend, everything happens in this tab. A fresh subset of
// devices is sampled from the eligible cohort each round (client sampling),
// so runRound() takes that round's client list as an argument rather than
// training against a fixed roster.

class FederatedTrainer {
  constructor(valSet, modelSpec, opts = {}) {
    this.val = valSet;
    this.numFeatures = NUM_FEATURES;
    this.opts = Object.assign(
      {
        clipNorm: 0.5,
        noiseMultiplier: 3,
        localEpochs: 2,
        learningRate: 0.05,
        deltaDp: 1e-5,
      },
      opts
    );

    this._computeNormalization();
    this.modelLabel = modelSpec.label;
    this.cloneFactory = modelSpec.cloneFactory;
    // Held as a read-only template, never disposed by this trainer — see init().
    this._templateModel = modelSpec.initialModel;
    this.model = null; // set by init(), which must be awaited before use
    this.round = 0;
    this.epsilonSpent = 0;
    this.history = [];
  }

  // Builds this.model as an independent clone of the template's weights,
  // rather than aliasing modelSpec.initialModel directly. This matters
  // because the same modelSpec is reused across every trainer built while
  // the model-architecture dropdown is untouched (e.g. each time a cohort or
  // hyperparameter slider changes) — aliasing would mean disposing one
  // trainer's model also kills every other trainer sharing that reference,
  // including ones not yet constructed.
  async init() {
    this.model = await this.cloneFactory();
    const templateWeights = this._templateModel.getWeights().map((w) => w.clone());
    this.model.setWeights(templateWeights);
    templateWeights.forEach((w) => w.dispose());
  }

  _computeNormalization() {
    const rows = this.val.xs;
    const n = rows.length, d = this.numFeatures;
    const mean = new Array(d).fill(0);
    rows.forEach((r) => r.forEach((v, i) => { mean[i] += v; }));
    for (let i = 0; i < d; i++) mean[i] /= n;
    const std = new Array(d).fill(0);
    rows.forEach((r) => r.forEach((v, i) => { std[i] += (v - mean[i]) ** 2; }));
    for (let i = 0; i < d; i++) std[i] = Math.sqrt(std[i] / n) || 1;
    this.mean = mean;
    this.std = std;
  }

  _normalize(rows) {
    return rows.map((r) => r.map((v, i) => (v - this.mean[i]) / this.std[i]));
  }

  _cloneWeights(weights) {
    return weights.map((w) => w.clone());
  }

  setOpts(next) {
    Object.assign(this.opts, next);
  }

  async runRound(roundClients) {
    const globalWeightsSnapshot = this._cloneWeights(this.model.getWeights());
    const shapes = globalWeightsSnapshot.map((w) => w.shape);
    const sizes = globalWeightsSnapshot.map((w) => w.size);

    const clientDeltasFlat = [];
    const clientStats = [];

    for (const client of roundClients) {
      const clientModel = await this.cloneFactory();
      const initWeights = this._cloneWeights(globalWeightsSnapshot);
      clientModel.setWeights(initWeights);
      initWeights.forEach((t) => t.dispose());

      const xs = tf.tensor2d(this._normalize(client.xs));
      const ys = tf.tensor2d(client.ys.map((v) => [v]));

      const h = await clientModel.fit(xs, ys, {
        epochs: this.opts.localEpochs,
        batchSize: 16,
        shuffle: true,
        verbose: 0,
      });
      const localLoss = h.history.loss[h.history.loss.length - 1];

      const clientWeights = clientModel.getWeights();
      const deltaTensors = clientWeights.map((w, i) => w.sub(globalWeightsSnapshot[i]));
      const reshapedDeltas = deltaTensors.map((t) => t.reshape([-1]));
      const flat = tf.concat(reshapedDeltas);

      clientDeltasFlat.push(flat);
      // samples is the real row count this client trained on, recorded rather
      // than assumed, so downstream throughput is a measurement not an estimate.
      clientStats.push({
        name: client.name,
        device: client.device,
        sessions: client.sessions,
        color: client.color,
        localLoss,
        samples: client.xs.length,
      });

      xs.dispose(); ys.dispose();
      deltaTensors.forEach((t) => t.dispose());
      reshapedDeltas.forEach((t) => t.dispose());
      // Adam keeps per-weight momentum/velocity tensors on the optimizer itself —
      // model.dispose() frees the model's weights but not the optimizer's state,
      // and we build a fresh optimizer per client per round, so this leaks fast.
      if (clientModel.optimizer && typeof clientModel.optimizer.dispose === "function") {
        clientModel.optimizer.dispose();
      }
      clientModel.dispose();
    }

    // Per-client clip-to-norm + Gaussian noise (Gaussian mechanism on the update vector)
    const secure = !!this.opts.secureAggregation;
    let clippedCount = 0;
    let normSum = 0;
    const noisedDeltas = clientDeltasFlat.map((flat, i) => {
      const norm = tf.norm(flat);
      const normVal = norm.dataSync()[0];
      normSum += normVal;
      const scale = Math.min(1, this.opts.clipNorm / (normVal + 1e-12));
      // Per-client norms drive the update-norm panel; clientStats was built
      // in the same roundClients order above, so index i lines up.
      //
      // Under secure aggregation these are deliberately NOT recorded: the
      // whole point of the protocol is that the coordinator can only recover
      // the sum, so any per-client statistic is information it must not have.
      // The empty panel is the honest consequence, not a missing feature.
      if (clientStats[i] && !secure) {
        clientStats[i].preClipNorm = normVal;
        clientStats[i].wasClipped = scale < 1;
      }
      if (scale < 1) clippedCount++;
      const clipped = flat.mul(scale);
      let noised;
      if (this.opts.noiseMultiplier > 0) {
        const sigma = this.opts.noiseMultiplier * this.opts.clipNorm;
        const noise = tf.randomNormal(flat.shape, 0, sigma);
        noised = clipped.add(noise);
        noise.dispose();
        clipped.dispose();
      } else {
        noised = clipped;
      }
      norm.dispose();
      flat.dispose();
      return noised;
    });
    const avgPreClipNorm = normSum / roundClients.length;
    const clipRate = clippedCount / roundClients.length;

    // Secure aggregation via pairwise additive masking (the core idea of
    // Bonawitz et al. 2017, minus the key-agreement and dropout-recovery
    // machinery). For every pair (i, j) with i < j, both parties derive the
    // same mask vector from a shared seed; i adds it and j subtracts it. Every
    // mask therefore appears exactly once with each sign, so the masks cancel
    // in the sum while each individual masked update is computationally
    // indistinguishable from noise.
    //
    // This is a genuine implementation of the cancellation property, executed
    // in one process: there is no real key exchange and no threat model in
    // which a single browser tab is actually hiding anything from itself.
    let maskedDeltas = noisedDeltas;
    let maskResidual = null;
    if (secure && noisedDeltas.length > 1) {
      const K = noisedDeltas.length;
      const shape = noisedDeltas[0].shape;
      // Scale masks well above the update magnitude so a masked vector leaks
      // nothing useful on its own.
      const maskScale = Math.max(1, this.opts.clipNorm * 10);
      const pairSeed = (a, b) => (this.round + 1) * 7919 + a * 131 + b * 17;

      maskedDeltas = noisedDeltas.map((t) => t.clone());
      for (let i = 0; i < K; i++) {
        for (let j = i + 1; j < K; j++) {
          const mask = tf.randomNormal(shape, 0, maskScale, "float32", pairSeed(i, j));
          const addedI = maskedDeltas[i].add(mask);
          maskedDeltas[i].dispose();
          maskedDeltas[i] = addedI;
          const subbedJ = maskedDeltas[j].sub(mask);
          maskedDeltas[j].dispose();
          maskedDeltas[j] = subbedJ;
          mask.dispose();
        }
      }

      // Verify the masks really cancel: the summed masked updates must match
      // the summed unmasked ones. If this ever drifts the aggregate is wrong,
      // so it is checked rather than assumed.
      // tidy() so the stacks and the sub/abs intermediates are freed: this
      // check runs every round, so leaking here would grow without bound.
      const diff = tf.tidy(() =>
        tf.stack(maskedDeltas).sum(0).sub(tf.stack(noisedDeltas).sum(0)).abs().max()
      );
      maskResidual = diff.dataSync()[0];
      diff.dispose();

      noisedDeltas.forEach((t) => t.dispose());
    }

    const stacked = tf.stack(maskedDeltas);
    const avgDelta = stacked.mean(0);
    stacked.dispose();
    maskedDeltas.forEach((t) => t.dispose());

    let offset = 0;
    const newWeights = globalWeightsSnapshot.map((w, i) => {
      const size = sizes[i];
      const rawSlice = avgDelta.slice([offset], [size]);
      const slice = rawSlice.reshape(shapes[i]);
      offset += size;
      const updated = w.add(slice);
      rawSlice.dispose();
      slice.dispose();
      return updated;
    });
    avgDelta.dispose();

    this.model.setWeights(newWeights);
    globalWeightsSnapshot.forEach((t) => t.dispose());
    newWeights.forEach((t) => t.dispose());

    // Central-side evaluation (coordinator's own held-out set, never used for training)
    const valXs = tf.tensor2d(this._normalize(this.val.xs));
    const valYs = tf.tensor2d(this.val.ys.map((v) => [v]));
    const evalResult = this.model.evaluate(valXs, valYs, { verbose: 0 });
    const valLoss = (await evalResult.data())[0];
    const predsT = this.model.predict(valXs);
    const preds = await predsT.data();
    const trueY = await valYs.data();
    let mae = 0;
    for (let i = 0; i < trueY.length; i++) mae += Math.abs(preds[i] - trueY[i]);
    mae /= trueY.length;

    // Histogram of this round's predictions over the held-out set. A healthy
    // ranker spreads across the range; a collapsed one piles into the first or
    // last bin. That failure produced an auction where every candidate scored
    // 0% (or 100%), so it is worth surfacing as a first-class signal.
    const PRED_BINS = 12;
    const predHistogram = new Array(PRED_BINS).fill(0);
    for (let i = 0; i < preds.length; i++) {
      const b = Math.min(PRED_BINS - 1, Math.max(0, Math.floor(preds[i] * PRED_BINS)));
      predHistogram[b]++;
    }
    const predMin = Math.min(...preds);
    const predMax = Math.max(...preds);
    valXs.dispose(); valYs.dispose(); evalResult.dispose(); predsT.dispose();

    // Simplified privacy accounting: single Gaussian-mechanism bound per round,
    // composed naively across rounds. Real systems use an RDP / moments accountant
    // for a much tighter bound — this is intentionally the back-of-envelope version.
    let roundEpsilon = 0;
    if (this.opts.noiseMultiplier > 0) {
      roundEpsilon = Math.sqrt(2 * Math.log(1.25 / this.opts.deltaDp)) / this.opts.noiseMultiplier;
      this.epsilonSpent += roundEpsilon;
    } else {
      roundEpsilon = Infinity;
      this.epsilonSpent = Infinity;
    }

    this.round += 1;
    const stat = {
      round: this.round,
      valLoss,
      valMae: mae,
      clientStats,
      epsilonRound: roundEpsilon,
      epsilonTotal: this.epsilonSpent,
      // The value actually in force for THIS round, so a later slider change
      // can't retroactively rewrite what past rounds are reported to have done.
      localEpochs: this.opts.localEpochs,
      avgPreClipNorm,
      clipRate,
      predHistogram,
      predMin,
      predMax,
      secureAggregation: secure,
      // Max |sum(masked) - sum(unmasked)| for the round: float32 rounding
      // only, and proof the masks cancelled.
      maskResidual,
    };
    this.history.push(stat);
    return stat;
  }

  dispose() {
    if (this.model) this.model.dispose();
  }
}
