"""Figures for the UAP note.

Rule for every chart here: measured values are markers, the model is a line.
An earlier version had it backwards, and a page of smooth curves computed
entirely from my own assumptions reads as a math exercise rather than a result.
"""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

import data as D
import model as M
import style as S

S.apply()
usd = FuncFormatter(lambda v, _: r"\$0" if v == 0 else
                    (rf"\${v:,.0f}" if v >= 1 else rf"\${v:.2f}"))
BE_LOW = M.breakeven_cpm(10)                       # note's $2.00/hr baseline
BE_MED = M.breakeven_cpm(10, gpu_hr=D.GPU_MEDIAN)  # measured median hour


def fig01_channels():
    """Real CPMs, every channel, against what a turn actually has to earn."""
    fig, ax = plt.subplots(figsize=(10.2, 6.4))
    fig.subplots_adjust(left=.275, right=.975, top=.775, bottom=.245)

    rows = [("LLM sponsored card", D.LLM_CPM_HIGH, D.LLM_CPM_LOW)] + \
           [(n, c, None) for n, c, _ in D.CPM_BENCHMARKS]
    y = np.arange(len(rows))[::-1]
    VAL_X, MULT_X, XMAX = 63.0, 86.0, 88.0   # columns, not bar-adjacent labels

    for i, (name, hi, lo) in enumerate(rows):
        accent = lo is not None
        if accent:
            S.rbar(ax, y[i], hi, "#2b3a72", zorder=3)
            S.rbar(ax, y[i], lo, S.OCHRE, zorder=4)
            val, mult = (rf"\${lo:,.0f} to \${hi:,.0f}",
                         f"{lo / BE_MED:.0f} to {hi / BE_MED:.0f}x")
        else:
            S.rbar(ax, y[i], hi, S.NEUTRAL, zorder=3)
            val, mult = rf"\${hi:,.2f}", f"{hi / BE_MED:.1f}x"
        c = S.INK if accent else S.INK2
        ax.annotate(val, (VAL_X, y[i]), color=c, fontsize=10.5, va="center")
        ax.annotate(mult, (MULT_X, y[i]), color=S.OCHRE if accent else S.INK3,
                    fontsize=10.5, va="center", ha="right")

    ax.axvline(BE_MED, color=S.INDIGO, lw=1.5, zorder=5)
    ax.annotate(rf"break-even  \${BE_MED:.2f}", (BE_MED, y[0] + .78),
                xytext=(6, 0), textcoords="offset points", color=S.INDIGO,
                fontsize=10.5, va="center")
    for x, lab in [(VAL_X, "CPM"), (MULT_X, "multiple")]:
        ax.annotate(lab, (x, y[0] + .78), color=S.INK3, fontsize=9.5, va="center",
                    ha="right" if lab == "multiple" else "left")

    ax.set_yticks(y, [r[0] for r in rows], fontsize=11, color=S.INK2)
    ax.get_yticklabels()[0].set_color(S.INK)
    ax.tick_params(axis="y", pad=11)
    ax.set_xlim(0, XMAX); ax.set_ylim(-.8, len(rows) - .05)
    ax.set_xticks([0, 10, 20, 30, 40, 50, 60])
    ax.xaxis.set_major_formatter(usd)
    ax.set_xlabel("CPM, USD per thousand impressions", labelpad=9)
    ax.grid(False)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_color(S.LINE)

    S.frame(fig, "A turn has to earn like search, not like display",
            "Published 2026 CPM benchmarks, against the break-even a self-hosted node needs.",
            "Break-even at one ad every ten turns, node keeping 65%, 70% fill rate, 35% average GPU "
            rf"utilisation," "\n" rf"on a 70B fp8 model at the measured median H100 price of "
            rf"\${D.GPU_MEDIAN:.2f}/hr. Idle time is charged too." "\n"
            f"Sources: {D.SOURCES['eggknite']}; {D.SOURCES['digitalapplied']};\n"
            f"{D.SOURCES['llm']}; {D.SOURCES['gpu']}.")
    S.save(fig, "01-channels")


