# How one federated round works

Everything below happens in `fl.js`, inside `FederatedTrainer.runRound()`.
Each numbered step maps to real lines in that file.

## 1. Snapshot the global model

```js
const globalWeightsSnapshot = this._cloneWeights(this.model.getWeights());
```

This is the coordinator's model, frozen for the duration of the round so that
every device starts from exactly the same point. Without the snapshot, devices
sampled later in the loop would train from weights already moved by earlier
devices, which is sequential fine-tuning, not federated averaging.

## 2. Each simulated iPhone is a genuinely separate model

```js
const clientModel = await this.cloneFactory();
clientModel.setWeights(initWeights);
```

`cloneFactory()` builds a brand new TensorFlow.js model with its own weight
tensors and its own optimizer state. This is what makes the simulation honest:
it is not one model being nudged K times, it is K independent models. The
`setWeights` call is the broadcast step, where the server distributes the
current global model to the selected devices.

## 3. Real local training on that device's own data

```js
const h = await clientModel.fit(xs, ys, {
  epochs: this.opts.localEpochs,
  batchSize: 16,
  shuffle: true,
});
```

Real backpropagation, real Adam, on that device's own 220 non-IID rows. Nothing
is approximated. Every device has its own generated `base`, `slope`, `curve`
and `noise` per feature, so no two devices are learning from the same
distribution.

## 4. Only the delta is extracted, never the data

```js
const deltaTensors = clientWeights.map((w, i) => w.sub(globalWeightsSnapshot[i]));
const flat = tf.concat(reshapedDeltas);
xs.dispose(); ys.dispose();
clientModel.dispose();
```

The update is `deltaW = w_local - w_global`, flattened into a single vector.
Then the device's rows are disposed and its local model is destroyed.

This is the privacy boundary made literal in code: `xs` and `ys` are created
inside the loop iteration and disposed inside the same iteration. They are
never appended to anything, never returned, and never reachable after the
device finishes. The only value that survives the iteration is `flat`, the
weight delta.

## 5. Clip, add noise, optionally mask, then average

```js
const scale = Math.min(1, this.opts.clipNorm / (normVal + 1e-12));
const clipped = flat.mul(scale);
const noise = tf.randomNormal(flat.shape, 0, this.opts.noiseMultiplier * this.opts.clipNorm);
const noised = clipped.add(noise);
```

Each delta is clipped to an L2 ball of radius C, which bounds how much any
single device can influence the result. Gaussian noise calibrated to that bound
is then added. This pair of operations is the Gaussian mechanism, and it is
what makes the round differentially private.

If secure aggregation is enabled, every pair of devices then adds and subtracts
a shared mask so the masks cancel in the sum while no individual update remains
readable.

```js
const avgDelta = tf.stack(maskedDeltas).mean(0);
```

That single line is federated averaging. Stack every device's noised delta and
take the mean across the device axis.

## 6. Apply the average back to the global model

```js
const updated = w.add(slice);
this.model.setWeights(newWeights);
```

The averaged delta is sliced back into the original weight shapes and added to
the global model. The coordinator now holds a model improved by every sampled
device, without having seen any device's data.

## What is real and what is simulated

Worth stating plainly, because it is the first thing a reviewer should ask.

**Real:**

- K independent models with independent weights and optimizer state
- Real backpropagation on non-IID per-device data
- Real L2 clipping and real Gaussian noise on real weight deltas
- Real averaging, real epsilon accumulation
- Real pairwise masking when secure aggregation is on, verified to cancel to
  float32 rounding error

**Simulated:**

- The `for (const client of roundClients)` loop is **sequential**. Devices train
  one after another in a single browser tab, not concurrently on separate
  hardware.
- There is no network. No transport, no partial-round timeouts, no
  latency-induced stragglers. Device dropout is therefore a modelled percentage
  rather than an emergent property.
- The devices themselves are synthetic. See `data/README.md`.

The distinction that matters: **the algorithm is real, the parallelism is
simulated.** Running the devices sequentially changes wall-clock behaviour but
does not change the mathematics. The averaged delta produced here is exactly
what real DP-FedAvg would produce given the same updates.

The same distinction applies to the `pretrain` command, where the ZeRO sharding
arithmetic is real but the shards execute serially.

## Where to look next

| File | What it holds |
|---|---|
| `fl.js` | the round loop described above |
| `data.js` | the synthetic device generator |
| `python/federated_ranker/trainer.py` | the same algorithm in PyTorch |
| `tests/units.test.mjs` | clipping, epsilon composition, tensor-leak and secure-aggregation tests |
