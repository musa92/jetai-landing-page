/* How FSDP works: one training step on 4 GPUs and 4 layers, played event by
   event. Each GPU owns a quarter of every layer; layers are gathered just in
   time, freed after use, and gradients are reduce-scattered back to owners.
   Strategy switch compares DDP, ZeRO-2 (SHARD_GRAD_OP) and FSDP (FULL_SHARD). */
import { E, h, fmt, gb, ctx, S, VIEWS, ACTIONS, CLICKS, head, pill, stack, seg, C, ui } from './core.js?v=20261030-5';

const N = 4, L = 4;
S.fsdp = S.fsdp || { mode: 'full', i: 0, play: false, arch: 'core-70b', gpus: 64 };
const MODES = { ddp: 'DDP', grad: 'ZeRO-2 (SHARD_GRAD_OP)', full: 'FSDP (FULL_SHARD)' };

/* Build the event list for a strategy. Each event: what runs on the compute and
   NCCL streams, and the resulting state of params and grads on every GPU. */
function events(mode) {
  const ev = [];
  const st = { full: new Set(), gradFull: new Set(), gradShard: new Set(), opt: false };
  const snap = (e) => ev.push({ ...e, full: new Set(st.full), gradFull: new Set(st.gradFull), gradShard: new Set(st.gradShard), opt: st.opt });
  if (mode === 'ddp') {
    for (let l = 0; l < L; l++) st.full.add(l);
    snap({ t: 'Start', d: 'DDP: every GPU holds the full model, full gradients and full optimizer state. Nothing to gather.', comp: null, comm: null });
    for (let l = 0; l < L; l++) snap({ t: `Forward layer ${l}`, d: 'Each GPU runs its own micro-batch through its full copy.', comp: `F${l}`, comm: null });
    for (let l = L - 1; l >= 0; l--) { st.gradFull.add(l); snap({ t: `Backward layer ${l}`, d: l < L - 1 ? `Gradients of layer ${l + 1} are already in a bucket being all-reduced while layer ${l} computes.` : 'Backward starts at the last layer.', comp: `B${l}`, comm: l < L - 1 ? `AR${l + 1}` : null }); }
    snap({ t: 'All-reduce last bucket', d: 'Every GPU ends with the same averaged gradients for the whole model: 2(N−1)/N × model size sent per GPU.', comp: null, comm: 'AR0' });
    st.opt = true; snap({ t: 'Optimizer step', d: 'Every GPU applies the same Adam update to its full copy. Memory: 16 bytes per parameter on every GPU.', comp: 'OPT', comm: null });
    return ev;
  }
  snap({ t: 'Start', d: 'Each GPU stores only its quarter of every layer, and the matching quarter of the Adam state.', comp: null, comm: null });
  for (let l = 0; l < L; l++) {
    st.full.add(l);
    snap({ t: `All-gather layer ${l}`, d: l === 0 ? 'Each GPU sends its quarter and receives the other three: layer 0 is now whole on every GPU.' : `Prefetch: layer ${l} is gathered on the NCCL stream while layer ${l - 1} computes, so the transfer is hidden.`, comp: l ? `F${l - 1}` : null, comm: `AG${l}` });
    if (mode === 'full' && l > 0) { st.full.delete(l - 1); snap({ t: `Free layer ${l - 1}`, d: `reshard_after_forward: layer ${l - 1} finished its forward, so its gathered copy is dropped and only the owned quarter stays. At most two whole layers are ever resident.`, comp: null, comm: null }); }
    if (l === L - 1) snap({ t: `Forward layer ${l}`, d: mode === 'full' ? 'Last layer computes and stays gathered: backward starts with it.' : 'Last layer computes. ZeRO-2 keeps every gathered layer for the backward pass.', comp: `F${l}`, comm: null });
  }
  for (let l = L - 1; l >= 0; l--) {
    if (mode === 'full' && !st.full.has(l)) { st.full.add(l); snap({ t: `All-gather layer ${l} again`, d: 'Backward needs the full weights, so FULL_SHARD gathers each layer a second time (the price of the lowest memory). In practice this is prefetched while the layer above computes its backward.', comp: null, comm: `AG${l}` }); }
    st.gradFull.add(l);
    snap({ t: `Backward layer ${l}`, d: `Full gradients for layer ${l} exist briefly on every GPU.`, comp: `B${l}`, comm: null });
    st.gradFull.delete(l); st.gradShard.add(l);
    if (mode === 'full') st.full.delete(l);
    snap({ t: `Reduce-scatter layer ${l}`, d: `Gradients are summed across GPUs and each GPU keeps only its quarter: (N−1)/N × layer size sent. It runs while the next layer down computes.${mode === 'full' ? ' The gathered weights are freed too.' : ''}`, comp: null, comm: `RS${l}` });
  }
  if (mode === 'grad') for (let l = 0; l < L; l++) st.full.delete(l);
  st.opt = true;
  snap({ t: 'Optimizer step on shards', d: 'Each GPU runs Adam only on its quarter: its params, its gradient shard, its m and v. No communication.', comp: 'OPT', comm: null });
  return ev;
}

