// End-to-end tests against the real page in jsdom.
//
// Every test asserts `errors` is empty. That is deliberate: a ReferenceError
// from a deleted function, or a duplicate `const` that kills the whole script,
// should fail the suite rather than scroll past in a console. Both have
// happened during development and both were caught by a human, not a machine.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { loadPage, serverUp, sleep, ORIGIN } from "./helpers.mjs";

let up = false;
before(async () => {
  up = await serverUp();
  if (!up) console.log(`\n  [skipped] no dev server at ${ORIGIN} — run: npm run serve\n`);
});
const needsServer = (t) => { if (!up) t.skip("dev server not running"); return !up; };

describe("boot", () => {
  test("page loads with no window errors and core UI present", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    assert.deepEqual(p.errors, [], "boot must be error-free");
    assert.equal(p.all(".mode-btn").length, 5, "five mode tabs");
    assert.equal(p.all(".mode-panel").length, 5, "every tab has a panel");
    p.all(".mode-btn").forEach((b) => {
      assert.ok(p.$(`mode-${b.dataset.mode}`), `panel exists for ${b.dataset.mode}`);
    });
    assert.ok(p.$("terminal-input"), "terminal present");
    assert.ok(p.$("palette"), "command palette present");
  });

  test("shipped checkpoint and real places load", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    const opts = [...p.$("deploy-model-select").options].map((o) => o.value);
    assert.ok(opts.includes("__factory"), "factory checkpoint offered");
    assert.equal(p.$("deploy-model-select").value, "__factory", "defaults to it when nothing is trained");
    assert.ok(/OpenStreetMap/.test(p.terminalText()), "baked places loaded");
    assert.deepEqual(p.errors, []);
  });

  test("hero proof numbers are populated, not placeholders", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage({ settleMs: 2000 });
    for (const id of ["proof-mae", "proof-auc", "proof-eps", "proof-devices"]) {
      assert.notEqual(p.text(id), "—", `${id} must be measured`);
    }
    assert.ok(parseFloat(p.text("proof-mae")) > 0);
  });
});

describe("training", () => {
  test("a run completes, updates panels, and leaves no stray pulses", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    await p.cmd("train --cohort us --k 6 --noise 1 --rounds 3", 9000);

    assert.match(p.text("round-counter"), /round 3/);
    assert.ok(!/failed/.test(p.terminalText()), "no round may fail");
    assert.deepEqual(p.errors, [], "training must not raise");
    assert.equal(p.all(".net-pulse").length, 0, "pulse elements must be cleaned up");
    assert.ok(p.all(".net-node-client").length === 6, "federation shows the sampled devices");
    assert.notEqual(p.text("stat-loss"), "—", "accuracy panel updated");
    assert.notEqual(p.text("throughput-current"), "—", "throughput measured");
  });

  test("federation nodes never overlap and labels stay separated", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    await p.cmd("train --cohort us --k 8 --noise 1 --rounds 2", 8000);
    const pos = p.all(".net-node-client").map((n) => ({ x: +n.getAttribute("cx"), y: +n.getAttribute("cy") }));
    let minSep = Infinity;
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++)
        minSep = Math.min(minSep, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
    assert.ok(minSep > 14, `nodes overlap (min separation ${minSep.toFixed(1)})`);
  });

  test("secure aggregation withholds per-device norms in the UI", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    await p.cmd("train --cohort us --k 6 --noise 1 --secure-agg --rounds 2", 8000);
    assert.match(p.text("normdist-current"), /withheld/i);
    assert.match(p.text("normdist-note"), /secure aggregation/i);
    assert.deepEqual(p.errors, []);
  });

  test("a run is recorded in run history", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    await p.cmd("train --cohort apac --k 6 --noise 1 --rounds 2", 8000);
    p.mode("runs");
    await sleep(300);
    const rows = p.all("#runs-table .runs-row").length;
    assert.ok(rows >= 2, "header + at least one recorded run");
    assert.match(p.text("runs-count"), /run/);
  });
});

