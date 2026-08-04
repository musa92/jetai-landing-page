# Privacy by default: how this maps to Apple Ads

Apple Ads is built on a stated position that personalization must not require
identifying the person. This platform is an attempt to build the machinery that
position implies, and to be explicit about where it falls short.

The claims below are Apple's publicly stated positions as of writing. Verify
current specifics against Apple's Ad Platforms privacy policy before quoting
figures in a real setting.

## The principles, and what this platform does about each

### 1. Personalization without identification

Apple's position is that ads can be relevant without a cross-site identity
graph. There is no tracking of a person across apps and websites owned by other
companies, and no sharing with data brokers.

**Here:** the ranker never receives a user identifier. It sees 14 behavioural
feature channels for one impression and returns a score. Identity is not an
input to the model, so it cannot be a factor in the ranking. Federated learning
is what makes that possible: the model improves from behaviour without the
behaviour being collected.

### 2. Crowd anonymity

Apple reports advertiser metrics only for groups large enough that no
individual can be isolated. Segments are thresholded, not merely aggregated.

**Here:** `Advertiser reporting` on the Inference tab. A bucket is released
only when at least K distinct devices fall into it, and sub-threshold buckets
are **withheld entirely** rather than rounded or noised, because below the
threshold there is no aggregate that could not single someone out.

Two details that matter more than the threshold itself:

- it counts **distinct devices**, not impressions, so twenty views from two
  phones never clear the bar
- the demo uses K = 5 so the effect is visible in a short session. Apple's real
  segment floor is far larger, on the order of thousands. **The mechanism is
  the same, the constant is not.**

### 3. Delayed reporting

Timing is an identifier. A report that arrives the instant someone taps is
correlatable with that person's session.

**Here:** every impression is held for a **randomized** interval before it
becomes eligible for aggregation. Randomized per impression, not a fixed batch
window, because a fixed window leaks timing at its edges. The demo compresses
this to 3 to 9 seconds so it is observable; production systems delay on the
order of a day.

### 4. On-device processing

Apple's preference is to keep computation on the device rather than shipping
data to a server for it.

**Here:** two mechanisms.

- **Federated learning.** Raw interaction signals never leave the device. Only
  a clipped, noised weight delta is transmitted. This is enforced in code, not
  by policy: in `fl.js` the device's rows are created and disposed inside the
  same loop iteration and are unreachable afterwards.
- **On-device personalization.** A private per-device adapter that is never
  uploaded at all. It is the only mechanism here with zero privacy cost,
  because nothing is transmitted, and it produces the largest single accuracy
  gain in the platform.

### 5. User control

Personalized ads can be turned off, and the system must remain functional
without them.

**Here:** deploy nothing and the Maps playground still works. Search, place
details and directions all function; the results are simply organic, with no
sponsored slot, because with no ranker there is genuinely nothing to score an
ad with. The absence of personalization degrades the product rather than
breaking it.

## What this platform adds beyond the stated position

Two mechanisms here go further than a privacy policy describes, because they
are properties of the system rather than commitments about it.

**Differential privacy.** Each device's update is clipped to an L2 ball of
radius C and Gaussian noise is added before transmission. This gives a
quantified bound on what any single device's participation can reveal, tracked
live as epsilon. A policy says data will not be misused; DP bounds what could
be learned even by a party that tried.

**Secure aggregation.** With pairwise masking enabled, the coordinator can only
recover the sum of updates, never an individual one. The `Update norms` panel
going dark is the proof: that panel can only exist because the server sees each
device's update separately.

## Where this falls short, stated plainly

- **The devices are synthetic.** 1.84 million simulated iPhones, generated from
  a seed. No real user data of any kind. See `data/README.md`.
- **Epsilon composes naively.** The privacy budget shown is pessimistic. A real
  RDP or PLD accountant gives a materially tighter bound on the identical run.
- **Crowd anonymity uses K = 5**, chosen for demo visibility. Real thresholds
  are orders of magnitude larger.
- **No attribution layer.** Apple's on-device attribution frameworks
  (SKAdNetwork, AdAttributionKit) solve conversion measurement without
  identifiers. This platform models ranking and reporting, not attribution.
- **Secure aggregation is single-process.** The mask cancellation is real and
  tested, but there is no key agreement and no dropout recovery, both of which
  a deployable protocol requires.

## The through-line

Every privacy mechanism here except one costs something. DP costs accuracy.
Secure aggregation costs collectives. Crowd anonymity suppresses rows outright.
Delay costs freshness.

The exception is on-device personalization, which improves accuracy at zero
privacy cost precisely because nothing is transmitted. That asymmetry is the
argument for the architecture: a shared global model plus a private local layer
is the one place where the privacy-preserving choice is also the better
engineering choice.
