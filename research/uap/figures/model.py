"""Cost and revenue model for UAP figures.

Every number in the figures comes from here, so the charts cannot drift from
each other or from the note's prose.

Two throughputs, derived rather than assumed, because they are bound by
different things:

  decode   memory-bandwidth bound. Weights are streamed once per forward pass
           and amortised across the batch, so tok/s scales with HBM bandwidth
           divided by model bytes, times batch.
  prefill  compute bound, about 2*P FLOPs per token, so tok/s is peak FLOPs
           times achieved MFU divided by that.

The distinction matters: prefill is the more expensive half of a turn unless
the conversation prefix is cached. The note's "$0.000093 a turn" corresponds to
an 80 percent prefix-cache hit rate. That is realistic for multi-turn chat and
is stated on every figure rather than buried.
"""

# Hardware. H100 SXM: 3.35 TB/s HBM3, ~1.98 PFLOPS dense fp8.
HBM_BW = 3.35e12
PEAK_FLOPS_FP8 = 1.979e15
PARAMS = 70e9          # 70B-class open weights
BYTES_PER_PARAM = 1    # fp8

BASE = dict(
    gpu_hr=2.00,       # H100 rental, USD/hour
    mbu=0.70,          # achieved memory-bandwidth utilisation, decode
    batch=96,
    mfu=0.40,          # achieved model-FLOPs utilisation, prefill
    out_tokens=400,
    in_tokens=1200,
    cache_hit=0.80,    # fraction of input already in KV cache
    node_share=0.65,   # serving_node 5500 bps + supply_agent 1000 bps
    utilisation=0.35,  # GPU busy fraction across a real day
    fill_rate=0.70,    # share of ad slots that actually sell
)


def decode_tok_s(mbu=BASE["mbu"], batch=BASE["batch"]):
    return HBM_BW * mbu / (PARAMS * BYTES_PER_PARAM) * batch


def prefill_tok_s(mfu=BASE["mfu"]):
    return PEAK_FLOPS_FP8 * mfu / (2 * PARAMS)


def cost_per_turn(**kw):
    """USD of GPU time for one turn, including the idle time you also pay for.

    A node serving real traffic is not busy end to end. Rent is charged by the
    hour whether or not a request is in flight, so the cost of a turn is its
    GPU-seconds divided by the utilisation you actually average. Leaving this
    out was the single largest error in the first version of this model: at 35%
    utilisation it understates cost by roughly 3x.
    """
    p = {**BASE, **kw}
    gpu_s = p["gpu_hr"] / 3600
    d = p["out_tokens"] / decode_tok_s(p["mbu"], p["batch"])
    f = p["in_tokens"] * (1 - p["cache_hit"]) / prefill_tok_s(p["mfu"])
    return (d + f) * gpu_s / p["utilisation"]


def breakeven_cpm(load, **kw):
    """CPM at which ad revenue exactly covers compute, for one ad per `load`
    turns. revenue/turn = share * CPM * fill / (1000 * load).

    Unsold slots earn nothing, so the fill rate scales revenue directly."""
    p = {**BASE, **kw}
    return cost_per_turn(**kw) * 1000 * load / (p["node_share"] * p["fill_rate"])


def coverage(cpm, load, **kw):
    """How many times over the ad revenue covers the compute."""
    p = {**BASE, **kw}
    return (p["node_share"] * cpm * p["fill_rate"] / (1000 * load)) / cost_per_turn(**kw)


# Observed market reference, in data.py. The note's own baseline uses a $2.00
# GPU hour; the measured median across 40 providers is $3.41, so both are
# carried and the charts show the difference rather than picking one.
MARKET_CPM = 60.0
GPU_MEDIAN = 3.41

# Settlement split, SPEC.md 10.1, in basis points.
SPLIT = [("Serving node", 5500), ("Exchange", 2000),
         ("Model steward", 1500), ("Supply agent", 1000)]

if __name__ == "__main__":
    c = cost_per_turn(gpu_hr=GPU_MEDIAN)
    print(f"decode  {decode_tok_s():,.0f} tok/s")
    print(f"prefill {prefill_tok_s():,.0f} tok/s")
    print(f"cost/turn ${c:.6f}  at ${GPU_MEDIAN}/hr, "
          f"{BASE['utilisation']:.0%} utilisation")
    for L in (3, 6, 10, 20):
        print(f"  L={L:2d}  break-even CPM ${breakeven_cpm(L, gpu_hr=GPU_MEDIAN):5.2f}")
