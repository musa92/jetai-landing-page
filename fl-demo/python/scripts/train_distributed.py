#!/usr/bin/env python3
"""Centralized, sharded pre-training. The real distributed counterpart to the
browser demo's `pretrain` command.

    torchrun --nproc_per_node=4 scripts/train_distributed.py --strategy zero3
    torchrun --nproc_per_node=2 scripts/train_distributed.py --strategy ddp

Each rank pools its own shard of device data, computes real gradients, and the
collectives are performed by torch.distributed. Under zero3 the parameters
themselves are sharded, so the per-rank parameter count printed below is the
evidence that sharding happened rather than merely being requested.
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import torch  # noqa: E402
import torch.nn as nn  # noqa: E402
from torch.utils.data import DataLoader, DistributedSampler, TensorDataset  # noqa: E402

from federated_ranker.config import get_cohort, COHORTS  # noqa: E402
from federated_ranker.data import build_cohort_validation, build_round_clients  # noqa: E402
from federated_ranker.models import build_model, count_params  # noqa: E402
from federated_ranker import distributed as D  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--strategy", default="zero3", choices=["ddp", "zero2", "zero3"])
    p.add_argument("--preset", default="medium", choices=["small", "medium", "large", "transformer", "linear"])
    p.add_argument("--cohort", default="us", help=", ".join(c.id for c in COHORTS))
    p.add_argument("--devices", type=int, default=64, help="devices whose data is pooled centrally")
    p.add_argument("--steps", type=int, default=60)
    p.add_argument("--batch", type=int, default=64, help="per-rank batch size")
    p.add_argument("--lr", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=1337)
    args = p.parse_args()

    ctx = D.setup()
    torch.manual_seed(args.seed + ctx.rank)

    cohort = get_cohort(args.cohort)
    clients = build_round_clients(cohort, args.devices, args.seed)
    xs = torch.tensor([r for c in clients for r in c.xs], dtype=torch.float32)
    ys = torch.tensor([[v] for c in clients for v in c.ys], dtype=torch.float32)

    val_xs, val_ys = build_cohort_validation(cohort)
    mean, std = xs.mean(0), xs.std(0).clamp_min(1e-6)
    xs = (xs - mean) / std
    vx = (torch.tensor(val_xs, dtype=torch.float32) - mean) / std
    vy = torch.tensor(val_ys, dtype=torch.float32).unsqueeze(1)

    model = build_model(args.preset)
    total = count_params(model)
    model = D.wrap(model, ctx, args.strategy)
    local = D.local_param_count(model)

    ctx.log(f"[dist] backend={ctx.backend} world_size={ctx.world_size} strategy={args.strategy}")
    ctx.log(f"[dist] pooled {xs.shape[0]:,} samples from {len(clients)} devices in {cohort.label}")
    ctx.log(f"[dist] model {args.preset}: {total:,} params total, {local:,} materialized per rank")
    if ctx.world_size > 1 and args.strategy == "zero3":
        ctx.log(f"[dist] shard ratio {total / max(1, local):.2f}x  (ideal {ctx.world_size}x)")

    ds = TensorDataset(xs, ys)
    sampler = DistributedSampler(ds, num_replicas=ctx.world_size, rank=ctx.rank, shuffle=True) if ctx.world_size > 1 else None
    loader = DataLoader(ds, batch_size=args.batch, sampler=sampler, shuffle=(sampler is None), drop_last=True)

    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    loss_fn = nn.MSELoss()

    t0 = time.time()
    step = 0
    done = False
    while not done:
        if sampler is not None:
            sampler.set_epoch(step)
        for bx, by in loader:
            bx, by = bx.to(ctx.device), by.to(ctx.device)
            opt.zero_grad()
            loss = loss_fn(model(bx), by)
            loss.backward()
            opt.step()
            step += 1
            if step % max(1, args.steps // 4) == 0 or step == args.steps:
                # Averaged across ranks: each rank only sees its own shard, so a
                # single rank's loss is not the run's loss.
                ctx.log(f"[dist] step {step}/{args.steps}  loss {D.all_reduce_mean(loss.item(), ctx):.5f}")
            if step >= args.steps:
                done = True
                break

    secs = time.time() - t0
    model.eval()
    with torch.no_grad():
        mae = (model(vx.to(ctx.device)) - vy.to(ctx.device)).abs().mean().item()
    ctx.log(f"[dist] done in {secs:.1f}s  ({step / secs:.1f} steps/s)  held-out MAE {mae:.4f}")

    D.teardown()


if __name__ == "__main__":
    main()
