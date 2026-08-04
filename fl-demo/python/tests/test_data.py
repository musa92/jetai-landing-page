from federated_ranker.config import COHORTS, DEVICE_TOTAL, get_cohort
from federated_ranker.data import build_cohort_validation, build_round_clients


def test_population_figures_are_internally_consistent():
    regions = ["us", "eu", "apac"]
    assert sum(get_cohort(r).population for r in regions) == DEVICE_TOTAL

    segments = ["commute", "travel"]
    assert sum(get_cohort(s).population for s in segments) == DEVICE_TOTAL


def test_round_sampling_is_deterministic_given_same_seed():
    cohort = get_cohort("us")
    a = build_round_clients(cohort, k=6, round_seed=42)
    b = build_round_clients(cohort, k=6, round_seed=42)
    assert [c.index for c in a] == [c.index for c in b]
    assert (a[0].xs == b[0].xs).all()


def test_round_sampling_differs_across_rounds():
    cohort = get_cohort("us")
    a = build_round_clients(cohort, k=6, round_seed=1)
    b = build_round_clients(cohort, k=6, round_seed=2)
    assert [c.index for c in a] != [c.index for c in b]


def test_client_count_matches_k():
    cohort = get_cohort("apac")
    clients = build_round_clients(cohort, k=7, round_seed=7)
    assert len(clients) == 7


def test_validation_set_is_fixed_and_independent_of_round_seed():
    cohort = get_cohort("eu")
    val_a_x, val_a_y = build_cohort_validation(cohort)
    val_b_x, val_b_y = build_cohort_validation(cohort)
    assert (val_a_x == val_b_x).all()
    assert (val_a_y == val_b_y).all()
    assert val_a_y.min() >= 0.0 and val_a_y.max() <= 1.0


def test_all_cohorts_resolve():
    for c in COHORTS:
        assert get_cohort(c.id) is c
