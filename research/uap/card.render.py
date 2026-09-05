"""Render the UAP header card.

The picture argues one thing: an ad can be selected from the same inference
pass as the answer and placed beside it without touching it.

So the answer is one unbroken current spanning the full width, the ad is a
second current below it, and the space between them is empty except for a few
thin threads in the middle where the ad is drawn out. The threads carry the
claim that the two are related; the emptiness around them carries the claim
that the answer is untouched. An earlier attempt forked the whole stream, which
put a bright accent mass inside the answer band and said the opposite.

Rasterised directly rather than emitted as SVG. At the particle counts needed
for the swarm to read as texture, an SVG of that many <circle> elements locks
up the renderer, and the deliverable is a PNG regardless.
"""
import math
import random

import numpy as np
from PIL import Image

# Geometry is authored at 1500x600. OUT scales exported pixels without touching
# the flow field, so the design does not shift when the export size does.
W, H, SS, OUT = 1500, 600, 4, 2
BW, BH = W * SS, H * SS
DS = SS // OUT
OW, OH = W * OUT, H * OUT

BG = np.array([0x0b, 0x0b, 0x0c], np.float32) / 255
GREY = np.array([0xc8, 0xc8, 0xd2], np.float32) / 255      # the answer
ACCENT = np.array([0x6e, 0x8a, 0xff], np.float32) / 255    # the ad

ANS_CY, ANS_HALF = 208.0, 106.0
AD_CY, AD_HALF = 462.0, 56.0
LINK_A, LINK_B = W * 0.33, W * 0.60    # where the ad is drawn out

rnd = random.Random(23)                # fixed: the card must rebuild identically


def ans_cy(x):
    """The answer's centreline. A slow arc, not a horizontal rule: a constant
    centre plus a restoring force produces a rectangular slab that reads as a
    bar rather than a swarm."""
    return ANS_CY + 30.0 * math.sin(x * 0.0013 + 0.35)


def ans_half(x):
    return ANS_HALF * (0.86 + 0.16 * math.sin(x * 0.0011 + 0.9))


def ad_cy(x):
    return AD_CY + 16.0 * math.sin(x * 0.0014 + 2.4)


def ad_half(x):
    """The ad band narrows toward its left end so it tapers into existence.
    A constant half-height gave it a ruled bottom edge and a hard vertical cut
    where the ramp reached full, which read as a pasted-in rectangle."""
    return AD_HALF * (0.34 + 0.66 * ease((x - W * 0.30) / (W * 0.30))) \
        * (0.90 + 0.14 * math.sin(x * 0.0016 + 0.4))


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def angle(x, y, phase):
    """A sum-of-sines flow field. Every particle is traced through the same one,
    so the ad moves with the answer's grain instead of cutting across it. The
    per-particle phase offset breaks up the regular chevron moire that a shared
    field otherwise stamps across the whole band."""
    x += phase
    return (math.sin(x * 0.0038 + y * 0.0026) * 0.85
            + math.sin(x * 0.0015 - y * 0.0044) * 0.55
            + math.sin((x + y * 0.6) * 0.0022) * 0.35) * 0.30


def threads(n, bright):
    """Sparse curves from the answer's underside down into the ad band.

    Drawn analytically rather than traced through the flow field. A traced
    particle has to chase a centreline that is descending faster than its
    restoring force can follow, so it exceeds its band tolerance and dies
    early: the threads piled up inside the answer and never arrived.

    Deliberately few and dim. They only have to say the ad came from the same
    pass; the emptiness around them is doing the more important work.
    """
    out = []
    floor = ANS_CY + ANS_HALF * 0.66
    for _ in range(n):
        x0 = rnd.uniform(LINK_A - 150, LINK_A + 300)
        y0 = floor + rnd.uniform(-26, 10)
        span = rnd.uniform(190, 460)
        y1 = ad_cy(x0 + span) + rnd.uniform(-1, 1) * ad_half(x0 + span) * 0.7
        pb = rnd.uniform(0.4, 1.3)
        steps = int(span / 3.2)
        for i in range(steps):
            u = i / steps
            x = x0 + span * u
            y = y0 + (y1 - y0) * ease(u)
            y += math.sin(u * 5.4 + x0) * 5.0 * math.sin(math.pi * u)
            x += rnd.uniform(-1.1, 1.1)
            y += rnd.uniform(-1.1, 1.1)
            if not (0 < x < W and 0 < y < H):
                continue
            # dimmest at the ends: it should look drawn out of the answer and
            # absorbed into the ad, not welded to both
            taper = math.sin(math.pi * u) ** 0.6
            out.append((x, y, bright * pb * taper,
                        min(1.0, max(0.0, (y - floor) / 70.0))))
    return out