def fig02_gpu():
    """Break-even against what GPUs actually rent for, provider by provider.

    A row chart, not a scatter. Plotted against price on x, the seven providers
    crowd into the bottom-left while the CPM band occupies the top, and the
    labels collide into one another.
    """
    fig, ax = plt.subplots(figsize=(10.2, 6.4))
    fig.subplots_adjust(left=.265, right=.975, top=.775, bottom=.245)

    rows = sorted(D.GPU_PRICES, key=lambda r: r[1])
    y = np.arange(len(rows))[::-1]
    HR_X, BE_X, XMAX = 68.0, 90.0, 92.0

    ax.add_patch(plt.Rectangle((D.LLM_CPM_LOW, -1.5), D.LLM_CPM_HIGH - D.LLM_CPM_LOW,
                               len(rows) + .1, color=S.OCHRE, alpha=.16, zorder=1))
    mid = (D.LLM_CPM_LOW + D.LLM_CPM_HIGH) / 2
    ax.annotate("what an LLM ad earns", (mid, y[0] + .20), color=S.OCHRE,
                fontsize=10.5, ha="center", va="center")
    ax.annotate(rf"\${D.LLM_CPM_LOW:,.0f} to \${D.LLM_CPM_HIGH:,.0f}",
                (mid, y[0] - .40), color=S.OCHRE, fontsize=14, ha="center", va="center")

    cheapest = min(c for _, c, _ in D.CPM_BENCHMARKS)
    ax.axvline(cheapest, color=S.TEAL, lw=1.4, ls=(0, (5, 3)), zorder=4)
    ax.annotate("cheapest ad of any kind", (cheapest, y[-1] - .95), xytext=(7, 0),
                textcoords="offset points", color=S.TEAL, fontsize=10, va="center")

    for i, (lab, hr) in enumerate(rows):
        v = M.breakeven_cpm(10, gpu_hr=hr)
        prime = "Median" in lab
        col = S.INDIGO if prime else S.NEUTRAL
        S.rbar(ax, y[i], v, col, zorder=3)
        ax.annotate(lab, (-1.5, y[i]), color=S.INK if prime else S.INK2,
                    fontsize=10.5, va="center", ha="right", annotation_clip=False)
        ax.annotate(rf"\${hr:.2f}", (HR_X, y[i]), color=S.INK2, fontsize=10.5,
                    va="center", ha="right")
        ax.annotate(rf"\${v:.2f}", (BE_X, y[i]),
                    color=S.INDIGO if prime else S.INK, fontsize=10.5,
                    va="center", ha="right")
    for x, lab in [(HR_X, "per hour"), (BE_X, "break-even")]:
        ax.annotate(lab, (x, y[0] + .95), color=S.INK3, fontsize=9.5,
                    va="center", ha="right")

    ax.set_yticks([])
    ax.set_xlim(0, XMAX); ax.set_ylim(-1.5, len(rows) + .5)
    ax.set_xticks([0, 10, 20, 30, 40, 50, 60])
    ax.xaxis.set_major_formatter(usd)
    ax.set_xlabel("CPM the turn must earn to break even", labelpad=9)
    ax.grid(False)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_color(S.LINE)

    S.frame(fig, "The GPU price decides whether any of this works",
            "What a turn has to earn, at every price an H100 actually rents for.",
            "Quoted September 2026 on-demand prices. One ad every ten turns, node keeping 65%, 70% fill, "
            "35% utilisation.\n"
            r"On hyperscaler hardware the break-even climbs into the band an LLM ad pays, so the "
            r"margin disappears." "\n"
            f"Sources: {D.SOURCES['gpu']}; {D.SOURCES['llm']}.")
    S.save(fig, "02-gpu-prices")


def fig03_montecarlo():
    """Joint uncertainty, with the GPU price drawn from the observed range."""
    rng = np.random.default_rng(7)
    n = 200_000
    lo_hr = min(h for _, h in D.GPU_PRICES)
    hi_hr = max(h for _, h in D.GPU_PRICES)
    g = rng.uniform(lo_hr, hi_hr, n)
    mbu = rng.uniform(0.45, 0.85, n)
    mfu = rng.uniform(0.25, 0.55, n)
    out = rng.uniform(200, 800, n)
    inp = rng.uniform(500, 3000, n)
    hit = rng.uniform(0.30, 0.95, n)
    share = rng.uniform(0.55, 0.80, n)
    util = rng.uniform(0.20, 0.70, n)
    fill = rng.uniform(0.50, 0.95, n)
    dec = out / (M.HBM_BW * mbu / M.PARAMS * M.BASE["batch"])
    pre = inp * (1 - hit) / (M.PEAK_FLOPS_FP8 * mfu / (2 * M.PARAMS))
    cpm = (dec + pre) * (g / 3600) / util * 1000 * 10 / (share * fill)

    fig, ax = plt.subplots(figsize=(9.8, 6.2))
    fig.subplots_adjust(left=.075, right=.955, top=.795, bottom=.235)
    ax.hist(cpm, bins=200, range=(0, 80), color=S.INDIGO, zorder=2)
    ax.axvspan(D.LLM_CPM_LOW, D.LLM_CPM_HIGH, color=S.OCHRE, alpha=.15, zorder=1)
    ax.annotate(rf"what an LLM turn earns" "\n" rf"\${D.LLM_CPM_LOW:,.0f} to \${D.LLM_CPM_HIGH:,.0f}",
                (D.LLM_CPM_LOW + .8, ax.get_ylim()[1] * .72), color=S.OCHRE,
                fontsize=11, linespacing=1.5)
    for q in (50, 95, 99):
        x = np.percentile(cpm, q)
        ax.axvline(x, color=S.INK2, lw=1.1, ls=(0, (4, 3)), zorder=3)
        ax.annotate(rf"p{q}  \${x:.2f}", (x, ax.get_ylim()[1] * .96), xytext=(5, 0),
                    textcoords="offset points", color=S.INK, fontsize=10, va="top")
    ok = (cpm <= D.LLM_CPM_LOW).mean()
    ax.annotate(f"{ok:.0%} of draws break even at \\${D.LLM_CPM_LOW:,.0f}, the bottom of what an "
                f"LLM ad pays.\n{(cpm <= D.LLM_CPM_HIGH).mean():.0%} break even at "
                f"\\${D.LLM_CPM_HIGH:,.0f}, the top.",
                (0.34, 0.50), xycoords="axes fraction", color=S.INK, fontsize=11.5,
                linespacing=1.7)
    ax.set_xlim(0, 80)
    ax.xaxis.set_major_formatter(usd)
    ax.set_xlabel("CPM required to break even, one ad every ten turns")
    ax.set_ylabel("Draws"); ax.set_yticks([])
    ax.grid(axis="y", alpha=0)

    S.frame(fig, "Where it works, and where it stops working",
            f"{n:,} joint draws over nine inputs, sampled across their real observed ranges.",
            f"GPU ${lo_hr:.2f}-{hi_hr:.2f}/hr (observed); MBU 45-85%; MFU 25-55%; output 200-800 tok; "
            "input 500-3,000 tok;\nprefix-cache hit 30-95%; node share 55-80%. Uniform priors, so this "
            f"is a coverage argument, not a forecast. Sources: {D.SOURCES['gpu']}; {D.SOURCES['llm']}.")
    S.save(fig, "03-monte-carlo")


