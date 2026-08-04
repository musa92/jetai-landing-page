"""Real distributed training: torch.distributed + FSDP.

This is the counterpart to the browser demo's `pretrain` command. There the
sharding arithmetic is real but execution is serial in one tab. Here the
processes are real, the collectives are real, and the parameter sharding is
performed by PyTorch's own FullyShardedDataParallel.

Strategy names map onto the ZeRO stages the platform UI reports:

    ddp     NO_SHARD        every rank holds a full replica (gradient all-reduce)
    zero2   SHARD_GRAD_OP   gradients + optimizer state sharded
    zero3   FULL_SHARD      parameters also sharded  (this is FSDP proper)

Run it with torchrun, which spawns one process per rank:

    torchrun --nproc_per_node=4 scripts/train_distributed.py --strategy zero3

gloo is used when CUDA is absent so the exact same code path is runnable, and
therefore testable, on a laptop.
"""

from __future__ import annotations

import functools
import os
from dataclasses import dataclass
from typing import Optional

import torch
import torch.distributed as dist
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy
from torch.distributed.fsdp.wrap import size_based_auto_wrap_policy
from torch.nn.parallel import DistributedDataParallel as DDP

STRATEGIES = {
    "ddp": ShardingStrategy.NO_SHARD,
    "zero2": ShardingStrategy.SHARD_GRAD_OP,
    "zero3": ShardingStrategy.FULL_SHARD,
}


@dataclass
class DistContext:
    rank: int
    world_size: int
    local_rank: int
    device: torch.device
    backend: str

    @property
    def is_main(self) -> bool:
        return self.rank == 0

    def log(self, msg: str) -> None:
        """Only rank 0 prints, otherwise every line appears world_size times."""
        if self.is_main:
            print(msg, flush=True)


def is_distributed() -> bool:
    return "RANK" in os.environ and "WORLD_SIZE" in os.environ


def setup() -> DistContext:
    """Initializes the process group from the env vars torchrun sets."""
    if not is_distributed():
        return DistContext(0, 1, 0, torch.device("cpu"), "none")

    rank = int(os.environ["RANK"])
    world_size = int(os.environ["WORLD_SIZE"])
    local_rank = int(os.environ.get("LOCAL_RANK", 0))

    # nccl is the right choice on real GPUs; gloo keeps the identical code path
    # runnable on CPU so this can be verified without a cluster.
    backend = "nccl" if torch.cuda.is_available() else "gloo"
    dist.init_process_group(backend=backend, rank=rank, world_size=world_size)

    if torch.cuda.is_available():
        torch.cuda.set_device(local_rank)
        device = torch.device("cuda", local_rank)
    else:
        device = torch.device("cpu")

    return DistContext(rank, world_size, local_rank, device, backend)


def teardown() -> None:
    if dist.is_available() and dist.is_initialized():
        dist.destroy_process_group()


def wrap(model: torch.nn.Module, ctx: DistContext, strategy: str = "zero3",
         min_params: int = 100) -> torch.nn.Module:
    """Wraps a model for distributed training.

    min_params controls the auto-wrap granularity: FSDP shards each wrapped
    submodule separately, so on a small model a high threshold would collapse
    everything into a single unit and there would be nothing to shard.
    """
    model = model.to(ctx.device)
    if ctx.world_size == 1:
        return model

    if strategy == "ddp":
        return DDP(model, device_ids=[ctx.local_rank] if torch.cuda.is_available() else None)

    if strategy not in STRATEGIES:
        raise ValueError(f"unknown strategy '{strategy}', expected one of {', '.join(STRATEGIES)}")

    policy = functools.partial(size_based_auto_wrap_policy, min_num_params=min_params)
    # device_id must be an explicit device. Passing None makes FSDP resolve the
    # handle via torch.cuda.current_device(), which raises on a CPU-only build
    # even though gloo + CPU is a perfectly valid configuration.
    return FSDP(
        model,
        sharding_strategy=STRATEGIES[strategy],
        auto_wrap_policy=policy,
        device_id=ctx.device,
        use_orig_params=True,
    )


def local_param_count(model: torch.nn.Module) -> int:
    """Parameters materialized on THIS rank.

    Under FULL_SHARD this is roughly total/world_size, which is the measurement
    that shows sharding actually happened rather than being configured.
    """
    return sum(p.numel() for p in model.parameters())


def all_reduce_mean(value: float, ctx: DistContext) -> float:
    """Averages a scalar across ranks, so reported loss reflects every shard."""
    if ctx.world_size == 1:
        return value
    t = torch.tensor([value], dtype=torch.float32, device=ctx.device)
    dist.all_reduce(t, op=dist.ReduceOp.SUM)
    return (t / ctx.world_size).item()
