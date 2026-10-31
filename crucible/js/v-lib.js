/* Crucible library: one model and job spec, lowered to PyTorch or JAX and
   launched on Ray. Logical-axis sharding rules are the contract between model
   code and parallelism, so the same model runs FSDP + TP in PyTorch (DTensor)
   or GSPMD in JAX (NamedSharding) without changes. */
import { E, h, fmt, si, gb, ctx, S, VIEWS, CLICKS, ACTIONS, head, pill, glist, seg, C, xyChart, toast } from './core.js?v=20261031-4';

S.lib = S.lib || { arch: 'core-70b', fw: 'jax', data: 8, fsdp: 32, tensor: 8, tab: 'user', hw: 'h100' };

/* Logical axes → mesh axes. Model code only names logical axes. */
export const RULES = [['batch', ['data', 'fsdp']], ['embed', ['fsdp']], ['heads', ['tensor']], ['kv_heads', ['tensor']], ['mlp', ['tensor']], ['vocab', ['tensor']], ['head_dim', []], ['seq', []], ['layers', []]];
const RULE = Object.fromEntries(RULES);
const ffn = (a) => a.ffn || Math.round(a.hidden * 3.5);
/* Parameters of one transformer block plus embeddings, with logical axes. */
export function params(a) {
  const hd = a.hd, H = a.hidden;
  return [
    ['embed_tokens', [a.vocab, H], ['vocab', 'embed'], 1],
    ['attn.wq', [H, a.heads * hd], ['embed', 'heads'], a.layers],
    ['attn.wk', [H, a.kv * hd], ['embed', 'kv_heads'], a.layers],
    ['attn.wv', [H, a.kv * hd], ['embed', 'kv_heads'], a.layers],
    ['attn.wo', [a.heads * hd, H], ['heads', 'embed'], a.layers],
    ['mlp.w1 (gate)', [H, ffn(a)], ['embed', 'mlp'], a.layers],
    ['mlp.w3 (up)', [H, ffn(a)], ['embed', 'mlp'], a.layers],
    ['mlp.w2 (down)', [ffn(a), H], ['mlp', 'embed'], a.layers],
    ['norms', [H], ['embed'], a.layers * 2 + 1],
    ['lm_head', [H, a.vocab], ['embed', 'vocab'], 1],
  ];
}
const spec = (axes) => `P(${axes.map((x) => { const m = RULE[x]; return !m || !m.length ? 'None' : m.length === 1 ? `"${m[0]}"` : `(${m.map((y) => `"${y}"`).join(', ')})`; }).join(', ')})`;
const shardShape = (shape, axes, mesh) => shape.map((d, i) => { const m = RULE[axes[i]] || []; return d / m.reduce((p, x) => p * mesh[x], 1); });

function validate(a, m) {
  const out = [];
  const chk = (ok, t) => out.push([ok, t]);
  chk(a.heads % m.tensor === 0, `query heads ${a.heads} divisible by tensor ${m.tensor}`);
  chk(a.kv % m.tensor === 0 || m.tensor % a.kv === 0, `KV heads ${a.kv} ${a.kv % m.tensor === 0 ? 'divisible by' : 'replicated across'} tensor ${m.tensor}`);
  chk(ffn(a) % m.tensor === 0, `MLP width ${fmt(ffn(a))} divisible by tensor ${m.tensor}`);
  chk(a.hidden % m.fsdp === 0, `embed ${fmt(a.hidden)} divisible by fsdp ${m.fsdp}`);
  chk(a.vocab % m.tensor === 0, `vocab ${fmt(a.vocab)} divisible by tensor ${m.tensor}`);
  chk(m.tensor <= 8, `tensor axis ${m.tensor} stays inside one 8-GPU NVLink domain`);
  return out;
}

export function lower(L) {
  const a = E.ARCH[L.arch], m = { data: +L.data, fsdp: +L.fsdp, tensor: +L.tensor }, n = m.data * m.fsdp * m.tensor;
  const cfg = { hw: 'h100', tp: m.tensor, pp: 1, cp: 1, dp: m.data * m.fsdp, micro: 1, accum: 1, zero: m.fsdp > 1 ? 3 : 1, recompute: 'selective', seq: 8192, chunkedLoss: true };
  // HSDP: parameters shard over fsdp only and replicate over data.
  const mem = E.trainMemory(a, { ...cfg, dp: m.fsdp }), perf = E.trainStep(a, cfg);
  return { a, m, n, mem, perf, checks: validate(a, m), ps: params(a) };
}

