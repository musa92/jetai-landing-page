"""Synthetic non-IID device data — same generative model as the browser
demo's data.js. Each device's profile is a deterministic function of
(cohort seed, device index), so any device index can be regenerated on
demand and looks the same every time it's sampled — nothing is
materialized for the full population. The target is a smooth function of a
latent per-sample "engagement propensity" in [0, 1]."""

import random
from dataclasses import dataclass, field
from typing import List, Tuple

import numpy as np

from .config import Cohort, DEVICE_MODELS, NUM_FEATURES, FEATURE_IS_AD_SIDE, FEATURE_SIGN, engagement_from

_FLEET_SEED_PRIME = 104729  # decorrelates per-device streams, same constant as data.js


@dataclass
class FeatureParams:
    base: float
    slope: float
    curve: float
    noise: float


def _fleet_rng(cohort: Cohort, index: int) -> random.Random:
    return random.Random(cohort.seed + index * _FLEET_SEED_PRIME)


def make_fleet_params(rng: random.Random) -> List[FeatureParams]:
    return [
        FeatureParams(
            base=0.3 + rng.random() * 0.4,
            slope=0.5 + rng.random() * 1.2,
            curve=1.2 + rng.random() * 1.6,
            noise=0.02 + rng.random() * 0.05,
        )
        for _ in range(NUM_FEATURES)
    ]


def sample_fleet(params: List[FeatureParams], n: int, rng: random.Random) -> Tuple[np.ndarray, np.ndarray]:
    xs = np.zeros((n, NUM_FEATURES), dtype=np.float32)
    ys = np.zeros((n,), dtype=np.float32)
    for s in range(n):
        u = rng.random()  # user intent for this impression
        a = rng.random()  # quality/relevance of the ad that was shown
        for i, p in enumerate(params):
            latent = a if FEATURE_IS_AD_SIDE[i] else u
            signed = latent if FEATURE_SIGN[i] == 1 else 1.0 - latent
            xs[s, i] = p.base + p.slope * (signed ** p.curve) + rng.gauss(0, 1) * p.noise
        ys[s] = min(1.0, max(0.0, engagement_from(u, a) + rng.gauss(0, 1) * 0.015))
    return xs, ys


@dataclass
class DeviceClient:
    index: int
    name: str
    device: str
    sessions: int
    xs: np.ndarray
    ys: np.ndarray
    params: List[FeatureParams] = field(repr=False, default_factory=list)


def build_fleet_client(cohort: Cohort, index: int, samples_per_client: int = 220) -> DeviceClient:
    rng = _fleet_rng(cohort, index)
    params = make_fleet_params(rng)
    xs, ys = sample_fleet(params, samples_per_client, rng)

    identity_rng = random.Random(cohort.seed + index * 7919)
    device = DEVICE_MODELS[int(identity_rng.random() * len(DEVICE_MODELS))]
    sessions = int(40 + identity_rng.random() * 2400)
    name = f"iOS-{cohort.id.upper()}-{index:05d}"

    return DeviceClient(index=index, name=name, device=device, sessions=sessions, xs=xs, ys=ys, params=params)


def sample_fleet_indices(cohort: Cohort, k: int, round_seed: int) -> List[int]:
    rng = random.Random(round_seed)
    n = min(k, cohort.population)
    chosen = set()
    while len(chosen) < n:
        chosen.add(int(rng.random() * cohort.population))
    return sorted(chosen)


def build_round_clients(cohort: Cohort, k: int, round_seed: int, samples_per_client: int = 220) -> List[DeviceClient]:
    """Fresh random subset of the cohort for one round — client sampling,
    the same as production cross-device federated learning, not a fixed
    roster trained every round."""
    indices = sample_fleet_indices(cohort, k, round_seed)
    return [build_fleet_client(cohort, idx, samples_per_client) for idx in indices]


def build_cohort_validation(cohort: Cohort, ref_size: int = 40, val_rows: int = 300) -> Tuple[np.ndarray, np.ndarray]:
    """Stable, fixed validation set for a cohort — built once from a fixed
    deterministic slice of the population-average profile, independent of
    which devices get sampled round to round, so the accuracy curve
    reflects real learning rather than shifting data."""
    ref_indices = range(min(ref_size, cohort.population))
    all_params = [make_fleet_params(_fleet_rng(cohort, idx)) for idx in ref_indices]

    avg_params = []
    n = len(all_params)
    for i in range(NUM_FEATURES):
        avg_params.append(
            FeatureParams(
                base=sum(p[i].base for p in all_params) / n,
                slope=sum(p[i].slope for p in all_params) / n,
                curve=sum(p[i].curve for p in all_params) / n,
                noise=sum(p[i].noise for p in all_params) / n,
            )
        )

    val_rng = random.Random(cohort.seed + 999_999)
    return sample_fleet(avg_params, val_rows, val_rng)
