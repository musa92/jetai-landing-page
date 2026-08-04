// Offline generator for the shipped "factory" checkpoint.
//
// Runs REAL DP-FedAvg training with the same fl.js FederatedTrainer the
// browser uses, then exports the trained weights + provenance to JSON.
// Nothing here is hand-tuned or faked: the numbers written into the file are
// the ones this run actually measured.
//
// Config rationale: per-coordinate signal is clipNorm/sqrt(params) while
// per-coordinate noise after FedAvg is z*clipNorm/sqrt(k). A large cohort
// (k) buys headroom to raise z, which lowers epsilon at the same
// signal-to-noise ratio, which is exactly why production cross-device FL
// samples thousands of clients per round rather than a handful.

global.tf = require("@tensorflow/tfjs");
const fs = require("fs");
const path = require("path");
const dir = "/Users/nevermind/Developer/turbofan-intelligence-landing/fl-demo";
for (const f of ["data.js", "models.js", "fl.js"]) {
  require("vm").runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f });
}

const PRESET = "small";
const COHORT_ID = "us";
const K = 1024;
const CLIP_NORM = 0.5;
const NOISE = 2.0;
const LOCAL_EPOCHS = 2;
const ROUNDS = 20;
const LR = 0.04;
const SEED = 20260802;

(async () => {
  await tf.setBackend("cpu");
  await tf.ready();

  const cohort = COHORTS.find((c) => c.id === COHORT_ID);
  const valSet = buildCohortValidation(cohort);
  const spec = makePresetModelSpec(PRESET, NUM_FEATURES, LR);
  const params = spec.initialModel.countParams();

  console.log(`preset=${PRESET} params=${params} cohort=${COHORT_ID} k=${K} z=${NOISE} C=${CLIP_NORM} rounds=${ROUNDS}`);
  console.log(
    `per-coord signal ~${(CLIP_NORM / Math.sqrt(params)).toFixed(4)} ` +
      `noise ~${((NOISE * CLIP_NORM) / Math.sqrt(K)).toFixed(4)} ` +
      `ratio ${(((NOISE * CLIP_NORM) / Math.sqrt(K)) / (CLIP_NORM / Math.sqrt(params))).toFixed(2)}`
  );

  const trainer = new FederatedTrainer(valSet, spec, {
    clipNorm: CLIP_NORM,
    noiseMultiplier: NOISE,
    localEpochs: LOCAL_EPOCHS,
  });
  await trainer.init();

  const t0 = Date.now();
  let last = null;
  for (let r = 0; r < ROUNDS; r++) {
    last = await trainer.runRound(buildRoundClients(cohort, K, SEED + r * 104729));
    console.log(
      `r${last.round}/${ROUNDS}: mae=${last.valMae.toFixed(4)} loss=${last.valLoss.toFixed(5)} ` +
        `eps=${last.epsilonTotal.toFixed(1)} clip=${(last.clipRate * 100).toFixed(0)}% ` +
        `[${((Date.now() - t0) / 1000).toFixed(0)}s]`
    );
  }

  const weights = trainer.model.getWeights().map((w) => ({
    shape: w.shape,
    data: Array.from(w.dataSync()),
  }));

  const payload = {
    schema: 1,
    label: "Factory checkpoint",
    preset: PRESET,
    architecture: trainer.modelLabel,
    cohortId: COHORT_ID,
    cohortLabel: cohort.label,
    round: trainer.round,
    paramCount: params,
    valMae: last.valMae,
    valLoss: last.valLoss,
    epsilon: trainer.epsilonSpent,
    training: {
      devicesPerRound: K,
      clipNorm: CLIP_NORM,
      noiseMultiplier: NOISE,
      localEpochs: LOCAL_EPOCHS,
      learningRate: LR,
      seed: SEED,
    },
    mean: trainer.mean,
    std: trainer.std,
    weights,
    createdAt: new Date().toISOString(),
  };

  const outDir = path.join(dir, "pretrained");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "adrank-us.json");
  fs.writeFileSync(outPath, JSON.stringify(payload));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);

  console.log(`\nwrote ${outPath} (${kb} KB)`);
  console.log(`final: MAE ${last.valMae.toFixed(4)} · loss ${last.valLoss.toFixed(5)} · eps ${trainer.epsilonSpent.toFixed(1)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
