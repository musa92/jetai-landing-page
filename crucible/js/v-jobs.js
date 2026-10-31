/* Job submission for the CLI: a workspace of job specs and code, a small YAML
   parser with line-numbered validation, and the submit pipeline that shows
   how a job is decomposed onto the fleet: code package, data shards per
   rank, CPU preprocessing tasks, GPU placement, Ray cluster, live logs. */
import { E, ctx, S, me, ui, si, gb, fmt } from './core.js?v=20261031-4';

/* ───────────────────────── workspace ───────────────────────── */

export const FS = S.fs = S.fs || {
  'jobs/sft-8b.yaml': `apiVersion: crucible.acme.dev/v1
kind: TrainingJob
metadata:
  name: sft-core-8b-support
  team: assistant
  priority: P1
spec:
  model: core-8b-base-v5
  method: sft
  framework: torch
  code:
    workingDir: ./src
    entrypoint: python train_sft.py --config configs/sft.yaml
  data:
    dataset: assistant-sft-v9
    seqLen: 8192
    packing: true
    preprocessCpus: 256
  resources:
    gpus: 64
    gpuType: h100
  parallel:
    layout: auto
  checkpoint:
    every: 10m
    keep: 3
  maxSteps: 3000
`,
  'jobs/grpo-70b.yaml': `apiVersion: crucible.acme.dev/v1
kind: RLJob
metadata:
  name: grpo-core-70b-math
  team: foundation
  priority: P0
spec:
  policy: core-70b-sft-v3.2
  algorithm: grpo
  code:
    workingDir: ./src
    entrypoint: python rl_math.py
  data:
    dataset: math-code-verifiable-v4
  rollout:
    engine: vllm
    gpus: 128
    tensorParallel: 4
    samplesPerPrompt: 16
  trainer:
    gpus: 128
    gpuType: h200
  reward:
    module: reward.py
    sandboxes: 1024
  maxSteps: 800
`,
  'jobs/embed-docs.yaml': `apiVersion: crucible.acme.dev/v1
kind: BatchJob
metadata:
  name: embed-support-docs
  team: search
  priority: P2
spec:
  code:
    workingDir: ./src
    entrypoint: python embed.py
  input: s3://acme-data/support-docs/2026-10/
  output: s3://acme-index/support-docs-emb/
  pipeline:
    - stage: read
      cpus: 64
    - stage: chunk_and_tokenize
      cpus: 192
    - stage: embed
      gpus: 16
      gpuType: l40s
      batchSize: 512
    - stage: write
      cpus: 32
`,
  'src/train_sft.py': `import crucible as cx

def main(cfg):
    model = cx.models.load(cfg.model)                    # framework-neutral
    ds = cx.data.stream(cfg.data.dataset, seq_len=cfg.data.seq_len, packing=True)
    trainer = cx.train.SFT(model, ds, layout="auto",
                           checkpoint=cx.ckpt.Every(cfg.checkpoint.every))
    trainer.fit(max_steps=cfg.max_steps)

if __name__ == "__main__":
    main(cx.config.from_job())                           # reads the submitted YAML
`,
  'src/rl_math.py': `import crucible as cx
from reward import score

job = cx.rl.GRPO.from_job(reward=score)                  # rollout, trainer, sandboxes from the YAML
job.fit()
`,
  'src/reward.py': `import crucible as cx

@cx.rl.reward
def score(sample) -> float:
    if sample.task == "math":
        return float(cx.verify.math_equal(sample.answer, sample.meta["answer"]))
    result = cx.sandbox.run(sample.code, tests=sample.meta["tests"], timeout_s=20)
    return result.pass_rate if result.ok else None       # None: dropped, not scored 0
`,
  'src/embed.py': `import ray, crucible as cx

ds = ray.data.read_parquet(cx.job.input)                                  # CPU tasks
ds = ds.flat_map(cx.text.chunk, num_cpus=1)                               # CPU tasks
ds = ds.map_batches(cx.text.tokenize, batch_size=1024, num_cpus=1)
ds = ds.map_batches(cx.embed.Encoder, batch_size=512, num_gpus=1,         # GPU actor pool
                    concurrency=cx.job.stage("embed").gpus)
ds.write_parquet(cx.job.output)                                           # CPU tasks
`,
  'configs/sft.yaml': `lr: 2.0e-5
warmup_steps: 100
schedule: cosine
weight_decay: 0.0
loss_on: responses
`,
};

/* ───────────────────────── YAML (the subset job specs use) ───────────────────────── */