def trace(n, seed_a, seed_b, bright, size, mode, gap=0, ramp=None):
    """Trace n particles left to right, each held near a target centreline.

    mode "answer" holds the answer band, "ad" the ad band, and "link" migrates
    from the answer's underside down into the ad band across the link zone.

    Returns (x, y, weight, mix), mix being the accent share. For links that is
    keyed to how far the particle has descended, not to how far along x it is,
    so a thread is neutral while it is still part of the answer and only takes
    the ad's colour once it is clear of the band.
    """
    out = []
    floor = ANS_CY + ANS_HALF * 0.72
    # Particles seeded upstream of the frame have to survive long enough to
    # reach it. A fixed left kill-bound killed every one of them on its first
    # step, which silently capped seeding at the frame edge and left the first
    # tenth of the answer at a third of the density of the middle.
    left_bound = min(seed_a, -80.0) - 60.0
    for _ in range(n):
        x = rnd.uniform(seed_a, seed_b)
        phase = rnd.uniform(0, 4000)
        speed = rnd.uniform(5.4, 8.2)          # varied, else the dots grid up
        pb = rnd.uniform(0.35, 1.45)           # per-strand brightness, for depth
        lane = rnd.uniform(-1, 1)

        def target(px):
            if mode == "answer":
                return ans_cy(px), ans_half(px)
            if mode == "ad":
                return ad_cy(px), max(6.0, ad_half(px))
            t = ease((px - LINK_A) / (LINK_B - LINK_A))
            return (floor + (ad_cy(px) - floor) * t,
                    ANS_HALF * 0.30 * (1 - t) + AD_HALF * 0.55 * t)

        cy, half = target(x)
        y = cy + lane * half
        for step in range(rnd.randint(50, 150)):
            cy, half = target(x)
            a = angle(x, y, phase)
            x += math.cos(a) * speed
            y += math.sin(a) * 3.1 - ((y - cy) / half) * 0.19 * 3.4
            y += rnd.uniform(-0.35, 0.35)      # breaks up corduroy banding
            if x > W + 40 or x < left_bound or abs(y - cy) > half * 2.2:
                break
            if gap and step % gap == 0:
                continue
            edge = math.exp(-1.9 * (abs(y - cy) / half) ** 2)
            w = bright * pb * (0.28 + 0.72 * edge) * (0.35 + 0.65 * math.exp(-step / 82))
            if ramp:
                w *= ease((x - ramp[0]) / (ramp[1] - ramp[0]))
            mix = 1.0 if mode == "ad" else (
                min(1.0, max(0.0, (y - floor) / 60.0)) if mode == "link" else 0.0)
            out.append((x, y, w * size * size, mix))
    return out


def splat(points, key):
    """Accumulate weights. key picks the neutral or accent share, so one
    particle can contribute to both while it is still mid-descent."""
    buf = np.zeros((BH, BW), np.float32)
    if not points:
        return buf
    p = np.asarray(points, np.float32)
    xi = np.rint(p[:, 0] * SS).astype(np.int32)
    yi = np.rint(p[:, 1] * SS).astype(np.int32)
    ok = (xi >= 0) & (xi < BW) & (yi >= 0) & (yi < BH)
    share = p[:, 3] if key == "accent" else (1.0 - p[:, 3])
    np.add.at(buf, (yi[ok], xi[ok]), (p[:, 2] * share)[ok])
    return buf


def box_blur(a, r, passes=3):
    """Separable running-sum box blur. Three passes approximate a gaussian."""
    if r < 1:
        return a
    k = 2 * r + 1
    for _ in range(passes):
        for axis in (0, 1):
            a = a.swapaxes(0, axis)
            c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0))), axis=0, dtype=np.float32)
            a = ((c[k:] - c[:-k]) / k).swapaxes(0, axis)
    return a