def fig04_split():
    """Where a dollar of ad revenue goes, and what is left against compute."""
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(9.8, 6.2),
                                  gridspec_kw=dict(width_ratios=[1.3, 1]))
    fig.subplots_adjust(left=.055, right=.955, top=.795, bottom=.235, wspace=.34)

    gross = D.LLM_CPM_HIGH
    ramp = ["#B57A2E", "#9A6314", "#7A4E0A", "#5C3A06"]
    left = 0.0
    for (lab, bps), c in zip(M.SPLIT, ramp):
        ax.barh([0], [gross * bps / 10000], left=left, height=.28, color=c, zorder=2)
        left += gross * bps / 10000
    for i, ((lab, bps), c) in enumerate(zip(M.SPLIT, ramp)):
        yy = -0.60 - i * 0.28
        ax.add_patch(plt.Rectangle((0, yy - .05), gross * .026, .10, color=c,
                                   clip_on=False, zorder=3))
        ax.annotate(lab, (gross * .055, yy), color=S.INK2, fontsize=11, va="center")
        ax.annotate(rf"\${gross * bps / 10000:,.0f}", (gross * .60, yy), color=S.INK,
                    fontsize=11, va="center", ha="right")
        ax.annotate(f"{bps / 100:.0f}%", (gross * .78, yy), color=S.INK3,
                    fontsize=11, va="center", ha="right")
    ax.set_xlim(0, gross); ax.set_ylim(-1.85, .60)
    ax.set_yticks([]); ax.set_xticks([]); ax.grid(False)
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.annotate(rf"\${gross:,.0f} CPM  ·  1,000 impressions", (0, .40), color=S.INK,
                fontsize=12, va="center")

    compute = 1000 * 10 * M.cost_per_turn(gpu_hr=D.GPU_MEDIAN)
    node = gross * 0.65
    ax2.bar([0, 1], [node, compute], width=.5, color=[S.OCHRE, S.NEUTRAL], zorder=2)
    for i, v in enumerate([node, compute]):
        ax2.annotate(rf"\${v:,.2f}" if v < 10 else rf"\${v:,.0f}", (i, v), xytext=(0, 7),
                     textcoords="offset points", ha="center", color=S.INK, fontsize=12)
    ax2.set_yscale("log"); ax2.set_ylim(0.5, 200)
    ax2.set_xticks([0, 1], ["Node keeps\n55% + 10%", "Compute for\n10,000 turns"],
                   color=S.INK2, fontsize=10.5, linespacing=1.5)
    ax2.set_yticks([1, 10, 100]); ax2.yaxis.set_major_formatter(usd)
    ax2.grid(axis="x", alpha=0)
    ax2.annotate(f"{node / compute:.0f}x", (0.5, 26), ha="center", color=S.OCHRE, fontsize=21)

    S.frame(fig, "The split, and what is left after the GPUs are paid",
            "Settlement shares are fixed by the protocol and enforced by whoever holds the money.",
            "Split per SPEC.md 10.1: serving_node 5500 bps, exchange 2000, model_steward 1500, "
            "supply_agent 1000.\nA self-hosted node acting as its own supply agent keeps 6500. Compute "
            f"at the ${D.GPU_MEDIAN:.2f}/hr median hour. Sources: {D.SOURCES['gpu']}.")
    S.save(fig, "04-split")


for f in (fig01_channels, fig02_gpu, fig03_montecarlo, fig04_split):
    f()