export function parseYaml(text) {
  const lines = text.split('\n').map((raw, i) => ({ raw, n: i + 1, ind: raw.search(/\S/), t: raw.trim() })).filter((l) => l.t && !l.t.startsWith('#'));
  let i = 0;
  const scalar = (v) => (v === 'true' ? true : v === 'false' ? false : /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v) ? +v : v.replace(/^["']|["']$/g, ''));
  const lineOf = {};
  function block(ind, path) {
    if (i < lines.length && lines[i].t.startsWith('- ')) {
      const arr = [];
      while (i < lines.length && lines[i].ind === ind && lines[i].t.startsWith('- ')) {
        const l = lines[i], rest = l.t.slice(2);
        if (/^[\w.-]+:/.test(rest)) {
          // list of maps: "- key: v" then siblings indented 2 more
          const obj = {}, m = rest.match(/^([\w.-]+):\s*(.*)$/);
          obj[m[1]] = scalar(m[2]); lineOf[`${path}[${arr.length}].${m[1]}`] = l.n; i++;
          while (i < lines.length && lines[i].ind === ind + 2 && !lines[i].t.startsWith('- ')) { const mm = lines[i].t.match(/^([\w.-]+):\s*(.*)$/); if (!mm) throw err(lines[i], 'expected key: value'); obj[mm[1]] = scalar(mm[2]); lineOf[`${path}[${arr.length}].${mm[1]}`] = lines[i].n; i++; }
          arr.push(obj);
        } else { arr.push(scalar(rest)); i++; }
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && lines[i].ind === ind) {
      const l = lines[i], m = l.t.match(/^([\w.-]+):\s*(.*)$/);
      if (!m) throw err(l, `expected "key: value", got "${l.t}"`);
      i++;
      const key = path ? `${path}.${m[1]}` : m[1];
      lineOf[key] = l.n;
      if (m[2] === '') { if (i < lines.length && lines[i].ind > ind) obj[m[1]] = block(lines[i].ind, key); else obj[m[1]] = null; }
      else obj[m[1]] = scalar(m[2]);
    }
    if (i < lines.length && lines[i].ind > ind) throw err(lines[i], 'unexpected indentation');
    return obj;
  }
  const err = (l, msg) => Object.assign(new Error(`line ${l.n}: ${msg}`), { line: l.n });
  const doc = block(lines.length ? lines[0].ind : 0, '');
  return { doc, lineOf };
}

const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const VERSIONS = () => E.MODELS.flatMap((m) => m.versions.map((v) => [v[0], m.id]));

/* Validation: [ok, message, line]. Errors stop the submit; warnings do not. */
export function validate(spec, lineOf) {
  const out = [], kind = spec.kind, s = spec.spec || {};
  const L = (p) => lineOf['spec.' + p] || lineOf[p] || 1;
  const need = (p, label) => { if (get(s, p) === undefined) out.push(['error', `${label || p} is required`, L(p)]); };
  if (spec.apiVersion !== 'crucible.acme.dev/v1') out.push(['error', `apiVersion must be crucible.acme.dev/v1`, lineOf.apiVersion || 1]);
  if (!['TrainingJob', 'RLJob', 'BatchJob'].includes(kind)) out.push(['error', `kind must be TrainingJob, RLJob or BatchJob`, lineOf.kind || 1]);
  const md = spec.metadata || {};
  if (!md.name || !/^[a-z0-9-]{3,48}$/.test(md.name)) out.push(['error', 'metadata.name: 3 to 48 lowercase letters, digits or dashes', lineOf['metadata.name'] || 1]);
  if (!E.TEAMS[md.team]) out.push(['error', `metadata.team "${md.team}" is not a tenant (${Object.keys(E.TEAMS).join(', ')})`, lineOf['metadata.team'] || 1]);
  if (md.priority && !['P0', 'P1', 'P2', 'Batch'].includes(md.priority)) out.push(['error', 'metadata.priority must be P0, P1, P2 or Batch', lineOf['metadata.priority']]);
  if (md.priority === 'P0' && !['manager', 'platform'].includes(S.role) && me().team !== md.team) out.push(['warn', 'P0 for another team needs a manager approval; submitted as P1', lineOf['metadata.priority']]);
  need('code.entrypoint', 'spec.code.entrypoint');
  const wd = get(s, 'code.workingDir');
  if (wd && !Object.keys(FS).some((f) => f.startsWith(wd.replace(/^\.\//, '') + '/'))) out.push(['error', `spec.code.workingDir ${wd} is empty`, L('code.workingDir')]);
  const entry = String(get(s, 'code.entrypoint') || '').split(' ').find((x) => x.endsWith('.py'));
  if (entry && wd && !FS[`${wd.replace(/^\.\//, '')}/${entry}`]) out.push(['error', `entrypoint ${entry} not found in ${wd}`, L('code.entrypoint')]);
  const ds = get(s, 'data.dataset');
  if (ds !== undefined) { const d = E.DATASETS.find((x) => x.id === ds); if (!d) out.push(['error', `dataset ${ds} is not in the catalog`, L('data.dataset')]); else if (d.governance !== 'Approved') out.push(['error', `dataset ${ds} is ${d.governance.toLowerCase()} by the governance platform`, L('data.dataset')]); }
  const gpuCheck = (p) => { const g = get(s, p); if (g === undefined) return; if (!(g > 0) || g % 8) out.push(['error', `${p} must be a positive multiple of 8 (whole nodes)`, L(p)]); };
  const hwCheck = (p) => { const t = get(s, p); if (t !== undefined && !E.HW[t]) out.push(['error', `${p} "${t}" unknown (${Object.keys(E.HW).join(', ')})`, L(p)]); };
  if (kind === 'TrainingJob') {
    need('model', 'spec.model'); need('resources.gpus', 'spec.resources.gpus'); gpuCheck('resources.gpus'); hwCheck('resources.gpuType');
    if (s.model && !VERSIONS().some(([v]) => v === s.model)) out.push(['error', `model ${s.model} is not in the registry`, L('model')]);
    if (s.method && !['sft', 'dpo', 'kto', 'lora', 'pretrain'].includes(s.method)) out.push(['error', 'spec.method must be sft, dpo, kto, lora or pretrain', L('method')]);
  }
  if (kind === 'RLJob') {
    need('policy', 'spec.policy'); need('rollout.gpus'); need('trainer.gpus'); gpuCheck('rollout.gpus'); gpuCheck('trainer.gpus'); hwCheck('trainer.gpuType');
    if (s.policy && !VERSIONS().some(([v]) => v === s.policy)) out.push(['error', `policy ${s.policy} is not in the registry`, L('policy')]);
    const rm = get(s, 'reward.module'); if (rm && !FS[`src/${rm}`]) out.push(['error', `reward module src/${rm} not found`, L('reward.module')]);
  }
  if (kind === 'BatchJob') {
    need('input'); need('output'); need('pipeline');
    (s.pipeline || []).forEach((st, k) => { if (!st.cpus && !st.gpus) out.push(['error', `pipeline[${k}] (${st.stage}) needs cpus or gpus`, lineOf[`spec.pipeline[${k}].stage`]]); if (st.gpus) { if (st.gpuType && !E.HW[st.gpuType]) out.push(['error', `pipeline[${k}].gpuType unknown`, lineOf[`spec.pipeline[${k}].gpuType`]]); } });
  }
  const team = E.TEAMS[md.team];
  const gpus = kind === 'RLJob' ? (get(s, 'rollout.gpus') || 0) + (get(s, 'trainer.gpus') || 0) : kind === 'BatchJob' ? (s.pipeline || []).reduce((a, st) => a + (st.gpus || 0), 0) : get(s, 'resources.gpus') || 0;
  if (team && gpus > team.quota) out.push(['warn', `${gpus} GPUs exceeds ${team.name}'s guaranteed ${team.quota}; the excess is borrowed at P2 and preemptible`, L('resources.gpus')]);
  return { issues: out, gpus, errors: out.filter((x) => x[0] === 'error').length };
}

/* ───────────────────────── submit pipeline ───────────────────────── */

let SEQ = 41;
export const SUBMITTED = S.submitted = S.submitted || [];
/* Submission records: what the dashboard shows. Same pipeline whether the terminal or the UI submitted. */
export const SUBS = S.subs = S.subs || [];
const refresh = () => { if (S.view === 'jobs') ui.render(); };

function nodeNames(cl, n, off = 0) { return Array.from({ length: n }, (_, i) => `${cl.slice(0, 6)}-n${String(140 + off + i * 3).padStart(4, '0')}`); }

/* api = { out, setLine, pad, lpad, flag, has, sleep } from the terminal. */
export function jobCommands(api) {
  const { out, setLine, pad, lpad, flag, has, sleep } = api;
  const fileArg = (p) => (p || '').replace(/^\.\//, '');
  const bar = (f, w = 24) => '█'.repeat(Math.round(f * w)) + '░'.repeat(w - Math.round(f * w));

  let cur = null;
  async function step(label, text, ms = 260) { if (cur) { cur.active = label; refresh(); } await sleep(ms); out(`  [ok]✓[/] ${pad(label, 13)}${text}`); if (cur) { cur.steps.push([label, text, Date.now()]); cur.active = null; refresh(); } }

  async function submitTraining(spec, file, dry) {
    const s = spec.spec, md = spec.metadata, hw = s.resources.gpuType || 'h100', gpus = s.resources.gpus;
    const arch = VERSIONS().find(([v]) => v === s.model)[1], a = E.ARCH[arch], seq = s.data.seqLen || 8192;
    const plan = E.plan(a, { hw, gpus, seq, batchTokens: 2 ** 20 * (gpus >= 256 ? 4 : 1), maxResults: 1 }).best[0];
    if (!plan) { out(`[err]✗ no parallel layout fits ${a.name} on ${gpus} × ${E.HW[hw].name}. Add GPUs or use a larger GPU type.[/]`); return; }
    const d = E.DATASETS.find((x) => x.id === s.data.dataset), dp = plan.c.dp, per = d.shards / dp;
    const nodes = gpus / 8, cl = E.CLUSTERS.find((c) => c.hw === hw) || E.CLUSTERS[0];
    const pkg = Object.keys(FS).filter((f) => f.startsWith((s.code.workingDir || './src').replace(/^\.\//, '') + '/') || f.startsWith('configs/'));
    const kb = pkg.reduce((x, f) => x + FS[f].length, 0) / 1024;
    await step('package', `${pkg.length} files, ${kb.toFixed(1)} KB → s3://acme-runtime/pkg/sha256:${(md.name.length * 2654435761 >>> 0).toString(16)}… (runtime_env.working_dir)`);
    await step('resolve', `model ${s.model} (${a.name}) · dataset ${d.id} snapshot #${d.snapshot}, ${si(d.tokens)} tokens, governance approved`);
    await step('plan', `layout TP ${plan.c.tp} · ${plan.c.zero >= 3 ? 'FSDP' : 'DP'} ${plan.c.dp}${plan.c.pp > 1 ? ` · PP ${plan.c.pp}` : ''} · ${plan.c.recompute} recompute · ${gb(plan.mem.total)}/GPU · modeled MFU ${(plan.perf.mfu * 100).toFixed(0)}%`);
    await step('data', `${fmt(d.shards)} shards → ${dp} data-parallel ranks (${per % 1 ? per.toFixed(1) : per} each); TP peers get batches by broadcast`);
    await step('preprocess', `${s.data.preprocessCpus || 128} CPU tasks (Ray Data): read parquet → apply chat template → tokenize → pack to ${fmt(seq)}`);
    await step('admission', `Kueue: ${md.team} quota ${E.TEAMS[md.team].quota} GPUs, ${gpus} requested, priority ${md.priority || 'P2'} → admitted`);
    await step('placement', `placement group ${nodes} × {GPU: 8, CPU: 96} STRICT_SPREAD on ${cl.id} (one rail group)`);
    out('');
    out(`  [dim]${pad('node', 16)}${pad('ranks', 12)}${pad('role', 26)}shards[/]`);
    const names = nodeNames(cl.id, Math.min(nodes, 6));
    names.forEach((n, i) => { const r0 = i * 8; out(`  ${pad(n, 16)}${pad(`${r0}-${r0 + 7}`, 12)}${pad(plan.c.tp > 1 ? `TP group${8 / plan.c.tp > 1 ? 's' : ''} × ${8 / plan.c.tp}` : '8 FSDP ranks', 26)}${Math.round(r0 / plan.c.tp * per)}-${Math.round((r0 + 8) / plan.c.tp * per) - 1}`); });
    if (nodes > 6) out(`  [dim]… ${nodes - 6} more nodes[/]`);
    out(`  ${pad('cpu pool', 16)}${pad('-', 12)}${pad(`${Math.ceil((s.data.preprocessCpus || 128) / 64)} × 64-core nodes`, 26)}preprocess tasks`);
    out('');
    cur.topo = { kind: 'train', cluster: cl.id, hw, nodes, names: nodeNames(cl.id, nodes), tp: plan.c.tp, dp, per, shards: d.shards, dataset: d.id, cpus: s.data.preprocessCpus || 128, mem: plan.mem.total, mfu: plan.perf.mfu, tps: plan.perf.tps, gpus, seq };
    if (dry) { out('[warn]--dry-run: nothing was started.[/]'); cur.state = 'dry run'; refresh(); return; }
    const id = `${md.name}-${(SEQ++).toString(36)}`;
    const job = { id, name: md.name, kind: s.method === 'pretrain' ? 'pretrain' : 'post', method: (s.method || 'sft').toUpperCase(), arch, team: md.team, owner: me().name, cluster: cl.id, state: 'queued', priority: md.priority || 'P2', cfg: { ...plan.c, hw, chunkedLoss: true }, steps: s.maxSteps || 1000, started: null, step: 0, base: s.model, dataset: d.id, wait: 8, ckptEvery: 600, file };
    ctx.F.jobs.unshift(job); SUBMITTED.unshift(id);
    ctx.F.event(Date.now(), id, 'submitted', `${me().name} submitted ${file}: ${gpus} × ${E.HW[hw].name}, TP ${plan.c.tp}, ${plan.c.zero >= 3 ? 'FSDP' : 'DP'} ${plan.c.dp}.`);
    await step('ray', `KubeRay cluster ray-${id}: head + ${nodes} GPU workers + ${Math.ceil((s.data.preprocessCpus || 128) / 64)} CPU workers ready`, 500);
    await step('launch', `TorchTrainer(${gpus} workers) · init_process_group(nccl) · ${gpus} ranks connected`, 400);
    job.state = 'running'; job.started = Date.now(); cur.state = 'running'; cur.jobId = id; refresh();
    ctx.F.event(Date.now(), id, 'admitted', `Running on ${cl.id}: ${gpus} GPUs, ${nodes} nodes.`);
    ui.renderChrome();
    out(`\n[ok]● ${id} running[/]  · crucible job logs ${id} · crucible job describe ${id}`);
    await tail(job, 4);
  }

  async function tail(job, n = 6) {
    const p = E.trainStep(E.ARCH[job.arch], job.cfg);
    for (let k = 0; k < n; k++) {
      await sleep(350);
      job.step = Math.min(job.steps, job.step + 1 + Math.round(k * 0.5));
      const loss = 1.12 + 0.75 * Math.exp(-job.step / (job.steps * 0.18));
      out(`  [dim]${new Date().toISOString().slice(11, 19)}[/] rank0  step ${lpad(job.step, 5)}/${job.steps}  loss ${loss.toFixed(3)}  ${si(p.tps)} tok/s  MFU ${(p.mfu * 100).toFixed(1)}%  mem ${gb(E.trainMemory(E.ARCH[job.arch], job.cfg).total)}`);
    }
  }

  async function submitRL(spec, file, dry) {
    const s = spec.spec, md = spec.metadata, hw = s.trainer.gpuType || 'h200', arch = VERSIONS().find(([v]) => v === s.policy)[1], a = E.ARCH[arch];
    const engines = s.rollout.gpus / (s.rollout.tensorParallel || 4), cl = E.CLUSTERS.find((c) => c.hw === hw) || E.CLUSTERS[0];
    await step('package', `${Object.keys(FS).filter((f) => f.startsWith('src/')).length} files incl. reward module ${s.reward.module}`);
    await step('resolve', `policy ${s.policy} (${a.name}) · prompts ${s.data.dataset}`);
    await step('roles', `rollout ${engines} × ${s.rollout.engine} (TP ${s.rollout.tensorParallel}) · trainer FSDP ${s.trainer.gpus} GPUs · ${fmt(s.reward.sandboxes)} sandboxes · reference colocated with trainer`);
    await step('placement', `pg-rollout ${engines} × {GPU: ${s.rollout.tensorParallel}} STRICT_PACK · pg-trainer ${s.trainer.gpus / 8} × {GPU: 8} · pg-verify ${s.reward.sandboxes} × {CPU: 1} SPREAD`);
    await step('weights', `trainer → engines over NCCL broadcast, bucketed: ${gb(a.params * 2)} per step`);
    cur.topo = { kind: 'rl', cluster: cl.id, hw, engines, tpE: s.rollout.tensorParallel || 4, rollout: s.rollout.gpus, trainer: s.trainer.gpus, sandboxes: s.reward.sandboxes, engine: s.rollout.engine, names: nodeNames(cl.id, (s.rollout.gpus + s.trainer.gpus) / 8), dataset: s.data.dataset, gpus: s.rollout.gpus + s.trainer.gpus };
    if (dry) { out('[warn]--dry-run: nothing was started.[/]'); cur.state = 'dry run'; refresh(); return; }
    const id = `${md.name}-${(SEQ++).toString(36)}`;
    const job = { id, name: md.name, kind: 'rl', method: (s.algorithm || 'grpo').toUpperCase(), arch, team: md.team, owner: me().name, cluster: cl.id, state: 'running', priority: md.priority || 'P1', cfg: { hw, tp: 4, pp: 1, cp: 1, dp: s.trainer.gpus / 4, micro: 1, accum: 1, zero: 3, recompute: 'full', vpp: 1, seq: 16384, fp8: false, chunkedLoss: true }, rl: { rolloutGpus: s.rollout.gpus, trainGpus: s.trainer.gpus, rmGpus: 0, verifiers: s.reward.sandboxes, group: s.rollout.samplesPerPrompt || 16, promptsPerStep: 256, maxLen: 16384, async: 1, engine: s.rollout.engine === 'sglang' ? 'SGLang 0.5' : 'vLLM 0.11', sync: 'NCCL broadcast, bucketed' }, steps: s.maxSteps || 800, started: Date.now(), step: 0, base: s.policy, dataset: s.data.dataset, file };
    ctx.F.jobs.unshift(job); SUBMITTED.unshift(id);
    ctx.F.event(Date.now(), id, 'admitted', `${me().name} submitted ${file}: RL with ${s.rollout.gpus + s.trainer.gpus} GPUs.`);
    await step('ray', `driver started; ${engines} engines loaded weights; ${s.trainer.gpus} trainer ranks connected`, 500);
    cur.state = 'running'; cur.jobId = id; refresh();
    ui.renderChrome();
    out(`\n[ok]● ${id} running[/]  · crucible job describe ${id}`);
  }

  async function submitBatch(spec, file, dry) {
    const s = spec.spec, md = spec.metadata;
    const rows = 18.4e6;
    await step('package', `src/embed.py + deps`);
    await step('input', `${s.input} · 2,304 parquet files · ${si(rows)} rows`);
    out('\n  [dim]operator               resources        tasks/actors[/]');
    s.pipeline.forEach((st) => out(`  ${pad(st.stage, 23)}${pad(st.gpus ? `${st.gpus} × ${E.HW[st.gpuType || 'l40s'].name}` : `${st.cpus} CPUs`, 17)}${st.gpus ? `${st.gpus} GPU actors, batch ${st.batchSize || 256}` : `${st.cpus} tasks in flight`}`));
    out('');
    cur.topo = { kind: 'batch', input: s.input, output: s.output, rows, stages: s.pipeline.map((st) => ({ ...st, frac: 0 })), gpus: s.pipeline.reduce((x, st) => x + (st.gpus || 0), 0), cpus: s.pipeline.reduce((x, st) => x + (st.cpus || 0), 0) };
    if (dry) { out('[warn]--dry-run: nothing was started.[/]'); cur.state = 'dry run'; refresh(); return; }
    const id = `${md.name}-${(SEQ++).toString(36)}`;
    SUBMITTED.unshift(id); cur.jobId = id; cur.state = 'running';
    ctx.F.event(Date.now(), id, 'submitted', `${me().name} submitted ${file}: Ray Data batch job.`);
    await step('ray', `cluster ray-${id}: ${Math.ceil(s.pipeline.reduce((x, st) => x + (st.cpus || 0), 0) / 64)} CPU nodes + ${Math.ceil(s.pipeline.reduce((x, st) => x + (st.gpus || 0), 0) / 8)} GPU nodes`, 400);
    out('');
    const start = T0(), idx = [];
    for (const st of s.pipeline) { idx.push(api.lineCount()); out(''); }
    const rate = { read: 1.0, chunk_and_tokenize: 0.92, embed: 0.84, write: 0.8 };
    for (let k = 1; k <= 12; k++) {
      await sleep(300);
      if (cur.topo) refresh();
      s.pipeline.forEach((st, j) => { const f = Math.min(1, (k / 12) * (rate[st.stage] || 0.8) * (1 + 0.05 * j) - j * 0.04); const ff = Math.max(0, k === 12 ? 1 : f); cur.topo.stages[j].frac = ff; cur.topo.stages[j].backpressure = j === 2 && k < 12 && k > 3; setLine(idx[j], `  ${pad(st.stage, 23)}${bar(ff)} ${lpad((ff * 100).toFixed(0), 3)}%  ${lpad(si(rows * ff), 6)} rows  ${st.gpus ? `${st.gpus} actors · GPU util ${80 + j}%` : `${st.cpus} tasks`}${j === 2 && k < 12 && k > 3 ? '  [dim]backpressure on read[/]' : ''}`); });
    }
    cur.state = 'succeeded'; cur.ended = Date.now(); refresh();
    out(`\n[ok]✓ ${id} succeeded[/] in ${Math.round((T0() - start) / 1000 * 210)} s (modeled) · ${si(rows)} rows · ${si(rows / 210)} rows/s · output ${s.output}`);
  }
  const T0 = () => Date.now();

  async function submitFile(file, dry) {
    const text = FS[fileArg(file)];
    if (!text) return out(`[err]no such file: ${file}[/]  (try: ls jobs)`);
    let spec, lineOf;
    try { ({ doc: spec, lineOf } = parseYaml(text)); } catch (e) { return out(`[err]✗ ${file}: ${e.message}[/]`); }
    const v = validate(spec, lineOf);
    cur = { id: 'sub-' + (SUBS.length + 1001), file, name: spec.metadata && spec.metadata.name, kind: spec.kind, t: Date.now(), user: me().name, via: api.via || 'CLI', steps: [], issues: v.issues, gpus: v.gpus, text, state: v.errors ? 'rejected' : 'submitting', team: spec.metadata && spec.metadata.team, priority: spec.metadata && spec.metadata.priority };
    SUBS.unshift(cur); refresh();
    out(`[b]${dry ? 'dry run' : 'submit'}[/] ${file} · ${spec.kind} ${spec.metadata && spec.metadata.name} · ${v.gpus} GPUs`);
    for (const [lvl, msg, ln] of v.issues) out(`  ${lvl === 'error' ? '[err]✗ error' : '[warn]! warning'}[/] ${file}:${ln}  ${msg}`);
    if (v.errors) return out(`[err]✗ ${v.errors} error${v.errors > 1 ? 's' : ''}; nothing submitted.[/] Fix with [acc]edit ${file}[/]`);
    if (spec.kind === 'TrainingJob') return submitTraining(spec, file, dry);
    if (spec.kind === 'RLJob') return submitRL(spec, file, dry);
    return submitBatch(spec, file, dry);
  }

  const jobById = (id) => ctx.F.jobs.find((j) => j.id === id || j.id.startsWith(id || '¶'));

  return {
    submitFile,
    ls: (a) => { const dir = fileArg(a[0] || '').replace(/\/$/, ''); const items = new Set(Object.keys(FS).filter((f) => !dir || f.startsWith(dir + '/')).map((f) => { const rest = dir ? f.slice(dir.length + 1) : f; return rest.includes('/') ? rest.split('/')[0] + '/' : rest; })); if (!items.size) return out(`[err]ls: ${dir}: no such directory[/]`); out([...items].sort().map((x) => (x.endsWith('/') ? `[acc]${x}[/]` : x)).join('   ')); },
    tree: () => { const dirs = {}; for (const f of Object.keys(FS)) { const [d, n] = f.split('/'); (dirs[d] ||= []).push(n); } out('.'); Object.entries(dirs).forEach(([d, fs], i, all) => { out(`${i === all.length - 1 ? '└──' : '├──'} [acc]${d}/[/]`); fs.forEach((f, k) => out(`${i === all.length - 1 ? '    ' : '│   '}${k === fs.length - 1 ? '└──' : '├──'} ${f}  [dim]${FS[`${d}/${f}`].split('\n').length} lines[/]`)); }); },
    cat: (a) => { const t = FS[fileArg(a[0])]; if (!t) return out(`[err]cat: ${a[0] || ''}: no such file[/]`); t.replace(/\n$/, '').split('\n').forEach((l, i) => out(`[dim]${lpad(i + 1, 3)}[/]  ${l}`)); },
    edit: (a) => { const f = fileArg(a[0]); if (!f) return out('[err]usage: edit <file>[/]'); api.openEditor(f, FS[f] ?? ''); },
    job: async (a) => {
      const sub = a[0];
      if (sub === 'submit') return submitFile(a[1], has(a, 'dry-run'));
      if (sub === 'validate') { const t = FS[fileArg(a[1])]; if (!t) return out(`[err]no such file: ${a[1] || ''}[/]`); try { const { doc, lineOf } = parseYaml(t); const v = validate(doc, lineOf); if (!v.issues.length) return out(`[ok]✓ ${a[1]} is valid[/]: ${doc.kind} ${doc.metadata.name}, ${v.gpus} GPUs`); for (const [lvl, msg, ln] of v.issues) out(`  ${lvl === 'error' ? '[err]✗ error' : '[warn]! warning'}[/] ${a[1]}:${ln}  ${msg}`); } catch (e) { out(`[err]✗ ${a[1]}: ${e.message}[/]`); } return; }
      if (sub === 'list') { out(`[dim]${pad('ID', 34)}${pad('KIND', 10)}${pad('STATE', 11)}${pad('GPUS', 7)}${pad('TEAM', 12)}SUBMITTED BY[/]`); for (const j of ctx.F.jobs) out(`${pad(j.id, 34)}${pad(j.kind, 10)}${pad(j.state, 11)}${pad(E.jobGpus(j), 7)}${pad(j.team, 12)}${j.owner}`); return; }
      if (sub === 'status') { const j = jobById(a[1]); if (!j) return out('[err]usage: crucible job status <id>[/]'); const p = j.kind === 'eval' ? null : E.trainStep(E.ARCH[j.arch], j.cfg); return out(`${j.id}  ${j.state.toUpperCase()}  ${E.jobGpus(j)} GPUs on ${j.cluster}  step ${j.step || Math.round(ctx.F.stepAt(j))}/${j.steps || '?'}${p ? `  MFU ${(p.mfu * 100).toFixed(1)}%  ${si(p.tps)} tok/s` : ''}`); }
      if (sub === 'logs') { const j = jobById(a[1]); if (!j) return out('[err]usage: crucible job logs <id>[/]'); if (j.kind === 'rl' || j.kind === 'eval' || j.kind === 'pretrain') { for (const e of ctx.F.events.filter((x) => x.subject === j.id).slice(0, 8)) out(`  [dim]${new Date(e.t).toISOString().slice(11, 19)}[/] ${e.text}`); return; } return tail(j, has(a, 'follow') || has(a, 'f') ? 8 : 4); }
      if (sub === 'describe') {
        const j = jobById(a[1]); if (!j) return out('[err]usage: crucible job describe <id>[/]');
        const gpus = E.jobGpus(j), nodes = Math.ceil(gpus / 8), c = j.cfg;
        out(`[b]${j.id}[/]  ${j.kind} · ${j.method || ''} · ${E.ARCH[j.arch].name} · ${j.state}${j.file ? ` · from ${j.file}` : ''}`);
        out(`  cluster ${j.cluster} · ray-${j.id} · priority ${j.priority} · team ${j.team}`);
        out(`  layout   TP ${c.tp} · PP ${c.pp} · ${c.zero >= 3 ? 'FSDP' : 'DP'} ${c.dp} · micro ${c.micro} × accum ${c.accum} · seq ${fmt(c.seq)} · ${c.recompute} recompute`);
        if (j.rl) out(`  roles    rollout ${j.rl.rolloutGpus / 4} engines × TP 4 · trainer ${j.rl.trainGpus} GPUs · ${fmt(j.rl.verifiers)} sandboxes`);
        const d = E.DATASETS.find((x) => x.id === (j.dataset || j.mix));
        if (d) out(`  data     ${d.id} #${d.snapshot}: ${fmt(d.shards)} shards over ${c.dp} DP ranks (${(d.shards / c.dp).toFixed(d.shards % c.dp ? 1 : 0)} each), streamed by Ray Data`);
        out(`\n  [dim]${pad('node', 16)}${pad('global ranks', 15)}${pad('placement', 22)}data shards[/]`);
        nodeNames(j.cluster, Math.min(nodes, 5)).forEach((n, i) => { const r0 = i * 8, per = d ? d.shards / c.dp : 0; out(`  ${pad(n, 16)}${pad(`${r0}-${r0 + 7}`, 15)}${pad(`bundle ${i} {GPU: 8}`, 22)}${d ? `${Math.floor(Math.floor(r0 / c.tp) * per)}-${Math.floor(Math.floor((r0 + 8) / c.tp) * per) - 1}` : ''}`); });
        if (nodes > 5) out(`  [dim]… ${nodes - 5} more nodes[/]`);
        return;
      }
      if (sub === 'cancel') { const j = jobById(a[1]); if (!j) return out('[err]usage: crucible job cancel <id>[/]'); if (!['running', 'queued'].includes(j.state)) return out(`[warn]${j.id} is ${j.state}[/]`); j.state = 'stopped'; ctx.F.event(Date.now(), j.id, 'rollback', `Cancelled by ${me().name}; final checkpoint saved, ${E.jobGpus(j)} GPUs released.`); ui.renderChrome(); return out(`[ok]✓ ${j.id} cancelled[/]: SIGTERM → async checkpoint → placement group removed → ${E.jobGpus(j)} GPUs back to ${j.team}`); }
      out('[err]usage: crucible job submit|validate|list|status|logs|describe|cancel …[/]');
    },
    run: async (a) => {
      const script = fileArg(a[0]);
      if (!script || !FS[script]) return out(`[err]usage: crucible run <src/file.py> --gpus N [--cpus N] [--model M] [--data dataset][/]  files: ${Object.keys(FS).filter((f) => f.endsWith('.py')).join(', ')}`);
      const gpus = +flag(a, 'gpus', 16), cpus = +flag(a, 'cpus', 128), model = flag(a, 'model', 'core-8b-sft-v5'), data = flag(a, 'data', 'assistant-sft-v9');
      const name = script.split('/').pop().replace('.py', '').replace(/_/g, '-') + '-' + me().name.split(' ')[0].toLowerCase();
      const yaml = `apiVersion: crucible.acme.dev/v1
kind: TrainingJob
metadata:
  name: ${name}
  team: ${me().team === 'platform' ? 'research' : me().team}
  priority: P2
spec:
  model: ${model}
  method: sft
  code:
    workingDir: ./src
    entrypoint: python ${script.split('/').pop()}
  data:
    dataset: ${data}
    seqLen: 8192
    preprocessCpus: ${cpus}
  resources:
    gpus: ${gpus}
    gpuType: ${flag(a, 'gpu', 'h100')}
  parallel:
    layout: auto
  maxSteps: 500
`;
      const f = `jobs/${name}.yaml`;
      FS[f] = yaml;
      out(`[dim]generated ${f} from flags (edit it to customize):[/]`);
      yaml.trim().split('\n').forEach((l) => out(`  [dim]${l}[/]`));
      out('');
      return submitFile(f, has(a, 'dry-run'));
    },
    data: (a) => {
      if (a[0] !== 'shard') return out('[err]usage: crucible data shard <dataset> --ranks N[/]');
      const d = E.DATASETS.find((x) => x.id === a[1]), ranks = +flag(a, 'ranks', 64);
      if (!d) return out(`[err]unknown dataset[/]  (${E.DATASETS.map((x) => x.id).join(', ')})`);
      const per = d.shards / ranks;
      out(`[b]${d.id}[/] #${d.snapshot} · ${fmt(d.shards)} shards · ${si(d.tokens)} tokens · ${d.format}`);
      out(`  ${ranks} ranks → ${per >= 1 ? `${Math.floor(per)}${per % 1 ? `-${Math.ceil(per)}` : ''} shards per rank` : `${(1 / per).toFixed(0)} ranks share a shard (sample-level split)`} · ${si(d.tokens / ranks)} tokens per rank per epoch`);
      out(`  order: seeded Feistel permutation of shard IDs per epoch; 16K-sample shuffle buffer per reader; resumable from (epoch, shard, offset)`);
      for (let r = 0; r < Math.min(ranks, 6); r++) out(`  rank ${lpad(r, 3)}  shards ${Math.floor(r * per)}${per > 1 ? `-${Math.floor((r + 1) * per) - 1}` : ''}  ${bar(Math.min(1, per / Math.ceil(per)), 10)}`);
      if (ranks > 6) out(`  [dim]… ${ranks - 6} more ranks[/]`);
    },
  };
}
export const fileNames = () => Object.keys(FS);
