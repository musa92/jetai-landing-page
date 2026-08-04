import math

import torch

from federated_ranker.privacy import clip_and_noise, flatten_state_dict, gaussian_mechanism_epsilon, unflatten_like
from federated_ranker.models import build_model


def test_clip_bounds_norm():
    torch.manual_seed(0)
    big = torch.randn(500) * 10  # norm will be well above clip_norm
    noised, pre_clip_norm, was_clipped = clip_and_noise(big, clip_norm=1.0, noise_multiplier=0.0)
    assert was_clipped
    assert pre_clip_norm > 1.0
    # noise_multiplier=0 means no noise added, so clipped norm should be ~exactly clip_norm
    assert math.isclose(torch.norm(noised).item(), 1.0, rel_tol=1e-4)


def test_small_delta_is_not_clipped():
    small = torch.full((10,), 0.01)
    noised, pre_clip_norm, was_clipped = clip_and_noise(small, clip_norm=5.0, noise_multiplier=0.0)
    assert not was_clipped
    assert torch.equal(noised, small)


def test_noise_multiplier_zero_disables_dp_epsilon():
    assert gaussian_mechanism_epsilon(0.0) == float("inf")


def test_higher_noise_multiplier_means_lower_epsilon():
    eps_low_noise = gaussian_mechanism_epsilon(1.0)
    eps_high_noise = gaussian_mechanism_epsilon(5.0)
    assert eps_high_noise < eps_low_noise


def test_flatten_and_unflatten_roundtrip():
    model = build_model("small")
    state = model.state_dict()
    flat = flatten_state_dict(state)
    restored = unflatten_like(flat, state)
    for key in state:
        assert torch.equal(state[key], restored[key])
