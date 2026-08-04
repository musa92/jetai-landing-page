// Synthetic non-IID device data, generated on demand from a virtual population
// of iPhones opted into on-device ad-ranking personalization. We never
// materialize the full population — each device's synthetic profile is a
// deterministic function of (cohort seed, device index), so any device index
// can be regenerated on demand and looks the same every time it's sampled.
// This mirrors how real cross-device federated learning works: the
// coordinator has a large pool of eligible devices and samples a fresh subset
// each round, rather than training against a fixed static roster.

const FEATURE_NAMES = [
  "queryPoiRelevance", "distanceScore", "categoryAffinity", "dwellTimeHistory",
  "priorImpressions", "priorTaps", "timeOfDayFit", "localPopularity",
  "sessionRecency", "routeAlignment", "adFatigue", "budgetPacing",
  "deviceEngagementScore", "searchIntentStrength",
];
const NUM_FEATURES = FEATURE_NAMES.length;

// A real ad impression is a (user, ad) PAIR, so the generative model has two
// independent latents rather than one. Ad-side channels describe the creative
// and advertiser; user-side channels describe the person and moment. With a
// single shared latent every feature ended up ~98% correlated with every
// other, which meant "a different ad for the same user" was not representable
// at all: any candidate you constructed was jointly impossible and the model
// saturated when scoring it.
const AD_SIDE_FEATURE_NAMES = [
  "queryPoiRelevance", "categoryAffinity", "priorImpressions",
  "priorTaps", "adFatigue", "budgetPacing", "localPopularity",
];
const FEATURE_IS_AD_SIDE = FEATURE_NAMES.map((n) => AD_SIDE_FEATURE_NAMES.includes(n));
// Not every signal is "more is better": distance and ad fatigue push the other
// way, so the correlation structure isn't uniformly positive.
const NEGATIVE_FEATURES = ["distanceScore", "adFatigue"];
const FEATURE_SIGN = FEATURE_NAMES.map((n) => (NEGATIVE_FEATURES.includes(n) ? -1 : 1));

// Click propensity from both latents, including an interaction term: a great
// ad shown to an unreceptive user still does poorly, and vice versa. Bounded
// to [0, 1] by construction (weights sum to 1 at u = a = 1).
function engagementFrom(u, a) {
  return 0.25 * u + 0.35 * a + 0.4 * u * a;
}

const DEVICE_MODELS = [
  "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 16 Pro", "iPhone 15 Pro",
  "iPhone 15", "iPhone 14 Pro", "iPhone 14", "iPhone 13",
  "iPhone SE (3rd gen)", "iPhone 12",
];

// Population figures are internally consistent, not just decorative: the
// three regions sum to the "All devices" total, and the two behavior-segment
// figures (an orthogonal split of the same total) sum to it too — same as a
// real device-analytics dashboard, where every breakdown reconciles back to
// one number.
const DEVICE_TOTAL = 1842600;

const COHORTS = [
  { id: "all", label: "All Maps users", population: DEVICE_TOTAL, seed: 90010 },
  { id: "us", label: "United States", population: 812400, seed: 91010 },
  { id: "eu", label: "European Union", population: 610900, seed: 92010 },
  { id: "apac", label: "APAC", population: 419300, seed: 93010 },
  { id: "commute", label: "Frequent commuters", population: 693200, seed: 94010 },
  { id: "travel", label: "Travel & tourism", population: 1149400, seed: 95010 },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFrom(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fleetColor(cohortSeed, fleetIndex) {
  const hue = ((cohortSeed % 360) + fleetIndex * 137.508) % 360; // golden angle spread
  return `hsl(${hue.toFixed(1)}, 68%, 54%)`;
}

function fleetIdentity(cohort, fleetIndex) {
  const rng = mulberry32(cohort.seed + fleetIndex * 7919);
  const device = DEVICE_MODELS[Math.floor(rng() * DEVICE_MODELS.length)];
  const sessions = Math.floor(40 + rng() * 2400);
  const tail = `iOS-${cohort.id.toUpperCase()}-${String(fleetIndex).padStart(5, "0")}`;
  return { tail, device, sessions };
}

function makeFleetParams(rng) {
  const params = [];
  for (let i = 0; i < NUM_FEATURES; i++) {
    params.push({
      base: 0.3 + rng() * 0.4,
      slope: 0.5 + rng() * 1.2,
      curve: 1.2 + rng() * 1.6,
      noise: 0.02 + rng() * 0.05,
    });
  }
  return params;
}

function sampleFleet(params, numSamples, rng) {
  const xs = [];
  const ys = [];
  for (let s = 0; s < numSamples; s++) {
    const u = rng(); // user intent for this impression
    const a = rng(); // quality/relevance of the ad that was shown
    const row = new Array(NUM_FEATURES);
    for (let i = 0; i < NUM_FEATURES; i++) {
      const p = params[i];
      const latent = FEATURE_IS_AD_SIDE[i] ? a : u;
      const signed = FEATURE_SIGN[i] === 1 ? latent : 1 - latent;
      row[i] = p.base + p.slope * Math.pow(signed, p.curve) + gaussianFrom(rng) * p.noise;
    }
    xs.push(row);
    ys.push(Math.min(1, Math.max(0, engagementFrom(u, a) + gaussianFrom(rng) * 0.015)));
  }
  return { xs, ys };
}

function buildFleetClient(cohort, fleetIndex, samplesPerClient) {
  const rng = mulberry32(cohort.seed + fleetIndex * 104729); // 104729 prime — decorrelates per-device streams
  const params = makeFleetParams(rng);
  const { xs, ys } = sampleFleet(params, samplesPerClient, rng);
  const identity = fleetIdentity(cohort, fleetIndex);
  return {
    index: fleetIndex,
    name: identity.tail,
    device: identity.device,
    sessions: identity.sessions,
    color: fleetColor(cohort.seed, fleetIndex),
    xs, ys, params,
    samples: samplesPerClient,
  };
}

// Deterministic-per-seed sample of K unique device indices from [0, population).
function sampleFleetIndices(cohort, k, roundSeed) {
  const rng = mulberry32(roundSeed >>> 0);
  const n = Math.min(k, cohort.population);
  const chosen = new Set();
  while (chosen.size < n) chosen.add(Math.floor(rng() * cohort.population));
  return Array.from(chosen).sort((a, b) => a - b);
}

function buildRoundClients(cohort, k, roundSeed, samplesPerClient = 220) {
  return sampleFleetIndices(cohort, k, roundSeed).map((idx) => buildFleetClient(cohort, idx, samplesPerClient));
}

// Stable, fixed validation set for a cohort — built once from a fixed deterministic
// slice of the population average profile, independent of which devices get sampled
// round to round, so the accuracy curve reflects real learning, not shifting data.
function buildCohortValidation(cohort, refSize = 40, valRows = 300) {
  const refIndices = Array.from({ length: Math.min(refSize, cohort.population) }, (_, i) => i);
  const allParams = refIndices.map((idx) => {
    const rng = mulberry32(cohort.seed + idx * 104729);
    return makeFleetParams(rng);
  });
  const avgParams = [];
  for (let i = 0; i < NUM_FEATURES; i++) {
    let base = 0, slope = 0, curve = 0, noise = 0;
    allParams.forEach((p) => { base += p[i].base; slope += p[i].slope; curve += p[i].curve; noise += p[i].noise; });
    const n = allParams.length;
    avgParams.push({ base: base / n, slope: slope / n, curve: curve / n, noise: noise / n });
  }
  const valRng = mulberry32(cohort.seed + 999999);
  return sampleFleet(avgParams, valRows, valRng);
}