def layer(points, key, peak):
    """Crisp dots plus a wide low-weight bloom, normalised to a target peak.

    Calibrated against the layer's own 99.7th percentile rather than a fixed
    gain: a box blur divides by its kernel width and the 4x splat spreads each
    dot over sixteen subpixels, so the absolute scale depends on radius,
    supersample and density together and a hand-picked constant is wrong every
    time one of them changes.
    """
    raw = splat(points, key)
    a = box_blur(raw, 2 * SS // 3) * 0.80 + box_blur(raw, 14 * SS // 3) * 0.20
    a = a.reshape(OH, DS, OW, DS).mean(axis=(1, 3))
    hi = np.percentile(a, 99.7)
    return a * (peak / hi) if hi > 0 else a


# The answer: seeded across the full width, since traces die after ~150 steps
# and seeding only at the left edge leaves the right side bare. Two passes at
# different weights, because one pass leaves voids where the field converges
# and a hole in the answer is exactly the wrong thing to show.
answer = (trace(1180, -900, W * 0.96, bright=0.92, size=1.06, mode="answer")
          + trace(760, -900, W * 0.98, bright=0.60, size=0.90, mode="answer"))

# The threads: sparse and dim on purpose. Enough to say the ad came from the
# same pass, not enough to crowd the space that has to stay empty.
links = threads(58, bright=0.30)

# The ad: its own current, fading in across the link zone so it reads as
# arriving rather than as having always been there.
ad = trace(560, W * 0.16 - 500, W * 0.94, bright=0.88, size=1.0, mode="ad", gap=2,
           ramp=(W * 0.28, W * 0.70))

# Brighter grains along the ad band, so its body reads as separate dots rather
# than a solid front.
grains = [(x, ad_cy(x) + rnd.uniform(-1, 1) * ad_half(x) * 0.8, 6.0 * ease((x - W * .40) / (W * .3)), 1.0)
          for x in (rnd.uniform(W * 0.42, W - 15) for _ in range(230))]

a_int = 1.0 - np.exp(-1.7 * (layer(answer, "grey", 0.66) + layer(links, "grey", 0.16)))
d_int = 1.0 - np.exp(-1.7 * (layer(ad, "accent", 0.92) + layer(links, "accent", 0.30)
                             + layer(grains, "accent", 0.50) * 0.6))

yy, xx = np.mgrid[0:OH, 0:OW].astype(np.float32)


def glow(cx, cy, r, amt):
    d = np.hypot((xx - cx * OW) / (r * OW), (yy - cy * OH) / (r * OH * (W / H)))
    return np.clip(1 - d, 0, 1) ** 2 * amt


img = (BG[None, None, :]
       + glow(0.34, 0.30, 0.72, 0.030)[..., None] * GREY
       + glow(0.76, 0.78, 0.48, 0.075)[..., None] * ACCENT
       + a_int[..., None] * GREY
       + d_int[..., None] * ACCENT)

Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save("card.png")

# The answer must be flat and unbroken across the full width. If its density
# dips where the ad is drawn out, the picture says the ad cost the answer
# something, which is the one claim it must not make.
band = a_int[:int((ANS_CY + ANS_HALF * 1.5) * OUT)]
cols = band.sum(axis=0)
tenths = [float(cols[i * OW // 10:(i + 1) * OW // 10].mean()) for i in range(10)]
print(f"  3000x1200  {len(answer)} answer, {len(links)} link, {len(ad)} ad, {len(grains)} grains")
print("  answer density per 10%: " + " ".join(f"{v / max(tenths):.2f}" for v in tenths))
print(f"  flatness {min(tenths) / max(tenths):.2f} (want > 0.75)")

# Past the link zone the two bands must be genuinely separate. They come
# closest at the right edge, and if the trough between them fills in, the
# picture stops saying the ad sits beside the answer and starts saying it sits
# in it. Measured as a vertical profile over the right third.
prof = (a_int + d_int)[:, int(OW * 0.72):].mean(axis=1)
lo, hi = int(240 * OUT), int(430 * OUT)
trough = prof[lo:hi].min()
peaks = max(prof[:lo].max(), prof[hi:].max())
print(f"  separation: trough {trough:.4f} vs peak {peaks:.4f} "
      f"= {trough / peaks:.3f} of peak (want < 0.15)")