/* ── generated code ── */
function userCode(L, X) {
  return `import crucible as cx

model = cx.models.Transformer(cx.configs.${L.arch.replace('-', '_')})     # framework-neutral definition

job = cx.train.Job(
    model=model,
    data=cx.data.Mixture("mix-pretrain-v9", seq_len=8192),
    mesh=cx.Mesh(data=${X.m.data}, fsdp=${X.m.fsdp}, tensor=${X.m.tensor}),   # ${fmt(X.n)} devices
    rules=cx.shard.DEFAULT_RULES,                     # logical axes → mesh axes
    optimizer=cx.optim.AdamW(lr=3e-4, schedule="cosine", warmup=2000),
    precision="bf16",
    framework="${L.fw}",                                  # "torch" or "jax": same model, same checkpoints
    runtime=cx.runtime.Ray(cluster="usw2-h100-a", team="foundation"),
    checkpoint=cx.ckpt.Every("6m", async_save=True),
)
job.submit()`;
}
function modelCode() {
  return `# crucible/models/transformer.py: written once, annotated with logical axes only
class MLP(cx.Module):
    def __init__(self, cfg):
        self.w1 = cx.Param((cfg.embed, cfg.mlp), axes=("embed", "mlp"))
        self.w3 = cx.Param((cfg.embed, cfg.mlp), axes=("embed", "mlp"))
        self.w2 = cx.Param((cfg.mlp, cfg.embed), axes=("mlp", "embed"))

    def __call__(self, x):                       # x: ("batch", "seq", "embed")
        h = cx.ops.silu(x @ self.w1) * (x @ self.w3)
        h = cx.constrain(h, ("batch", "seq", "mlp"))
        return h @ self.w2

# cx.ops dispatches to torch or jax.numpy; cx.constrain becomes
#   jax.lax.with_sharding_constraint(...)  or  DTensor redistribute(...)`;
}
function torchCode(L, X) {
  return `# generated: crucible.backends.torch
import torch
from torch.distributed.device_mesh import init_device_mesh
from torch.distributed.fsdp import fully_shard, MixedPrecisionPolicy
from torch.distributed.tensor.parallel import parallelize_module, ColwiseParallel, RowwiseParallel
from torch.distributed.checkpoint import async_save

mesh = init_device_mesh("cuda", (${X.m.data * X.m.fsdp}, ${X.m.tensor}), mesh_dim_names=("dp", "tensor"))
mp = MixedPrecisionPolicy(param_dtype=torch.bfloat16, reduce_dtype=torch.float32)

model = cx.backends.torch.materialize(model, device="meta")      # no memory until sharded
for block in model.layers:
    # rule mlp→tensor, heads→tensor: column-parallel in, row-parallel out
    parallelize_module(block, mesh["tensor"], {
        "attn.wq": ColwiseParallel(), "attn.wk": ColwiseParallel(), "attn.wv": ColwiseParallel(),
        "attn.wo": RowwiseParallel(),
        "mlp.w1": ColwiseParallel(), "mlp.w3": ColwiseParallel(), "mlp.w2": RowwiseParallel(),
    })
    # rule embed→fsdp${X.m.data > 1 ? ', batch→(data, fsdp): HSDP across data' : ''}
    fully_shard(block, mesh=mesh["dp"], mp_policy=mp, reshard_after_forward=True)
fully_shard(model, mesh=mesh["dp"], mp_policy=mp)
model.to_empty(device="cuda"); cx.init_weights(model, seed=0)
model = torch.compile(model)                                      # regional: one block compiled, reused

opt = torch.optim.AdamW(model.parameters(), lr=3e-4, fused=True)
for step, batch in enumerate(loader):
    loss = model(batch).loss; loss.backward(); opt.step(); opt.zero_grad()
    if step % ckpt_every == 0:
        async_save({"model": model.state_dict(), "optim": opt.state_dict()}, checkpoint_id=f"s3://acme-ckpt/{run}/{step}")`;
}
function jaxCode(L, X) {
  return `# generated: crucible.backends.jax
import jax, jax.numpy as jnp, optax
import orbax.checkpoint as ocp
from jax.sharding import Mesh, NamedSharding, PartitionSpec as P
from jax.experimental import mesh_utils

devices = mesh_utils.create_device_mesh((${X.m.data}, ${X.m.fsdp}, ${X.m.tensor}))     # topology-aware order
mesh = Mesh(devices, axis_names=("data", "fsdp", "tensor"))

RULES = {${RULES.filter(([, m]) => m.length).map(([k, m]) => `"${k}": ${m.length === 1 ? `"${m[0]}"` : `(${m.map((x) => `"${x}"`).join(', ')})`}`).join(', ')}}
def to_spec(axes): return P(*(RULES.get(a) for a in axes))

param_sharding = jax.tree.map(lambda ax: NamedSharding(mesh, to_spec(ax)), model.logical_axes())
batch_sharding = NamedSharding(mesh, P(("data", "fsdp"), None))

tx = optax.adamw(optax.warmup_cosine_decay_schedule(0, 3e-4, 2000, total_steps))
state = jax.jit(cx.backends.jax.init_state(model, tx), out_shardings=param_sharding)(jax.random.key(0))

@jax.jit                                   # XLA's SPMD partitioner inserts the all-gathers and reduce-scatters
def train_step(state, batch):
    loss, grads = jax.value_and_grad(model.loss)(state.params, batch)
    return state.apply_gradients(grads=grads), loss
train_step = train_step.lower(state, batch_spec).compile()       # cached in the persistent compilation cache

mngr = ocp.CheckpointManager("s3://acme-ckpt/" + run, options=ocp.CheckpointManagerOptions(save_interval_steps=ckpt_every))
for step, batch in enumerate(loader):
    state, loss = train_step(state, jax.device_put(batch, batch_sharding))
    mngr.save(step, args=ocp.args.StandardSave(state))                # async, sharded`;
}
function rayCode(L, X) {
  const hosts = X.n / 8;
  return `# generated: crucible.runtime.ray
import ray
from ray.util.placement_group import placement_group
from ray.util.scheduling_strategies import PlacementGroupSchedulingStrategy

pg = placement_group([{"GPU": 8, "CPU": 96}] * ${hosts}, strategy="STRICT_SPREAD")  # one bundle per host
ray.get(pg.ready())                                               # gang: all ${hosts} hosts or none

@ray.remote(num_gpus=8, max_restarts=3)
class Host:
    def run(self, rank, coordinator):
${L.fw === 'jax' ? `        jax.distributed.initialize(coordinator, num_processes=${hosts}, process_id=rank)   # one process per host, 8 local devices
        return cx.backends.jax.train(job, jax.devices())` : `        os.environ.update(MASTER_ADDR=coordinator.host, MASTER_PORT="29500")
        cx.launch_local_ranks(8, lambda r: cx.backends.torch.train(job, global_rank=rank * 8 + r))   # one process per GPU`}

hosts = [Host.options(scheduling_strategy=PlacementGroupSchedulingStrategy(pg, i)).remote() for i in range(${hosts})]
coordinator = ray.get(hosts[0].address.remote())
cx.runtime.ray.supervise(ray.get([h.run.remote(i, coordinator) for i, h in enumerate(hosts)]),
                         on_failure="replace_host_and_resume")        # hot spare + restore from last checkpoint`;
}
function lowerLog(L, X) {
  const fw = L.fw === 'jax' ? 'JAX' : 'PyTorch';
  return [
    ['Parse spec', `${X.a.name}, mesh data ${X.m.data} × fsdp ${X.m.fsdp} × tensor ${X.m.tensor} = ${fmt(X.n)} devices`],
    ['Validate', `${X.checks.filter((c) => c[0]).length} of ${X.checks.length} shape checks pass`],
    ['Plan memory', `${gb(X.mem.total)} per device of 80 GB · modeled MFU ${(X.perf.mfu * 100).toFixed(1)}%`],
    ['Resolve sharding', `${RULES.filter((r) => r[1].length).length} logical axes mapped · ${X.ps.length} parameter groups`],
    ['Lower to ' + fw, L.fw === 'jax' ? 'jit with NamedSharding in/out; XLA SPMD inserts collectives; compile 41 s, cached' : 'DTensor TP plans + FSDP2 per block; torch.compile per block, 38 s warm-up'],
    ['Launch on Ray', `placement group ${X.n / 8} × {GPU: 8}, STRICT_SPREAD; ${L.fw === 'jax' ? 'jax.distributed.initialize per host' : 'init_process_group, NCCL'}`],
    ['Checkpoint', L.fw === 'jax' ? 'Orbax, async, sharded; readable by the torch backend via cx.ckpt' : 'torch DCP, async, sharded; readable by the jax backend via cx.ckpt'],
  ];
}

