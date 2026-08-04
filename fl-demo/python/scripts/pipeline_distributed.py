#!/usr/bin/env python3
"""The full lifecycle, end to end, with the training phase actually distributed.

    torchrun --nproc_per_node=4 scripts/pipeline_distributed.py --strategy zero3

Stages, in the order a real ads platform runs them:

  1. FEDERATE    pull DP-protected updates from edge devices and FedAvg them.
                 Runs on rank 0 only: this is the on-device phase, and the
                 coordinator is a single logical entity.
  2. BROADCAST   push the aggregated model to every training rank, so the
                 distributed phase starts from the federated result rather
                 than from scratch.
  3. FSDP        centralized sharded training on pooled data. Real
                 torch.distributed, real parameter sharding.
  4. POST-TRAIN  fine-tune the trained model on a target cohort.
  5. COMPRESS    int8 quantization and magnitude pruning, each re-measured on
                 the held-out set so the accuracy cost is reported, not assumed.

Every number printed is measured during the run.
"""

import argparse, copy, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import torch, torch.nn as nn  # noqa: E402
import torch.distributed as dist  # noqa: E402
from torch.utils.data import DataLoader, DistributedSampler, TensorDataset  # noqa: E402

from federated_ranker.config import get_cohort, COHORTS  # noqa: E402
from federated_ranker.data import build_cohort_validation, build_round_clients  # noqa: E402
from federated_ranker.models import build_model, count_params  # noqa: E402
from federated_ranker.privacy import clip_and_noise, flatten_state_dict, unflatten_like  # noqa: E402
from federated_ranker import distributed as D  # noqa: E402


def mae(model, x, y):
    model.eval()
    with torch.no_grad():
        return (model(x) - y).abs().mean().item()


def quantize_int8(model):
    """Per-tensor affine int8, dequantized in place so the same model can be
    re-evaluated. Measures the accuracy cost of quantization, not int8 speed."""
    q = copy.deepcopy(model)
    for p in q.parameters():
        lo, hi = p.data.min(), p.data.max()
        if hi > lo:
            scale = (hi - lo) / 255.0
            p.data = lo + torch.round((p.data - lo) / scale) * scale
    return q


