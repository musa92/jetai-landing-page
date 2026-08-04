"""DP-FedAvg trainer — mirrors fl.js's FederatedTrainer: per-client local
training on a fresh round-sampled subset of devices, per-update clipping
and Gaussian noise, FedAvg aggregation of the noised updates, and the same
simplified privacy accounting. Runs real PyTorch training, no server."""

import copy
from dataclasses import dataclass, field
from typing import List

import numpy as np
import torch
import torch.nn as nn

from .data import DeviceClient
from .models import build_model
from .privacy import clip_and_noise, flatten_state_dict, gaussian_mechanism_epsilon, unflatten_like


@dataclass
class ClientRoundStat:
    name: str
    device: str
    sessions: int
    local_loss: float


@dataclass
class RoundStat:
    round: int
    val_loss: float
    val_mae: float
    epsilon_round: float
    epsilon_total: float
    avg_pre_clip_norm: float
    clip_rate: float
    client_stats: List[ClientRoundStat] = field(default_factory=list)


class FederatedTrainer:
    def __init__(
        self,
        val_xs: np.ndarray,
        val_ys: np.ndarray,
        preset: str = "small",
        clip_norm: float = 0.5,
        noise_multiplier: float = 3.0,
        local_epochs: int = 2,
        learning_rate: float = 0.05,
        batch_size: int = 16,
        delta_dp: float = 1e-5,
    ):
        self.val_xs = val_xs
        self.val_ys = val_ys
        self.preset = preset
        self.clip_norm = clip_norm
        self.noise_multiplier = noise_multiplier
        self.local_epochs = local_epochs
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.delta_dp = delta_dp

        # Normalization stats computed once from the (fixed) validation set —
        # stable across rounds even though the training clients rotate.
        self.mean = val_xs.mean(axis=0)
        self.std = val_xs.std(axis=0)
        self.std[self.std == 0] = 1.0

        self.model = build_model(preset)
        self.round = 0
        self.epsilon_spent = 0.0
        self.history: List[RoundStat] = []

    def _normalize(self, xs: np.ndarray) -> torch.Tensor:
        return torch.tensor((xs - self.mean) / self.std, dtype=torch.float32)

    def _train_local(self, global_state, client: DeviceClient) -> tuple:
        local_model = build_model(self.preset)
        local_model.load_state_dict(global_state)
        optimizer = torch.optim.Adam(local_model.parameters(), lr=self.learning_rate)
        loss_fn = nn.MSELoss()

        xs = self._normalize(client.xs)
        ys = torch.tensor(client.ys, dtype=torch.float32).unsqueeze(1)

        local_model.train()
        last_loss = float("nan")
        for _ in range(self.local_epochs):
            perm = torch.randperm(xs.shape[0])
            for i in range(0, xs.shape[0], self.batch_size):
                idx = perm[i : i + self.batch_size]
                optimizer.zero_grad()
                pred = local_model(xs[idx])
                loss = loss_fn(pred, ys[idx])
                loss.backward()
                optimizer.step()
                last_loss = loss.item()

        delta = flatten_state_dict(local_model.state_dict()) - flatten_state_dict(global_state)
        return delta.detach(), last_loss

    def run_round(self, round_clients: List[DeviceClient]) -> RoundStat:
        global_state = copy.deepcopy(self.model.state_dict())

        client_deltas = []
        client_stats = []
        for client in round_clients:
            delta, local_loss = self._train_local(global_state, client)
            client_deltas.append(delta)
            client_stats.append(ClientRoundStat(client.name, client.device, client.sessions, local_loss))

        noised_deltas = []
        norms = []
        clipped_count = 0
        for delta in client_deltas:
            noised, norm, was_clipped = clip_and_noise(delta, self.clip_norm, self.noise_multiplier)
            noised_deltas.append(noised)
            norms.append(norm)
            clipped_count += int(was_clipped)

        avg_delta = torch.stack(noised_deltas).mean(dim=0)
        new_flat = flatten_state_dict(global_state) + avg_delta
        self.model.load_state_dict(unflatten_like(new_flat, global_state))

        self.model.eval()
        with torch.no_grad():
            val_x = self._normalize(self.val_xs)
            val_y = torch.tensor(self.val_ys, dtype=torch.float32).unsqueeze(1)
            preds = self.model(val_x)
            val_loss = torch.nn.functional.mse_loss(preds, val_y).item()
            val_mae = (preds - val_y).abs().mean().item()

        if self.noise_multiplier > 0:
            round_eps = gaussian_mechanism_epsilon(self.noise_multiplier, self.delta_dp)
            self.epsilon_spent += round_eps
        else:
            round_eps = float("inf")
            self.epsilon_spent = float("inf")

        self.round += 1
        stat = RoundStat(
            round=self.round,
            val_loss=val_loss,
            val_mae=val_mae,
            epsilon_round=round_eps,
            epsilon_total=self.epsilon_spent,
            avg_pre_clip_norm=sum(norms) / len(norms),
            clip_rate=clipped_count / len(round_clients),
            client_stats=client_stats,
        )
        self.history.append(stat)
        return stat
