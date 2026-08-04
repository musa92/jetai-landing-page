# data/

What the simulated iPhone population actually looks like.

Everything the platform trains on is **synthetic**. This folder exists so that
claim is inspectable rather than asserted: `sample-devices.json` is verbatim
output from `data.js`, produced by the same generator the trainer samples from
at runtime.

## Nothing is stored

There is no dataset on disk. A population of **1,842,600 devices** is defined,
but no device exists until it is sampled. Each device's profile is a pure
function of `(cohort seed, device index)`:

```
buildFleetClient(cohort, index) -> mulberry32(cohort.seed + index * 104729)
```

so device #147608 regenerates identically every time it is drawn, and the other
1.8M cost nothing. This mirrors real cross-device federated learning, where the
coordinator holds a large pool of *eligible* devices and samples a fresh subset
each round rather than iterating a fixed roster.

## Two latents, not one

Each impression is a **(user, ad) pair** drawn from two independent latents:

| latent | meaning |
|---|---|
| `u` | user intent for this impression |
| `a` | quality / relevance of the ad that was shown |

```
engagement = 0.25·u + 0.35·a + 0.40·u·a   + N(0, 0.015)
```

The interaction term is the point: a great ad shown to an unreceptive user
still performs poorly, and vice versa.

This was not the original design. A single shared latent drove every feature,
which made them ~98% mutually correlated and made "a different ad for the same
user" impossible to represent — any candidate built that way was jointly
impossible, and the ranker saturated to 0% or 100% for every advertiser at
once. Splitting the latents dropped mean pairwise correlation to ~0.50 and is
what makes the ad auction meaningful. There is a regression test for it in
`tests/units.test.mjs`.

## Feature layout

14 channels, split by which side of the auction controls them:

- **ad-side (7)** — `queryPoiRelevance`, `categoryAffinity`, `priorImpressions`,
  `priorTaps`, `localPopularity`, `adFatigue`, `budgetPacing`
- **user-side (7)** — `distanceScore`, `dwellTimeHistory`, `timeOfDayFit`,
  `sessionRecency`, `routeAlignment`, `deviceEngagementScore`,
  `searchIntentStrength`

Two are deliberately **negative** (`distanceScore`, `adFatigue`): further away
and more ad-fatigued both lower engagement, so the correlation structure is not
uniformly positive.

Per device: **220 local rows**, non-IID (every device gets its own
`base`/`slope`/`curve`/`noise` per feature). Held-out validation: **300 rows**,
built from the cohort's average profile and never trained on.

## Honest limits

- Feature values are **not** normalized to `[0,1]`; they run roughly
  `[0.37, 1.73]`. Feeding a ranker uniform `[0,1]` inputs puts it ~2.7σ
  off-distribution and saturates it. That bug is documented in `app.js`.
- The generator produces one label per `(user, ad)` pair. A real ads dataset
  would have per-impression logs with position bias, delayed conversions, and
  survivorship effects that this does not model.
- Place names in `places/` are real (OpenStreetMap). The **devices and their
  behaviour are not.**
