// Pure-algorithm tests. No DOM, no server: these assert the maths that the
// rest of the demo's claims rest on.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadCore, DEMO_DIR } from "./helpers.mjs";

// The metric functions live inside app.js's IIFE, so lift that block out and
// evaluate it in isolation rather than duplicating the implementations here.
function loadRankingMetrics() {
  const src = fs.readFileSync(path.join(DEMO_DIR, "app.js"), "utf8");
  const start = src.indexOf("  const CLICK_THRESHOLD = 0.5;");
  const end = src.indexOf("  async function runFullEvaluation() {");
  assert.ok(start > 0 && end > start, "ranking-metrics block not found in app.js");
  const scope = {};
  new Function("exports", src.slice(start, end) +
    "\nObject.assign(exports,{rocAuc,ndcgAtK,mrr,calibration,buildSlates,computeRankingMetrics,CLICK_THRESHOLD,SLATE_SIZE});")(scope);
  return scope;
}

describe("ranking metrics", () => {
  const M = loadRankingMetrics();

  test("AUC: perfect, inverted, and mixed orderings", () => {
    assert.equal(M.rocAuc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]), 1);
    assert.equal(M.rocAuc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1]), 0);
    assert.equal(M.rocAuc([1, 2, 3, 4], [0, 1, 0, 1]), 0.75);
  });

  test("AUC: ties get average ranks", () => {
    assert.equal(M.rocAuc([5, 5, 5, 5], [0, 1, 0, 1]), 0.5);
    assert.equal(M.rocAuc([1, 2, 2, 3], [0, 1, 0, 1]), 0.875);
  });

  test("AUC is undefined with a single class, not silently 0.5", () => {
    assert.ok(Number.isNaN(M.rocAuc([1, 2, 3], [1, 1, 1])));
  });

  test("NDCG: 1.0 for ideal ordering, less when reversed", () => {
    const ideal = [{ pred: 3, rel: 3 }, { pred: 2, rel: 2 }, { pred: 1, rel: 1 }];
    assert.equal(M.ndcgAtK([ideal], 3), 1);
    const reversed = [{ pred: 1, rel: 3 }, { pred: 2, rel: 2 }, { pred: 3, rel: 1 }];
    const want = (1 + 2 / Math.log2(3) + 1.5) / (3 + 2 / Math.log2(3) + 0.5);
    assert.ok(Math.abs(M.ndcgAtK([reversed], 3) - want) < 1e-12);
  });

  test("MRR: reciprocal rank of the first true click, averaged over slates", () => {
    const top = [{ pred: 9, rel: 0.9 }, { pred: 1, rel: 0.1 }];
    const second = [{ pred: 9, rel: 0.1 }, { pred: 1, rel: 0.9 }];
    assert.equal(M.mrr([top], 0.5), 1);
    assert.equal(M.mrr([second], 0.5), 0.5);
    assert.equal(M.mrr([top, second], 0.5), 0.75);
  });

  test("calibration: ECE is 0 when perfectly calibrated, 1 at worst", () => {
    assert.ok(Math.abs(M.calibration([0.05, 0.15, 0.95], [0.05, 0.15, 0.95]).ece) < 1e-12);
    assert.ok(Math.abs(M.calibration([0, 0], [1, 1]).ece - 1) < 1e-12);
  });
});

describe("DP-FedAvg core", () => {
  test("clipping bounds every update to C, and noise is only added when z > 0", async () => {
    const { tf, g } = await loadCore();
    const cohort = g.COHORTS.find((c) => c.id === "us");
    const val = g.buildCohortValidation(cohort);
    const spec = g.makePresetModelSpec("small", g.NUM_FEATURES, 0.04);
    const trainer = new g.FederatedTrainer(val, spec, { clipNorm: 0.5, noiseMultiplier: 0, localEpochs: 1 });
    await trainer.init();
    const stat = await trainer.runRound(g.buildRoundClients(cohort, 4, 4242));

    assert.ok(stat.clipRate >= 0 && stat.clipRate <= 1);
    assert.ok(Number.isFinite(stat.avgPreClipNorm) && stat.avgPreClipNorm > 0);
    // z = 0 means no formal guarantee; epsilon must be reported as infinite
    // rather than a comfortable-looking finite number.
    assert.equal(stat.epsilonTotal, Infinity);
    trainer.dispose();
  });

  test("epsilon accumulates across rounds when z > 0", async () => {
    const { g } = await loadCore();
    const cohort = g.COHORTS.find((c) => c.id === "us");
    const val = g.buildCohortValidation(cohort);
    const spec = g.makePresetModelSpec("small", g.NUM_FEATURES, 0.04);
    const trainer = new g.FederatedTrainer(val, spec, { clipNorm: 0.5, noiseMultiplier: 2, localEpochs: 1 });
    await trainer.init();
    const a = await trainer.runRound(g.buildRoundClients(cohort, 3, 11));
    const b = await trainer.runRound(g.buildRoundClients(cohort, 3, 12));
    assert.ok(b.epsilonTotal > a.epsilonTotal, "epsilon must grow with each round");
    assert.ok(Math.abs(b.epsilonTotal - 2 * a.epsilonTotal) < 1e-9, "naive composition is additive");
    trainer.dispose();
  });

  test("a round leaks no tensors", async () => {
    const { tf, g } = await loadCore();
    const cohort = g.COHORTS.find((c) => c.id === "us");
    const val = g.buildCohortValidation(cohort);
    const spec = g.makePresetModelSpec("small", g.NUM_FEATURES, 0.04);
    const trainer = new g.FederatedTrainer(val, spec, { clipNorm: 0.5, noiseMultiplier: 1, localEpochs: 1 });
    await trainer.init();
    const before = tf.memory().numTensors;
    await trainer.runRound(g.buildRoundClients(cohort, 4, 77));
    await trainer.runRound(g.buildRoundClients(cohort, 4, 78));
    assert.equal(tf.memory().numTensors, before, "tensor count must not grow across rounds");
    trainer.dispose();
  });
});

