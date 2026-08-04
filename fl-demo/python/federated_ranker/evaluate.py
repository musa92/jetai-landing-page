"""Held-out evaluation report — mirrors the browser demo's Eval tab: MAE,
RMSE, loss, a comparison against a naive mean-baseline predictor, and error
broken down by engagement-score bucket. Runs on the trainer's fixed
validation set, which is never used for training."""

from dataclasses import dataclass
from typing import List

import numpy as np
import torch

from .trainer import FederatedTrainer

_BUCKET_DEFS = [
    ("Critical · <33% life", 0.0, 0.33),
    ("Mid-life · 33-66%", 0.33, 0.66),
    ("Healthy · >66% life", 0.66, 1.001),
]


@dataclass
class BucketStat:
    label: str
    mae: float
    count: int


@dataclass
class EvalReport:
    mae: float
    rmse: float
    loss: float
    baseline_mae: float
    lift_pct: float
    buckets: List[BucketStat]


def evaluate(trainer: FederatedTrainer) -> EvalReport:
    trainer.model.eval()
    with torch.no_grad():
        val_x = trainer._normalize(trainer.val_xs)
        preds = trainer.model(val_x).squeeze(1).numpy()
    true_y = trainer.val_ys

    mean_y = float(true_y.mean())
    baseline_mae = float(np.abs(mean_y - true_y).mean())
    mae = float(np.abs(preds - true_y).mean())
    rmse = float(np.sqrt(((preds - true_y) ** 2).mean()))
    loss = float(((preds - true_y) ** 2).mean())
    lift_pct = (baseline_mae - mae) / baseline_mae * 100 if baseline_mae else 0.0

    buckets = []
    for label, lo, hi in _BUCKET_DEFS:
        mask = (true_y >= lo) & (true_y < hi)
        count = int(mask.sum())
        bucket_mae = float(np.abs(preds[mask] - true_y[mask]).mean()) if count else 0.0
        buckets.append(BucketStat(label, bucket_mae, count))

    return EvalReport(mae=mae, rmse=rmse, loss=loss, baseline_mae=baseline_mae, lift_pct=lift_pct, buckets=buckets)