function gpuCard(g, e, mode) {
  const layer = (l) => {
    const segs = Array.from({ length: N }, (_, k) => {
      const own = k === g, full = e.full.has(l);
      const p = own || full ? (own ? 'own' : 'gath') : 'none';
      const gr = e.gradFull.has(l) ? 'gfull' : e.gradShard.has(l) && own ? 'gshard' : '';
      return `<i class="p-${p} ${gr}" title="${own ? 'owned shard' : full ? 'gathered copy' : 'not on this GPU'}"></i>`;
    }).join('');
    return `<div class="fl"><span>L${l}</span><div class="fsegs">${segs}</div></div>`;
  };
  const params = Array.from({ length: L }, (_, l) => (e.full.has(l) ? 1 : 1 / N)).reduce((a, b) => a + b, 0) / L;
  const grads = Array.from({ length: L }, (_, l) => (e.gradFull.has(l) ? 1 : e.gradShard.has(l) ? 1 / N : 0)).reduce((a, b) => a + b, 0) / L;
  const opt = mode === 'ddp' ? 1 : 1 / N;
  const used = 2 * params + 2 * grads + 12 * opt, max = 16;
  return `<div class="fgpu"><b>GPU ${g}</b>${Array.from({ length: L }, (_, l) => layer(l)).join('')}<div class="fmem"><div style="width:${(used / max * 100).toFixed(0)}%"></div></div><small>${(used / max * 100).toFixed(0)}% of DDP memory</small></div>`;
}

function lanes(evs, i) {
  const cell = (k, x, j) => (x ? `<span class="lb ${k} ${j === i ? 'on' : j < i ? 'past' : ''}" title="${x}">${x}</span>` : `<span class="lb gap ${j === i ? 'on' : ''}"></span>`);
  return `<div class="lanes"><div class="lane"><em>Compute</em>${evs.map((e, j) => cell('cp', e.comp, j)).join('')}</div><div class="lane"><em>NCCL</em>${evs.map((e, j) => cell('cm', e.comm, j)).join('')}</div></div>`;
}

