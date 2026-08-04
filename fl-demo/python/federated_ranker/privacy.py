"""Differential privacy mechanics: per-client update clipping + Gaussian
noise (the DP part of DP-FedAvg), and a simplified single-mechanism epsilon
bound — same formula and same caveats as the browser demo's fl.js. Real
systems use an RDP or PLD accountant for a much tighter composed bound;
this is intentionally the back-of-envelope version, documented as such."""

import math
from collections import OrderedDict

import torch


def flatten_state_dict(state_dict: "OrderedDict[str, torch.Tensor]") -> torch.Tensor:
    return torch.cat([v.reshape(-1) for v in state_dict.values()])


def unflatten_like(flat: torch.Tensor, reference_state_dict: "OrderedDict[str, torch.Tensor]") -> dict:
    out = {}
    offset = 0
    for key, ref in reference_state_dict.items():
        n = ref.numel()
        out[key] = flat[offset : offset + n].reshape(ref.shape)
        offset += n
    return out


def clip_and_noise(delta_flat: torch.Tensor, clip_norm: float, noise_multiplier: float):
    """Clip a flattened client update to an L2 ball of radius clip_norm,
    then add Gaussian noise scaled by noise_multiplier * clip_norm (the
    Gaussian mechanism). Returns (noised_delta, pre_clip_norm, was_clipped)."""
    norm = torch.norm(delta_flat).item()
    scale = min(1.0, clip_norm / (norm + 1e-12))
    clipped = delta_flat * scale
    was_clipped = scale < 1.0

    if noise_multiplier > 0:
        sigma = noise_multiplier * clip_norm
        noised = clipped + torch.randn_like(clipped) * sigma
    else:
        noised = clipped

    return noised, norm, was_clipped


def gaussian_mechanism_epsilon(noise_multiplier: float, delta: float = 1e-5) -> float:
    """Single Gaussian-mechanism (epsilon, delta)-DP bound for sensitivity
    1 (post-clipping): eps = sqrt(2 ln(1.25/delta)) / z. Composed naively
    (additively) across rounds by the caller — a real deployment would use
    an RDP/PLD accountant for a much tighter bound."""
    if noise_multiplier <= 0:
        return float("inf")
    return math.sqrt(2 * math.log(1.25 / delta)) / noise_multiplier
