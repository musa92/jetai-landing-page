"""Shared constants — mirrors data.js so both implementations describe the
same synthetic world: same feature names, same cohorts, same device
population figures (internally consistent: regions sum to the total, and
the behavior-segment split sums to the same total independently)."""

from dataclasses import dataclass

FEATURE_NAMES = [
    "queryPoiRelevance", "distanceScore", "categoryAffinity", "dwellTimeHistory",
    "priorImpressions", "priorTaps", "timeOfDayFit", "localPopularity",
    "sessionRecency", "routeAlignment", "adFatigue", "budgetPacing",
    "deviceEngagementScore", "searchIntentStrength",
]
NUM_FEATURES = len(FEATURE_NAMES)

# A real impression is a (user, ad) PAIR, so the generative model carries two
# independent latents. Mirrors AD_SIDE_FEATURE_NAMES / FEATURE_SIGN in data.js.
AD_SIDE_FEATURE_NAMES = [
    "queryPoiRelevance", "categoryAffinity", "priorImpressions",
    "priorTaps", "adFatigue", "budgetPacing", "localPopularity",
]
FEATURE_IS_AD_SIDE = [n in AD_SIDE_FEATURE_NAMES for n in FEATURE_NAMES]
NEGATIVE_FEATURES = ["distanceScore", "adFatigue"]
FEATURE_SIGN = [-1 if n in NEGATIVE_FEATURES else 1 for n in FEATURE_NAMES]


def engagement_from(u: float, a: float) -> float:
    """Click propensity from both latents, with an interaction term. Bounded to
    [0, 1] by construction (weights sum to 1 at u = a = 1)."""
    return 0.25 * u + 0.35 * a + 0.4 * u * a

DEVICE_MODELS = [
    "iPhone 15 Pro", "iPhone 15", "iPhone 14 Pro", "iPhone 14",
    "iPhone 13", "iPhone SE (3rd gen)", "iPhone 12",
]

DEVICE_TOTAL = 1_842_600


@dataclass(frozen=True)
class Cohort:
    id: str
    label: str
    population: int
    seed: int


COHORTS = [
    Cohort("all", "All Maps users", DEVICE_TOTAL, 90010),
    Cohort("us", "United States", 812_400, 91010),
    Cohort("eu", "European Union", 610_900, 92010),
    Cohort("apac", "APAC", 419_300, 93010),
    Cohort("commute", "Frequent commuters", 693_200, 94010),
    Cohort("travel", "Travel & tourism", 1_149_400, 95010),
]

_COHORTS_BY_ID = {c.id: c for c in COHORTS}


def get_cohort(cohort_id: str) -> Cohort:
    try:
        return _COHORTS_BY_ID[cohort_id]
    except KeyError:
        valid = ", ".join(_COHORTS_BY_ID)
        raise KeyError(f"Unknown cohort '{cohort_id}' — valid ids: {valid}") from None
