#!/usr/bin/env python3
"""Run DP-FedAvg training from the command line — the Python/PyTorch mirror
of the browser demo. Same algorithm, same synthetic world, same privacy
math, just a terminal instead of a browser tab.

Usage:
    python scripts/train.py --cohort us --rounds 20 --k 6 --preset small
    python scripts/train.py --cohort all --rounds 10 --noise 0   # DP off, for comparison
"""

import argparse
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from federated_ranker.config import COHORTS, get_cohort  # noqa: E402
from federated_ranker.data import build_cohort_validation, build_round_clients  # noqa: E402
from federated_ranker.evaluate import evaluate  # noqa: E402
from federated_ranker.models import count_params  # noqa: E402
from federated_ranker.trainer import FederatedTrainer  # noqa: E402


def ts() -> str:
    return datetime.datetime.now().strftime("%H:%M:%S")


def main():
    cohort_ids = ", ".join(c.id for c in COHORTS)
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cohort", default="us", help=f"cohort id ({cohort_ids})")
    parser.add_argument("--rounds", type=int, default=15)
    parser.add_argument("--k", type=int, default=6, help="devices sampled per round")
    parser.add_argument("--preset", default="small", choices=["small", "medium", "large", "transformer", "linear"])
    parser.add_argument("--clip-norm", type=float, default=0.5)
    parser.add_argument("--noise", type=float, default=3.0, help="noise multiplier (z); 0 disables DP")
    parser.add_argument("--local-epochs", type=int, default=2)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--quiet", action="store_true", help="only print round summaries, not per-device lines")
    args = parser.parse_args()

    cohort = get_cohort(args.cohort)

    print(f"[{ts()}] Coordinator ready, model: AdRank-Net, preset={args.preset}")
    print(f"[{ts()}] Cohort: {cohort.label}, {cohort.population:,} devices eligible")

    val_xs, val_ys = build_cohort_validation(cohort)
    trainer = FederatedTrainer(
        val_xs,
        val_ys,
        preset=args.preset,
        clip_norm=args.clip_norm,
        noise_multiplier=args.noise,
        local_epochs=args.local_epochs,
    )
    print(f"[{ts()}] Model has {count_params(trainer.model):,} parameters\n")

    for r in range(args.rounds):
        round_seed = args.seed + r * 104729 + 17
        round_clients = build_round_clients(cohort, args.k, round_seed)
        stat = trainer.run_round(round_clients)

        pct = len(round_clients) / cohort.population * 100
        print(f"[{ts()}] {len(round_clients)} devices responded to round {stat.round} ({pct:.4f}% of cohort)")
        if not args.quiet:
            for cs in stat.client_stats:
                print(f"[{ts()}]   {cs.name} ({cs.device}): local loss {cs.local_loss:.4f}")

        eps_txt = f"~ {stat.epsilon_total:.2f}" if stat.epsilon_total != float("inf") else "inf"
        print(
            f"[{ts()}] Round {stat.round} complete: val MAE {stat.val_mae:.4f} · "
            f"eps_total {eps_txt} · clip rate {stat.clip_rate * 100:.0f}%\n"
        )

    print(f"[{ts()}] Training complete. Running full evaluation on held-out devices...")
    report = evaluate(trainer)
    print(f"  MAE:          {report.mae:.4f}")
    print(f"  RMSE:         {report.rmse:.4f}")
    print(f"  Loss (MSE):   {report.loss:.5f}")
    better_worse = "better" if report.lift_pct >= 0 else "worse"
    print(f"  Baseline MAE: {report.baseline_mae:.4f}  ({report.lift_pct:+.0f}% {better_worse} than a naive mean predictor)")
    print("  By life stage:")
    for b in report.buckets:
        print(f"    {b.label:24s} MAE {b.mae:.4f}  (n={b.count})")


if __name__ == "__main__":
    main()