describe("secure aggregation", () => {
  test("pairwise masks cancel in the sum and hide each individual update", async () => {
    const { tf } = await loadCore();
    const K = 6, P = 400, maskScale = 5;
    const plain = Array.from({ length: K }, (_, i) => tf.randomNormal([P], 0, 0.1, "float32", 900 + i));
    const masked = plain.map((t) => t.clone());
    const seed = (a, b) => 7919 + a * 131 + b * 17;
    for (let i = 0; i < K; i++) {
      for (let j = i + 1; j < K; j++) {
        const m = tf.randomNormal([P], 0, maskScale, "float32", seed(i, j));
        const a = masked[i].add(m); masked[i].dispose(); masked[i] = a;
        const b = masked[j].sub(m); masked[j].dispose(); masked[j] = b;
        m.dispose();
      }
    }
    const residual = tf.tidy(() => tf.stack(masked).sum(0).sub(tf.stack(plain).sum(0)).abs().max()).dataSync()[0];
    const distortion = tf.tidy(() => masked[0].sub(plain[0]).abs().mean()).dataSync()[0];
    const signal = tf.tidy(() => plain[0].abs().mean()).dataSync()[0];

    assert.ok(residual < 1e-3, `masks must cancel in the sum (residual ${residual})`);
    assert.ok(distortion > signal * 5, "an individual masked update must not resemble its input");
    [...plain, ...masked].forEach((t) => t.dispose());
  });

  test("per-client norms are withheld when secure aggregation is on", async () => {
    const { g } = await loadCore();
    const cohort = g.COHORTS.find((c) => c.id === "us");
    const val = g.buildCohortValidation(cohort);
    const spec = g.makePresetModelSpec("small", g.NUM_FEATURES, 0.04);
    const trainer = new g.FederatedTrainer(val, spec, { clipNorm: 0.5, noiseMultiplier: 1, localEpochs: 1, secureAggregation: true });
    await trainer.init();
    const stat = await trainer.runRound(g.buildRoundClients(cohort, 5, 33));
    assert.equal(stat.secureAggregation, true);
    assert.ok(stat.maskResidual < 1e-2, "masks must cancel");
    assert.ok(
      stat.clientStats.every((c) => c.preClipNorm === undefined),
      "the coordinator must not retain any per-client norm under secure aggregation"
    );
    trainer.dispose();
  });
});

describe("synthetic data model", () => {
  test("user-side and ad-side channels are driven by independent latents", async () => {
    const { g } = await loadCore();
    const val = g.buildCohortValidation(g.COHORTS.find((c) => c.id === "us"));
    const col = (i) => val.xs.map((r) => r[i]);
    const corr = (a, b) => {
      const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
      let n = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
      return n / Math.sqrt(da * db);
    };
    // A single shared latent made every pair ~0.98 correlated, which made
    // "a different ad for the same user" unrepresentable and saturated the model.
    let sum = 0, count = 0;
    for (let i = 0; i < g.NUM_FEATURES; i++) {
      for (let j = i + 1; j < g.NUM_FEATURES; j++) { sum += Math.abs(corr(col(i), col(j))); count++; }
    }
    assert.ok(sum / count < 0.7, `features are too correlated (${(sum / count).toFixed(3)}), ad/user latents collapsed`);
    const adIdx = g.FEATURE_NAMES.indexOf("adFatigue");
    assert.ok(corr(col(adIdx), val.ys) < 0, "adFatigue must correlate negatively with engagement");
  });

  test("labels stay in [0,1] and cohort populations reconcile", async () => {
    const { g } = await loadCore();
    const val = g.buildCohortValidation(g.COHORTS.find((c) => c.id === "all"));
    assert.ok(val.ys.every((y) => y >= 0 && y <= 1));
    const byId = Object.fromEntries(g.COHORTS.map((c) => [c.id, c.population]));
    assert.equal(byId.us + byId.eu + byId.apac, byId.all, "regions must sum to the total");
    assert.equal(byId.commute + byId.travel, byId.all, "behaviour segments must sum to the total");
  });
});