VIEWS.library = () => {
  const L = S.lib, X = lower(L);
  const sel = (k, opts) => `<select data-bind="lib.${k}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(L[k]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const tabs = [['user', 'Your code'], ['model', 'Model definition'], ['plan', 'Sharding plan'], ['gen', `Generated ${L.fw === 'jax' ? 'JAX' : 'PyTorch'}`], ['ray', 'Ray launch'], ['log', 'Lowering steps']];
  const ok = X.checks.every((c) => c[0]) && X.mem.total <= 80e9 * 0.92;
  let body = '';
  if (L.tab === 'user') body = `<pre class="code">${h(userCode(L, X))}</pre>`;
  if (L.tab === 'model') body = `<pre class="code">${h(modelCode())}</pre>`;
  if (L.tab === 'gen') body = `<pre class="code">${h(L.fw === 'jax' ? jaxCode(L, X) : torchCode(L, X))}</pre>`;
  if (L.tab === 'ray') body = `<pre class="code">${h(rayCode(L, X))}</pre>`;
  if (L.tab === 'log') body = `<ol class="steps">${lowerLog(L, X).map(([t, d], i) => `<li class="${i === 1 && !X.checks.every((c) => c[0]) ? 'rejected' : 'done'}"><span class="dot">${i === 1 && !X.checks.every((c) => c[0]) ? '!' : '✓'}</span><div><b>${h(t)}</b><p>${h(d)}</p></div><span></span></li>`).join('')}</ol>`;
  if (L.tab === 'plan') {
    body = `<div class="grid2"><div><h4 class="insp-h">Rules: logical axis → mesh axes</h4><table class="table"><tbody>${RULES.map(([k, m]) => `<tr><td class="mono">${k}</td><td class="mono">${m.length ? m.join(' × ') : 'replicated'}</td></tr>`).join('')}</tbody></table></div>
      <div><h4 class="insp-h">Checks</h4><ul class="checks">${X.checks.map(([c, t]) => `<li><span class="tick ${c ? 'ok' : 'no'}">${c ? '✓' : '!'}</span>${h(t)}</li>`).join('')}</ul></div></div>
      <table class="table"><thead><tr><th>Parameter</th><th>Shape</th><th>Logical axes</th><th>JAX PartitionSpec</th><th>PyTorch placement</th><th>Per-device shard</th><th class="num">Bytes / device</th></tr></thead><tbody>${X.ps.map(([n, shape, axes, count]) => { const sh = shardShape(shape, axes, X.m); const per = sh.reduce((p, x) => p * x, 1) * 2 * count; return `<tr><td class="mono">${h(n)}${count > 1 ? ` <span class="note">× ${count}</span>` : ''}</td><td class="mono">${shape.map(fmt).join(' × ')}</td><td class="mono">(${axes.join(', ')})</td><td class="mono">${h(spec(axes))}</td><td class="mono small">${axes.map((x) => RULE[x].includes('tensor') ? 'Shard(tensor)' : RULE[x].includes('fsdp') ? 'Shard(dp)' : '').filter(Boolean).join(' + ') || 'Replicate'}</td><td class="mono">${sh.map((x) => fmt(Math.ceil(x))).join(' × ')}</td><td class="num">${gb(per)}</td></tr>`; }).join('')}</tbody></table>
      <p class="note">BF16 weights only. Parameters total ${si(X.ps.reduce((p, [, s, , c]) => p + s.reduce((q, x) => q * x, 1) * c, 0))} (${X.a.name}). The same rule table drives both backends, so switching frameworks never changes how the model is partitioned.</p>`;
  }
  const fwCmp = [['Model definition', 'cx.Module with logical axes', 'same'], ['Parallelism', 'DTensor TP + FSDP2 (fully_shard)', 'NamedSharding + jit (GSPMD), shard_map for custom kernels'], ['Compile', 'torch.compile per block', 'XLA, whole step, persistent cache'], ['Checkpoints', 'torch DCP', 'Orbax'], ['Data', 'Ray Data → torch tensors', 'Ray Data or Grain → jax arrays'], ['Hardware', 'NVIDIA, AMD GPUs', 'GPUs and TPUs'], ['Kernels', 'FlashAttention 3, Triton, Transformer Engine', 'Pallas, cuDNN fused attention'], ['Runtime', 'Ray: one process per GPU', 'Ray: one process per host']];
  const lossT = [], lossJ = [];
  for (let i = 1; i <= 50; i++) { const s = i * 400, base = 2.0 + 1.6 * Math.exp(-s / 2500) + 0.02 * Math.sin(i); lossT.push([s, base]); lossJ.push([s, base * (1 + 0.0025 * Math.sin(i * 2.3))]); }
  return head('Crucible library', 'The SDK under every job: one model and job spec, lowered to PyTorch or JAX, launched and supervised on Ray. Researchers pick a framework per job; partitioning, checkpoints and the platform stay the same.', 'Models are written once against cx.Module and cx.ops and annotate tensors with logical axis names (batch, embed, heads, mlp, vocab). A rule table maps logical axes to mesh axes (data, fsdp, tensor). The torch backend turns rules into DTensor placements and FSDP2; the JAX backend turns them into NamedSharding and lets XLA partition the step. Ray provides placement, process launch, failure supervision and data. Checkpoints use a shared layout, so a model trained in one framework can be fine-tuned or served from the other. Open-source libraries such as MaxText, AXLearn and TorchTitan use the same ideas.') + `
  <div class="grid">
    <div class="card c12"><h3>Layers</h3><div class="stackdia">${[
      ['Your code', ['cx.train.Job', 'cx.rl.GRPO', 'cx.serve.deploy', 'custom layers, rewards, rules'], 'u'],
      ['Crucible core', ['Spec + validation', 'Logical-axis sharding', 'Planner (memory, layout)', 'cx.ckpt format', 'Metrics + tracing'], 'c'],
      ['Framework backends', ['PyTorch: DTensor, FSDP2, torch.compile, DCP', 'JAX: Mesh, NamedSharding, jit, Orbax'], 'f'],
      ['Runtime', ['Ray: placement groups, actors, Ray Data, Ray Serve, supervision'], 'r'],
      ['Hardware', ['H100 / H200 / B200 GPUs', 'TPU (JAX backend)', 'NCCL / InfiniBand'], 'h'],
    ].map(([t, items, k]) => `<div class="sd sd-${k}"><b>${t}</b><div>${items.map((x) => `<span>${h(x)}</span>`).join('')}</div></div>`).join('')}</div></div>
    <div class="card c12"><h3>Compile a job</h3><div class="fields">
      <label class="field">Model${sel('arch', ['core-8b', 'coder-34b', 'core-70b'].map((k) => [k, E.ARCH[k].name]))}</label>
      <label class="field">Framework${sel('fw', [['jax', 'JAX'], ['torch', 'PyTorch']])}</label>
      <label class="field">data${sel('data', [1, 2, 4, 8].map((n) => [n, n]))}</label>
      <label class="field">fsdp${sel('fsdp', [8, 16, 32, 64, 128].map((n) => [n, n]))}</label>
      <label class="field">tensor${sel('tensor', [1, 2, 4, 8].map((n) => [n, n]))}</label>
      <div class="field">Result<span class="big-sm">${fmt(X.n)} devices · ${gb(X.mem.total)}/device · ${ok ? pill('ok', 'Ready') : pill('deny', X.mem.total > 80e9 * 0.92 ? 'Out of memory' : 'Shape error')}</span></div></div>
      ${seg('libtab', L.tab, tabs)}${body}
      <div class="row"><button class="btn primary" data-act="lib-submit" ${ok ? '' : 'disabled'}>Submit on Ray</button><span class="note">Also from the terminal: <code>crucible build ${L.arch} --framework ${L.fw} --mesh ${L.data}x${L.fsdp}x${L.tensor}</code></span></div></div>
    <div class="card c7"><h3>Parity: same model, same data, two frameworks</h3>${xyChart([{ name: 'PyTorch backend', color: C.blue, pts: lossT }, { name: 'JAX backend', color: C.purple, dash: true, pts: lossJ }], { xl: 'step', fy: (v) => v.toFixed(2), ymin: 1.8, ymax: 3.8, w: 760, hgt: 220 })}
      ${glist([['Logits, first batch', 'max abs diff 1.9e-3 (BF16), 4.1e-6 (FP32)'], ['Loss at 20K steps', 'within 0.25%'], ['Step time, 1,024 H100', 'PyTorch 1.00 · JAX 0.97 (XLA fuses the norm and residual paths)'], ['Checkpoint round trip', 'torch → cx.ckpt → jax → torch: bitwise identical']])}
      <p class="note">Parity runs nightly in CI on a 1B model; a regression blocks backend releases.</p></div>
    <div class="card c5"><h3>Backends compared</h3><table class="table"><thead><tr><th></th><th>PyTorch</th><th>JAX</th></tr></thead><tbody>${fwCmp.map(([k, t, j]) => `<tr><td><b>${k}</b></td><td class="small">${h(t)}</td><td class="small">${h(j === 'same' ? t : j)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card c6"><h3>Package</h3><pre class="code insp-code">${h(`crucible/
  spec/        JobSpec, ModelSpec, validation
  mesh/        cx.Mesh, topology-aware device order
  shard/       logical axes, rule tables, constrain()
  models/      Transformer, MoE, vision encoders (one definition)
  ops/         dispatch to torch or jax.numpy; fused kernels
  backends/
    torch/     DTensor plans, FSDP2, torch.compile, DCP
    jax/       NamedSharding, jit/shard_map, Orbax, Pallas
  runtime/
    ray/       placement, launch, supervise, Ray Data, Ray Serve
  train/ rl/ serve/   recipes on top of the above
  ckpt/        framework-neutral layout + converters
  plugins/     entry points for custom layers, rewards, rules`)}</pre></div>
    <div class="card c6"><h3>Extension points</h3><pre class="code insp-code">${h(`# a custom sharding rule: shard experts over a new axis
rules = cx.shard.DEFAULT_RULES | {"expert": ("expert",)}
mesh  = cx.Mesh(data=4, expert=8, tensor=4)

# a custom layer works in both backends via cx.ops
@cx.register_layer("rmsnorm_fused")
class FusedRMSNorm(cx.Module):
    def __call__(self, x):
        return cx.ops.kernel("rmsnorm", x, self.scale)   # Triton on torch, Pallas on jax

# a custom reward for RL recipes
@cx.rl.reward
def passes_tests(sample) -> float:
    return cx.sandbox.run(sample.code, sample.meta["tests"]).pass_rate`)}</pre></div>
  </div>`;
};
CLICKS.push(['libtab', (k) => { S.lib.tab = k; }]);
ACTIONS['lib-submit'] = () => {
  const L = S.lib, X = lower(L);
  ctx.F.event(Date.now(), `${L.fw}-${L.arch}`, 'submitted', `Library job: ${X.a.name} on ${L.fw === 'jax' ? 'JAX' : 'PyTorch'}, mesh ${L.data}×${L.fsdp}×${L.tensor} (${fmt(X.n)} devices), placement group requested on Ray.`);
  toast(`Submitted on Ray: ${fmt(X.n)} devices, ${L.fw === 'jax' ? 'JAX' : 'PyTorch'} backend`);
};