def prune_magnitude(model, sparsity):
    """Global unstructured magnitude pruning: pool every weight, zero the
    smallest by absolute value."""
    p = copy.deepcopy(model)
    flat = torch.cat([w.data.abs().flatten() for w in p.parameters()])
    thresh = flat.kthvalue(max(1, int(len(flat) * sparsity))).values
    zeroed = total = 0
    for w in p.parameters():
        mask = w.data.abs() >= thresh
        zeroed += (~mask).sum().item(); total += mask.numel()
        w.data *= mask
    return p, zeroed / total


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strategy", default="zero3", choices=["ddp", "zero2", "zero3"])
    ap.add_argument("--preset", default="large", choices=["small", "medium", "large", "linear"])
    ap.add_argument("--cohort", default="us")
    ap.add_argument("--target-cohort", default="apac", help="cohort to post-train onto")
    ap.add_argument("--fed-rounds", type=int, default=5)
    ap.add_argument("--fed-k", type=int, default=16, help="edge devices sampled per federated round")
    ap.add_argument("--noise", type=float, default=1.0)
    ap.add_argument("--clip-norm", type=float, default=0.5)
    ap.add_argument("--steps", type=int, default=60)
    ap.add_argument("--posttrain-steps", type=int, default=30)
    ap.add_argument("--sparsity", type=float, default=0.4)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=0.02)
    ap.add_argument("--seed", type=int, default=1337)
    a = ap.parse_args()

    ctx = D.setup()
    torch.manual_seed(a.seed)
    cohort = get_cohort(a.cohort)
    model = build_model(a.preset)
    total = count_params(model)

    ctx.log(f"\n{'='*66}\n  UNIFIED PIPELINE  backend={ctx.backend}  world_size={ctx.world_size}\n{'='*66}")

    # ---- normalization + held-out set, identical on every rank ----
    clients = build_round_clients(cohort, 48, a.seed)
    xs = torch.tensor([r for c in clients for r in c.xs], dtype=torch.float32)
    ys = torch.tensor([[v] for c in clients for v in c.ys], dtype=torch.float32)
    mean, std = xs.mean(0), xs.std(0).clamp_min(1e-6)
    vx_raw, vy_raw = build_cohort_validation(cohort)
    vx = ((torch.tensor(vx_raw, dtype=torch.float32) - mean) / std).to(ctx.device)
    vy = torch.tensor(vy_raw, dtype=torch.float32).unsqueeze(1).to(ctx.device)

    # ---- 1. FEDERATE (rank 0 only: the coordinator is one logical entity) ----
    if ctx.is_main:
        ctx.log(f"\n[1/5] FEDERATE  {a.fed_rounds} rounds x {a.fed_k} edge devices  "
                f"(clip C={a.clip_norm}, noise z={a.noise})")
        for r in range(a.fed_rounds):
            gstate = copy.deepcopy(model.state_dict())
            deltas, clipped = [], 0
            for c in build_round_clients(cohort, a.fed_k, a.seed + r * 104729):
                local = build_model(a.preset); local.load_state_dict(gstate)
                opt = torch.optim.Adam(local.parameters(), lr=0.05)
                cx = (torch.tensor(c.xs, dtype=torch.float32) - mean) / std
                cy = torch.tensor(c.ys, dtype=torch.float32).unsqueeze(1)
                for _ in range(2):
                    opt.zero_grad(); nn.MSELoss()(local(cx), cy).backward(); opt.step()
                d, _, was = clip_and_noise(
                    flatten_state_dict(local.state_dict()) - flatten_state_dict(gstate),
                    a.clip_norm, a.noise)
                deltas.append(d); clipped += int(was)
            avg = torch.stack(deltas).mean(0)
            model.load_state_dict(unflatten_like(flatten_state_dict(gstate) + avg, gstate))
            ctx.log(f"      round {r+1}/{a.fed_rounds}  MAE {mae(model, vx.cpu(), vy.cpu()):.4f}  "
                    f"clipped {clipped}/{a.fed_k}")
        fed_mae = mae(model, vx.cpu(), vy.cpu())
        ctx.log(f"      federated model: MAE {fed_mae:.4f}  (no raw device data left the edge)")

    # ---- 2. BROADCAST the aggregated model to every training rank ----
    if ctx.world_size > 1:
        for p in model.parameters():
            dist.broadcast(p.data, src=0)
        ctx.log(f"\n[2/5] BROADCAST  aggregated weights pushed to {ctx.world_size} ranks")

    # ---- 3. FSDP: centralized sharded training, seeded by the federated model ----
    model = D.wrap(model, ctx, a.strategy)
    local_params = D.local_param_count(model)
    ctx.log(f"\n[3/5] FSDP  strategy={a.strategy}  {total:,} params total, "
            f"{local_params:,} per rank"
            + (f"  ({total/max(1,local_params):.2f}x sharded)" if ctx.world_size > 1 else ""))

    xs_n = ((xs - mean) / std)
    ds = TensorDataset(xs_n, ys)
    sampler = DistributedSampler(ds, num_replicas=ctx.world_size, rank=ctx.rank, shuffle=True) if ctx.world_size > 1 else None
    loader = DataLoader(ds, batch_size=a.batch, sampler=sampler, shuffle=(sampler is None), drop_last=True)
    opt = torch.optim.Adam(model.parameters(), lr=a.lr)

    t0, step, done = time.time(), 0, False
    while not done:
        if sampler: sampler.set_epoch(step)
        for bx, by in loader:
            opt.zero_grad()
            loss = nn.MSELoss()(model(bx.to(ctx.device)), by.to(ctx.device))
            loss.backward(); opt.step(); step += 1
            if step % max(1, a.steps // 3) == 0:
                ctx.log(f"      step {step}/{a.steps}  loss {D.all_reduce_mean(loss.item(), ctx):.5f}")
            if step >= a.steps: done = True; break
    fsdp_secs = time.time() - t0
    fsdp_mae = mae(model, vx, vy)
    ctx.log(f"      trained in {fsdp_secs:.1f}s ({step/fsdp_secs:.0f} steps/s)  MAE {fsdp_mae:.4f}")

    # Unwrap: FSDP shards live across ranks, so gather a full copy for the
    # single-process stages that follow.
    if ctx.world_size > 1 and a.strategy != "ddp":
        from torch.distributed.fsdp import FullStateDictConfig, StateDictType
        from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
        # offload_to_cpu must stay False on a CPU build: the offload path
        # segfaults when source and destination are already the same device.
        # rank0_only=False keeps every rank inside the collective, which is
        # what it is: all ranks must call it, only rank 0 needs the result.
        with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT,
                                  FullStateDictConfig(offload_to_cpu=False, rank0_only=False)):
            full = {k: v.clone() for k, v in model.state_dict().items()}
        dense = build_model(a.preset)
        dense.load_state_dict(full)
    else:
        dense = model.module if hasattr(model, "module") else model

    # The remaining stages are single-process. Non-main ranks wait at the
    # barrier so rank 0 can finish before the process group is destroyed.
    if ctx.world_size > 1:
        dist.barrier()
    if not ctx.is_main:
        D.teardown(); return

    # ---- 4. POST-TRAIN onto a target cohort ----
    tgt = get_cohort(a.target_cohort)
    tvx_raw, tvy_raw = build_cohort_validation(tgt)
    tvx = (torch.tensor(tvx_raw, dtype=torch.float32) - mean) / std
    tvy = torch.tensor(tvy_raw, dtype=torch.float32).unsqueeze(1)
    before_t, before_s = mae(dense, tvx, tvy), mae(dense, vx.cpu(), vy.cpu())
    ctx.log(f"\n[4/5] POST-TRAIN  fine-tuning onto {tgt.label}")
    tc = build_round_clients(tgt, 24, a.seed + 77)
    tx = ((torch.tensor([r for c in tc for r in c.xs], dtype=torch.float32) - mean) / std)
    ty = torch.tensor([[v] for c in tc for v in c.ys], dtype=torch.float32)
    opt2 = torch.optim.Adam(dense.parameters(), lr=0.005)
    dense.train()
    for _ in range(a.posttrain_steps):
        opt2.zero_grad(); nn.MSELoss()(dense(tx), ty).backward(); opt2.step()
    ctx.log(f"      {tgt.label}: {before_t:.4f} -> {mae(dense, tvx, tvy):.4f}")
    ctx.log(f"      {cohort.label} (source): {before_s:.4f} -> {mae(dense, vx.cpu(), vy.cpu()):.4f}"
            f"   <- forgetting is the cost of adaptation")

    # ---- 5. COMPRESS ----
    base = mae(dense, vx.cpu(), vy.cpu())
    q = quantize_int8(dense)
    p, actual = prune_magnitude(dense, a.sparsity)
    fp32_b, int8_b = total * 4, total
    ctx.log(f"\n[5/5] COMPRESS  (each re-measured on the held-out set)")
    ctx.log(f"      {'variant':<22}{'size':>10}{'MAE':>10}{'delta':>10}")
    ctx.log(f"      {'fp32 baseline':<22}{fp32_b/1024:>9.1f}K{base:>10.4f}{'--':>10}")
    qm = mae(q, vx.cpu(), vy.cpu()); pm = mae(p, vx.cpu(), vy.cpu())
    ctx.log(f"      {'int8 quantized':<22}{int8_b/1024:>9.1f}K{qm:>10.4f}{(qm-base)/base*100:>+9.1f}%")
    ctx.log(f"      {f'pruned {actual*100:.0f}%':<22}{fp32_b/1024:>9.1f}K{pm:>10.4f}{(pm-base)/base*100:>+9.1f}%")

    ctx.log(f"\n{'='*66}\n  federated {fed_mae:.4f} -> fsdp {fsdp_mae:.4f} -> "
            f"post-trained {base:.4f} -> int8 {qm:.4f}\n{'='*66}\n")
    D.teardown()


if __name__ == "__main__":
    main()
