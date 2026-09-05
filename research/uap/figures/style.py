"""Chart styling: editorial print, not dashboard.

Dark ground with saturated blue and orange accents is the default look of every
generated chart, so this deliberately goes the other way: warm paper, near-black
ink, thin rules, and three muted pigments.

The palette was picked by searching for the LEAST saturated triad that still
clears the six checks on this surface. Maximising chroma, which is the obvious
search, returns neon (#ff2b00, #0000ff). Validated all-pairs on #F4F1EA:
chroma floor, CVD separation (worst 16.3 deutan), normal-vision floor 18.8,
contrast all >= 3:1.
"""
import matplotlib as mpl
import matplotlib.pyplot as plt

BG    = "#F4F1EA"      # warm paper
INK   = "#1A1714"
INK2  = "#57514A"
INK3  = "#8A8379"
LINE  = "#CFC8B9"
GRID  = "#E3DDD0"

OCHRE, INDIGO, TEAL = "#875208", "#1B6193", "#269C88"
SERIES = [OCHRE, INDIGO, TEAL]
NEUTRAL = "#B8B0A0"    # bars that are context, not subject

SERIF = ["Iowan Old Style", "Palatino", "Georgia", "Times New Roman", "DejaVu Serif"]
SANS  = ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"]
MONO  = ["Menlo", "DejaVu Sans Mono"]


def money(s):
    """Escape dollar signs: two in one string are read as mathtext delimiters,
    so "$25 to $60" renders as italic "25to60"."""
    return s.replace("$", r"\$")


def apply():
    mpl.rcParams.update({
        "figure.facecolor": BG, "axes.facecolor": BG, "savefig.facecolor": BG,
        "font.family": SANS, "font.size": 10.5,
        "text.color": INK, "axes.labelcolor": INK2,
        "xtick.color": INK3, "ytick.color": INK3,
        "axes.edgecolor": LINE, "axes.linewidth": 1.0,
        "xtick.major.size": 0, "ytick.major.size": 0,
        "xtick.minor.size": 0, "ytick.minor.size": 0,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 1.0,
        "axes.spines.top": False, "axes.spines.right": False,
        "legend.frameon": False, "figure.dpi": 200,
        "axes.axisbelow": True, "axes.formatter.use_mathtext": False,
    })


def frame(fig, title, subtitle, footer):
    """Title block above the axes and an assumptions line below.

    Each figure carries its own assumptions and sources, because these get
    pasted into threads and decks on their own, where a caption that lived in
    the surrounding page is gone.
    """
    fig.text(0.052, 0.955, title, fontsize=18, color=INK, va="top", family=SERIF)
    fig.text(0.052, 0.876, subtitle, fontsize=11.5, color=INK2, va="top")
    # A hairline between the title block and the plot, the way a print figure
    # separates its caption.
    fig.add_artist(plt.Line2D([0.052, 0.948], [0.845, 0.845], color=LINE, lw=1))
    fig.add_artist(plt.Line2D([0.052, 0.948], [0.163, 0.163], color=LINE, lw=1))
    fig.text(0.052, 0.135, footer, fontsize=8.8, color=INK3, va="top", linespacing=1.75)


def rbar(ax, y, width, color, height=.52, r=.28, zorder=3, x0=0.0):
    """A horizontal bar with a rounded data end."""
    from matplotlib.patches import FancyBboxPatch
    if width <= 0:
        return
    pad = height / 2 * r
    ax.add_patch(FancyBboxPatch(
        (x0 + pad, y - height / 2 + pad), max(width - 2 * pad, 1e-9), height - 2 * pad,
        boxstyle=f"round,pad={pad},rounding_size={pad}",
        linewidth=0, facecolor=color, zorder=zorder, mutation_aspect=1))


def save(fig, name):
    for ext in ("png", "svg"):
        fig.savefig(f"{name}.{ext}", facecolor=BG, edgecolor="none")
    plt.close(fig)
    print(f"  wrote {name}.png / .svg")