VIEWS.fsdp = () => {
  const F = S.fsdp, evs = events(F.mode), i = Math.min(F.i, evs.length - 1), e = evs[i];
  const a = E.ARCH[F.arch], gpus = +F.gpus;
  const base = { hw: 'h100', tp: 1, pp: 1, cp: 1, dp: gpus, micro: 1, accum: 1, recompute: 'selective', seq: 4096, chunkedLoss: true };
  const mem = { ddp: E.trainMemory(a, { ...base, zero: 0 }), grad: E.trainMemory(a, { ...base, zero: 2 }), full: E.trainMemory(a, { ...base, zero: 3 }) };
  const shard = a.params * 2;
  const vol = { ddp: 2 * (gpus - 1) / gpus * shard, grad: (gpus - 1) / gpus * shard * 2, full: (gpus - 1) / gpus * shard * 3 };
  const sel = (k, opts) => `<select data-bind="fsdp.${k}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(F[k]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  return head('How FSDP works', 'One training step with Fully Sharded Data Parallel, event by event. Each GPU owns a slice of every layer; whole layers exist only while they are being used.', 'FSDP (ZeRO-3) shards parameters, gradients and optimizer state across data-parallel ranks. Before a layer runs, an all-gather rebuilds it on every GPU; after the forward it is freed again (reshard_after_forward). Backward gathers it once more, computes gradients, and a reduce-scatter sums them and leaves each GPU only its own slice. The optimizer then updates each slice locally. Prefetching the next layer on a separate NCCL stream hides the communication behind compute. Communication is about 1.5× DDP; memory per GPU falls roughly as 1/N.') + `
  <div class="grid">
    <div class="card c12"><div class="row between">${seg('fsdpmode', F.mode, Object.entries(MODES))}<div class="row"><button class="btn" data-fsdpstep="-1" ${i === 0 ? 'disabled' : ''}>‹ Back</button><button class="btn primary" data-act="fsdp-play">${F.play ? 'Pause' : i >= evs.length - 1 ? 'Replay' : 'Play'}</button><button class="btn" data-fsdpstep="1" ${i >= evs.length - 1 ? 'disabled' : ''}>Next ›</button></div></div>
      <div class="fstep"><span class="fn">${i + 1}/${evs.length}</span><div><b>${h(e.t)}</b><p>${h(e.d)}</p></div></div>
      <div class="fgpus">${Array.from({ length: N }, (_, g) => gpuCard(g, e, F.mode)).join('')}</div>
      <div class="lin-foot"><span class="lg"><i style="background:${C.blue}"></i>Owned parameter shard</span><span class="lg"><i style="background:rgba(10,132,255,.35)"></i>Gathered copy (temporary)</span><span class="lg"><i style="background:${C.amber}"></i>Full gradient (temporary)</span><span class="lg"><i style="background:${C.green}"></i>Owned gradient shard</span><span class="lg"><i style="background:var(--fill-2)"></i>Not on this GPU</span></div>
      <h4 class="sub-h">Two CUDA streams</h4>${lanes(evs, i)}<p class="note">AG = all-gather, RS = reduce-scatter, AR = all-reduce, F/B = forward/backward, OPT = optimizer. Communication on the NCCL lane overlaps compute on the same column.</p></div>
    <div class="card c7"><h3>At real scale <span class="right">${sel('arch', ['core-8b', 'coder-34b', 'core-70b'].map((k) => [k, E.ARCH[k].name]))} on ${sel('gpus', [8, 16, 64, 256, 1024].map((n) => [n, n + ' GPUs']))}</span></h3>
      <table class="table"><thead><tr><th>Strategy</th><th class="num">Params</th><th class="num">Grads</th><th class="num">Optimizer</th><th class="num">Activations</th><th class="num">Per GPU</th><th class="num">Fits 80 GB</th><th class="num">Sent per GPU per step</th></tr></thead><tbody>${Object.entries(MODES).map(([k, n]) => { const m = mem[k]; return `<tr${k === F.mode ? ' class="sel"' : ''}><td>${n}</td><td class="num">${gb(m.weights)}</td><td class="num">${gb(m.grads)}</td><td class="num">${gb(m.optim)}</td><td class="num">${gb(m.acts)}</td><td class="num"><b>${gb(m.total)}</b></td><td class="num">${m.total <= 80e9 ? pill('ok', 'Yes') : pill('deny', 'No')}</td><td class="num">${gb(vol[k])}</td></tr>`; }).join('')}</tbody></table>
      <p class="note">Same model, same micro-batch (4,096 tokens, selective recompute). FSDP trades about 1.5× the DDP traffic for ${(mem.ddp.total / mem.full.total).toFixed(0)}× less memory per GPU here. HSDP shards inside a node and replicates across nodes to keep the extra traffic on NVLink.</p></div>
    <div class="card c5"><h3>FSDP2 in PyTorch</h3><pre class="code">${h(`from torch.distributed.fsdp import fully_shard, MixedPrecisionPolicy
from torch.distributed.device_mesh import init_device_mesh

mesh = init_device_mesh("cuda", (${gpus},))
mp = MixedPrecisionPolicy(param_dtype=torch.bfloat16,
                          reduce_dtype=torch.float32)

for block in model.layers:          # one unit per block
    fully_shard(block, mesh=mesh, mp_policy=mp,
                reshard_after_forward=${F.mode === 'grad' ? 'False' : 'True'})
fully_shard(model, mesh=mesh, mp_policy=mp)

# HSDP: shard within a node, replicate across nodes
# mesh = init_device_mesh("cuda", (${Math.max(1, gpus / 8)}, 8))`)}</pre>
      <ul class="why"><li>Wrap per transformer block: that is the unit gathered and freed.</li><li>Parameters are DTensors sharded on dim 0, so LoRA and frozen weights mix freely.</li><li>Reduce in FP32 for stable gradients; compute in BF16.</li></ul></div>
  </div>`;
};

CLICKS.push(['fsdpmode', (k) => { S.fsdp.mode = k; S.fsdp.i = 0; S.fsdp.play = false; }]);
CLICKS.push(['fsdpstep', (d) => { S.fsdp.i = Math.max(0, S.fsdp.i + +d); S.fsdp.play = false; }]);
let timer = null;
ACTIONS['fsdp-play'] = () => {
  const F = S.fsdp, n = events(F.mode).length;
  if (F.play) { F.play = false; clearInterval(timer); return; }
  if (F.i >= n - 1) F.i = 0;
  F.play = true; clearInterval(timer);
  timer = setInterval(() => {
    if (S.view !== 'fsdp' || !F.play) { clearInterval(timer); F.play = false; return; }
    F.i++; if (F.i >= events(F.mode).length - 1) { F.play = false; clearInterval(timer); }
    ui.render();
  }, 1300);
};
