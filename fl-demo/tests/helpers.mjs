// Shared test scaffolding.
//
// Two levels of harness:
//   loadCore()  - runs data.js / models.js / fl.js in a bare context with a
//                 real @tensorflow/tfjs. Fast, no DOM, for algorithm units.
//   loadPage()  - boots the real index.html in jsdom against the dev server,
//                 with tfjs injected and only the storage layer stubbed. Used
//                 for anything that touches the UI.
//
// The page harness deliberately fails a test on any window error or unhandled
// rejection: a ReferenceError from a deleted function should break the suite,
// not just print to a console nobody reads.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import http from "node:http";
import { fileURLToPath } from "node:url";

export const DEMO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ORIGIN = process.env.FL_DEMO_ORIGIN || "http://localhost:8934";

// Loads the demo's core scripts and returns their top-level bindings.
//
// vm.runInThisContext puts a top-level `const` in the script's own lexical
// scope, not on globalThis, so the symbols have to be handed back explicitly
// by evaluating the sources inside a function that returns them. Memoized
// because re-evaluating would also redeclare those consts.
const CORE_EXPORTS = [
  "FEATURE_NAMES", "NUM_FEATURES", "DEVICE_MODELS", "COHORTS",
  "FEATURE_IS_AD_SIDE", "FEATURE_SIGN", "engagementFrom",
  "buildRoundClients", "buildCohortValidation", "buildFleetClient",
  "MODEL_PRESETS", "buildPresetModel", "makePresetModelSpec",
  "FederatedTrainer",
];

let corePromise = null;
export function loadCore() {
  if (!corePromise) {
    corePromise = (async () => {
      const mod = await import("@tensorflow/tfjs");
      const tf = mod.default ?? mod;
      globalThis.tf = tf;
      await tf.setBackend("cpu");
      await tf.ready();
      const src = ["data.js", "models.js", "fl.js"]
        .map((f) => fs.readFileSync(path.join(DEMO_DIR, f), "utf8"))
        .join("\n");
      const factory = vm.runInThisContext(
        `(function(){\n${src}\nreturn {${CORE_EXPORTS.join(",")}};\n})`,
        { filename: "fl-demo-core" }
      );
      return { tf, g: factory() };
    })();
  }
  return corePromise;
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

export async function serverUp() {
  try {
    await get(`${ORIGIN}/index.html`);
    return true;
  } catch {
    return false;
  }
}

export async function loadPage({ settleMs = 1400 } = {}) {
  const mod = await import("@tensorflow/tfjs");
  const tf = mod.default ?? mod;
  const { JSDOM } = await import("jsdom");
  globalThis.tf = tf;
  await tf.setBackend("cpu");
  await tf.ready();

  // tfjs only registers indexeddb:// in a real browser, so stub ONLY storage.
  // Everything above it (topology round-trip, registry, dropdowns) stays real.
  const store = {};
  tf.io.registerSaveRouter((url) =>
    typeof url === "string" && url.startsWith("indexeddb://")
      ? { save: async (a) => ((store[url] = a), { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } }) }
      : null
  );
  tf.io.registerLoadRouter((url) =>
    typeof url === "string" && url.startsWith("indexeddb://") ? { load: async () => store[url] } : null
  );

  // The vendor bundle is stripped from the markup and tf injected directly, so
  // no request interception is needed: every other asset loads from the dev
  // server exactly as the browser would fetch it.
  const html = (await get(`${ORIGIN}/index.html`)).replace('<script src="vendor/tf.min.js"></script>', "");

  const virtualConsole = new (await import("jsdom")).VirtualConsole();
  const consoleErrors = [];
  virtualConsole.on("jsdomError", (e) => consoleErrors.push(`jsdomError: ${e.message}`));

  const dom = new JSDOM(html, {
    url: `${ORIGIN}/`,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // Available before any inline script runs.
      window.tf = tf;
      window.fetch = (u, o) => fetch(new URL(u, `${ORIGIN}/`).toString(), o);
    },
  });

  const errors = [...consoleErrors];
  dom.window.addEventListener("error", (e) => errors.push(`${e.message}`));
  dom.window.addEventListener("unhandledrejection", (e) =>
    errors.push(`unhandled: ${(e.reason && e.reason.message) || e.reason}`)
  );

  await sleep(settleMs);

  const d = dom.window.document;
  const W = dom.window;
  return {
    dom, d, W, errors, store,
    $: (id) => d.getElementById(id),
    text: (id) => (d.getElementById(id)?.textContent || "").trim(),
    all: (sel) => [...d.querySelectorAll(sel)],
    click: (sel) => d.querySelector(sel)?.click(),
    mode: (m) => d.querySelector(`.mode-btn[data-mode="${m}"]`)?.click(),
    async cmd(line, ms = 500) {
      const input = d.getElementById("terminal-input");
      input.value = line;
      input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await sleep(ms);
    },
    terminalText: () => d.getElementById("terminal-body").textContent,
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
