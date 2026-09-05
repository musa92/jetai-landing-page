"""Observed market data. Every value here is published and sourced.

Kept separate from model.py so it is obvious which numbers are measured and
which are computed. The charts plot these as markers and the model as a line,
never the other way round.
"""

# 2026 CPM benchmarks by channel, USD per thousand impressions.
# (label, cpm, source_key)
CPM_BENCHMARKS = [
    ("LinkedIn",                      33.80, "eggknite"),
    ("YouTube non-skippable",         14.85, "digitalapplied"),
    ("Meta",                          13.48, "eggknite"),
    ("YouTube skippable in-stream",   11.42, "digitalapplied"),
    ("YouTube bumper",                 9.20, "digitalapplied"),
    ("Display, private marketplace",   8.20, "digitalapplied"),
    ("Programmatic open exchange",     5.85, "digitalapplied"),
    ("YouTube Shorts",                 4.85, "digitalapplied"),
    ("Google Display Network",         3.12, "digitalapplied"),
]

# The LLM turn. A range, not a point: $60 was the February 2026 launch price
# behind a $200k minimum. Self-serve opened 5 May 2026 and rates spread.
LLM_CPM_LOW, LLM_CPM_HIGH = 25.0, 60.0

# H100 on-demand rental, USD/hour, September 2026.
GPU_PRICES = [
    ("Vast.ai, cheapest verified", 1.73),
    ("RunPod SXM",                 2.69),
    ("Median of 40 providers",     3.41),
    ("AWS, low end",               3.90),
    ("AWS, high end",              6.88),
    ("Google Cloud, low end",      9.80),
    ("Google Cloud, high end",    14.19),
]
GPU_MEDIAN = 3.41

SOURCES = {
    "eggknite":       "eggknite.com paid-media benchmarks 2026",
    "digitalapplied": "digitalapplied.com display benchmarks 2026",
    "gpu":            "getdeploying.com, 40-provider median, Sep 2026",
    "llm":            "OpenAI ChatGPT ads, Feb-Sep 2026 reporting",
}