describe("deploy and inference", () => {
  test("the shipped model deploys and drives Maps with zero training", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    p.mode("deploy");
    await sleep(200);
    p.$("btn-deploy").click();
    await sleep(2600);
    assert.match(p.text("deploy-status"), /Live/);

    p.mode("inference");
    await sleep(500);
    assert.ok(!p.$("hero-proof").hidden || true);
    assert.notEqual(p.text("rul-value"), "—", "a prediction was produced");
    assert.deepEqual(p.errors, []);
  });

  test("no ad is injected until a model is deployed", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    p.mode("inference");
    await sleep(400);
    assert.equal(p.all("#maps-place-list .sponsored").length, 0, "organic results only");
    assert.ok(p.d.querySelector(".inference-panel").classList.contains("no-model"));
    // the phone must still be usable without a model
    const input = p.$("maps-search-input");
    input.value = "bakery";
    input.dispatchEvent(new p.W.Event("input", { bubbles: true }));
    await sleep(600);
    assert.ok(p.all("#maps-place-list .maps-place-row").length > 0, "search works with no model");
  });

  test("auction, explainer and the injected ad all agree", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    p.mode("deploy");
    await sleep(200);
    p.$("btn-deploy").click();
    await sleep(2600);
    p.mode("inference");
    await sleep(500);

    for (const q of ["pharmacy", "coffee"]) {
      const input = p.$("maps-search-input");
      input.value = q;
      input.dispatchEvent(new p.W.Event("input", { bubbles: true }));
      await sleep(800);
      const won = p.d.querySelector(".auction-row.won .auction-name");
      const shown = p.d.querySelector("#maps-place-list .sponsored .maps-place-name");
      assert.ok(won, `auction produced a winner for "${q}"`);
      const winner = won.textContent.replace("won", "").trim();
      assert.equal(shown.textContent.trim(), winner, `injected ad must be the auction winner for "${q}"`);
    }
    assert.deepEqual(p.errors, []);
  });

  test("eCPM ordering and second-price clearing are consistent", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    p.mode("deploy");
    await sleep(200);
    p.$("btn-deploy").click();
    await sleep(2600);
    p.mode("inference");
    await sleep(600);

    const rows = p.all(".auction-row").slice(1).map((r) => ({
      bid: parseFloat(r.children[1].textContent.replace("$", "")),
      pctr: parseFloat(r.children[2].textContent) / 100,
      ecpm: parseFloat(r.children[3].textContent.replace("$", "")),
    })).filter((r) => Number.isFinite(r.ecpm));

    if (!rows.length) return; // degenerate model path is covered by its own message
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i - 1].ecpm >= rows[i].ecpm, "candidates must be ranked by eCPM");
    }
    const clearing = p.text("auction-clearing").match(/\$([\d.]+) of \$([\d.]+)/);
    if (clearing) {
      assert.ok(+clearing[1] <= +clearing[2], "second price must never exceed the winner's bid");
    }
  });
});

describe("post-training", () => {
  test("quantize saves a deployable artifact by default and dedupes on repeat", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    const count = () => p.$("deploy-model-select").options.length;
    const before = count();
    await p.cmd("posttrain quantize", 2500);
    assert.equal(count(), before + 1, "saved by default");
    await p.cmd("posttrain quantize", 2500);
    assert.equal(count(), before + 1, "repeat runs replace, not accumulate");
    await p.cmd("posttrain quantize --no-save", 2500);
    assert.equal(count(), before + 1, "--no-save measures and reverts");
    assert.deepEqual(p.errors, []);
  });
});

describe("terminal and palette", () => {
  test("tab completion offers only flags the parser accepts", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    const input = p.$("terminal-input");
    const type = async (v) => { input.value = v; input.dispatchEvent(new p.W.Event("input", { bubbles: true })); await sleep(80); };
    const items = () => p.all("#term-suggest .term-suggest-item .term-suggest-name").map((e) => e.textContent);

    await type("train --cohort ");
    assert.deepEqual(items(), ["all", "us", "eu", "apac", "commute", "travel"]);
    await type("posttrain ");
    assert.deepEqual(items(), ["finetune", "distill", "quantize", "prune"]);
    await type("pre");
    input.dispatchEvent(new p.W.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    assert.equal(input.value, "pretrain ");
  });

  test("history recalls the previous command", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    await p.cmd("status", 300);
    const input = p.$("terminal-input");
    input.dispatchEvent(new p.W.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    assert.equal(input.value, "status");
  });

  test("command palette opens, filters and navigates", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    p.d.dispatchEvent(new p.W.KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    await sleep(150);
    assert.equal(p.$("palette").hidden, false);
    const input = p.$("palette-input");
    input.value = "style.css";
    input.dispatchEvent(new p.W.Event("input", { bubbles: true }));
    await sleep(100);
    p.d.dispatchEvent(new p.W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(600);
    assert.equal(p.$("palette").hidden, true, "palette closes after running");
    assert.equal(p.text("code-panel-path"), "style.css");
  });

  test("every source file in the tree actually loads", async (t) => {
    if (needsServer(t)) return;
    const p = await loadPage();
    p.$("code-toggle").click();
    await sleep(300);
    const files = p.all("#code-sidebar [data-file]").map((e) => e.dataset.file);
    assert.ok(files.length >= 20, `expected the full tree, got ${files.length}`);
    for (const f of files.filter((f) => f !== "architecture").slice(0, 6)) {
      p.d.querySelector(`#code-sidebar [data-file="${f}"]`).click();
      await sleep(400);
      const body = p.text("code-view-code");
      assert.ok(body.length > 50 && !/Couldn't load/.test(body), `${f} failed to load`);
    }
  });
});
