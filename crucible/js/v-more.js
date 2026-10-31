/* Post-training pipelines, evaluations, model registry, design review,
   SDK and API, and settings. */
import { E, h, fmt, si, gb, ms, dur, ago, usd, ctx, S, VIEWS, ACTIONS, CLICKS, head, pill, glist, seg, C, can, me, toast, ui, icon, match, F_ } from './core.js?v=20261031-4';
import { EVAL_SUITES } from './v-train.js?v=20261031-4';

/* ───────────────────────── pipelines ───────────────────────── */

const PIPES = [
  { id: 'assistant-8b', name: 'Assistant 8B', owner: 'Dev Patel', stages: [['Data', 'assistant-sft-v9, prefs-v7', 'done', null], ['SFT', '3,000 steps, 64 GPUs', 'done', 'sft-core-8b-assist'], ['DPO', 'β 0.1, 2,400 steps', 'running', 'dpo-core-8b-assist'], ['Tool-use RL', 'GRPO on tool tasks', 'failed', 'grpo-core-8b-tools'], ['Evaluate', '18 suites + regression gate', 'waiting', null], ['Canary', '5 → 100%, SLO gated', 'waiting', null]] },
  { id: 'reasoning-70b', name: 'Reasoning 70B', owner: 'Maya Chen', stages: [['Base', 'core-70b-base-v3, step 41K', 'running', 'pt-core-70b-v3'], ['SFT', 'Long chain-of-thought, v3.2', 'done', null], ['Evaluate SFT', '18 suites', 'running', 'eval-core-70b-sft32'], ['RL', 'GRPO with verifiers, 1,200 steps', 'running', 'rl-core-70b-reason'], ['Canary', 'v0.9 at 5%', 'running', null]] },
  { id: 'edge-3b', name: 'Edge 3B on-device', owner: 'Hiro Tanaka', stages: [['Distill', 'From Core 70B logits, 2.4T tokens', 'running', 'pt-edge-3b-distill'], ['SFT', 'Assistant SFT v9', 'waiting', null], ['Quantize', '4-bit palettized for device', 'waiting', null], ['Evaluate', 'On-device latency + quality', 'waiting', null]] },
];
const RECIPES = [
  ['SFT', 'Supervised fine-tuning', 'Teach format and skills from demonstrations. Loss on response tokens only, packed sequences.', 'Responses written or reviewed by people'],
  ['LoRA', 'Low-rank adapters', 'Rank 8 to 64 adapters on attention and MLP; MBs per adapter, served many per base model.', 'Many small tasks on one base'],
  ['DPO', 'Direct preference optimization', 'Classification loss on chosen vs rejected pairs, anchored to a frozen reference. No reward model, no sampling.', 'Preference pairs'],
  ['KTO', 'Kahneman-Tversky optimization', 'Learns from unpaired thumbs up or down.', 'Binary feedback at scale'],
  ['GRPO', 'Group relative policy optimization', 'Sample a group per prompt; advantage = reward minus group mean, over group std. No critic.', 'Verifiable rewards: math, code, tools'],
  ['DAPO', 'GRPO with dynamic sampling', 'Drops groups with identical rewards, clip-higher for exploration, token-level loss.', 'Long reasoning, sparse rewards'],
  ['PPO', 'Proximal policy optimization', 'Actor, critic, reward model and reference. Most flexible, most memory.', 'Learned reward models'],
  ['Distill', 'Knowledge distillation', 'Student matches teacher logits (top-k) plus next-token loss.', 'Small models for device or cost'],
];
VIEWS.pipelines = () => {
  const F = ctx.F;
  const st = { done: 'done', running: 'running', failed: 'rejected', waiting: '' };
  return head('Pipelines', 'Post-training as a pipeline: each stage is a run with its own checkpoint, and a stage only starts when the one before it passes its gate.') + `<div class="grid">${PIPES.map((p) => `<div class="card c12"><h3>${h(p.name)} <span class="right">${h(p.owner)}</span></h3><div class="pipe">${p.stages.map(([n, d, s, run]) => `<button class="pstage ${s}" ${run ? `data-openrun="${run}"` : 'disabled'}><span class="pdot ${st[s]}"></span><b>${h(n)}</b><small>${h(d)}</small><em>${s === 'running' && run ? fmt(Math.round((F.job(run).kind === 'pretrain' ? F.tokensAt(F.job(run)) / F.job(run).targetTokens : F.job(run).step / F.job(run).steps) * 100)) + '%' : s}</em></button>`).join('<span class="parrow">›</span>')}</div></div>`).join('')}
    <div class="card c12"><h3>Recipes</h3><p class="note">Versioned, tested defaults for each method. Teams change hyperparameters and the reward function, not the distributed plumbing.</p><div class="recipes">${RECIPES.map(([k, n, d, w]) => `<div class="recipe"><b>${k}</b><span>${n}</span><p>${h(d)}</p><small>Use for: ${h(w)}</small></div>`).join('')}</div></div></div>`;
};

/* ───────────────────────── evaluations ───────────────────────── */

const SCORES = EVAL_SUITES.map(([n, k], i) => {
  const base = [72.1, 51.8, 81.4, 23.3, 84.6, 38.2, 86.9, 8.4, 61.2, 79.5, 71.3, 83.0, 98.6, 6.1, 97.9, 100, 100, 99.1][i];
  const delta = [1.4, 3.9, 4.8, 9.2, 1.1, 4.6, 0.6, 0.3, 4.4, -2.7, 1.9, 0.8, 0.2, -0.9, 0.4, 0, 0, 0.0][i];
  const lowerBetter = n.startsWith('Over-refusal');
  return { n, k, base, now: base + delta, delta, lowerBetter, gate: n === 'RULER 128K' ? 'Regression over 2 points' : null };
});
VIEWS.evals = () => {
  const F = ctx.F, decided = F.promoted32;
  const fails = SCORES.filter((s) => s.gate);
  return head('Evaluations', 'Every candidate model runs the same suites against the version in production. Promotion needs every gate green, or an explicit, recorded exception.') + `<div class="grid"><div class="card c12"><div class="lcm-head"><div><h2>core-70b-sft-v3.2 <span>vs core-70b-sft-v3.1 (production)</span></h2><p>18 suites, run on 8 vLLM replicas from the eval sweep job</p></div><div class="row">${decided ? pill(decided === 'promoted' ? 'ok' : 'deny', decided === 'promoted' ? 'Promoted to staging' : 'Blocked') : `<button class="btn primary" data-act="eval-accept" ${can('researcher', 'manager') ? '' : 'disabled'}>Accept regression and promote</button><button class="btn danger" data-act="eval-block" ${can('researcher', 'manager') ? '' : 'disabled'}>Block</button>`}</div></div>
    ${decided ? '' : `<div class="lcm-banner warn"><b>1 gate failed.</b> RULER 128K dropped 2.7 points: the long chain-of-thought SFT data is mostly under 16K tokens. Accepting records the exception with your name; blocking sends it back for a long-context data mix.</div>`}
    <table class="table"><thead><tr><th>Suite</th><th>Kind</th><th class="num">v3.1</th><th class="num">v3.2</th><th class="num">Change</th><th>Gate</th></tr></thead><tbody>${SCORES.map((s) => { const good = s.lowerBetter ? s.delta <= 0 : s.delta >= 0; return `<tr${s.gate ? ' class="bad"' : ''}><td>${h(s.n)}</td><td>${h(s.k)}</td><td class="num">${s.base.toFixed(1)}</td><td class="num"><b>${s.now.toFixed(1)}</b></td><td class="num" style="color:${s.delta === 0 ? 'var(--ink-3)' : good ? 'var(--green)' : 'var(--red)'}">${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}</td><td>${s.gate ? pill('deny', s.gate) : pill('ok', 'Pass')}</td></tr>`; }).join('')}</tbody></table>
    <p class="note">Judged suites use a pinned judge model and fixed seeds; contamination is checked by n-gram overlap between training data and eval sets before a run.</p></div></div>`;
};
ACTIONS['eval-accept'] = () => { ctx.F.promoted32 = 'promoted'; ctx.F.event(Date.now(), 'core-70b-sft-v3.2', 'promoted', `Promoted to staging by ${me().name} with a recorded exception for RULER 128K (−2.7).`); toast('Promoted with a recorded exception'); };
ACTIONS['eval-block'] = () => { ctx.F.promoted32 = 'blocked'; ctx.F.event(Date.now(), 'core-70b-sft-v3.2', 'failed', `Blocked by ${me().name}: long-context regression.`); toast('Blocked. The owner was notified.'); };

/* ───────────────────────── registry ───────────────────────── */

VIEWS.registry = () => {
  const m = E.MODELS.find((x) => x.id === S.model) || E.MODELS[0], a = E.ARCH[m.id];
  const deps = ctx.F.deps;
  const stage = { Production: 'ok', Canary: 'blue', Evaluating: 'warn', Training: 'live', Registered: '' };
  return head('Registry', 'Every model version with what made it: data snapshot, run, checkpoint, evaluations and where it serves.') + `<div class="grid"><div class="card c12 lcm"><div class="lcm-list"><label class="search lsearch">${icon('search')}<input data-filter="models" value="${h(F_['models'] || '')}" placeholder="Search models and versions"></label><div class="lcm-rows">${E.MODELS.filter((x) => match('models', x.name, x.id, ...x.versions.flat())).map((x) => `<button class="lcm-row nodot${x.id === m.id ? ' on' : ''}" data-modelsel="${x.id}"><span><b>${h(x.name)}</b><small>${si(E.ARCH[x.id].params)} params${E.ARCH[x.id].active ? `, ${si(E.ARCH[x.id].active)} active` : ''}</small></span><em>${x.versions.length}</em></button>`).join('')}</div></div>
    <div class="lcm-detail"><div class="lcm-head"><div><h2>${h(m.name)}</h2><p>${a.layers} layers · hidden ${fmt(a.hidden)} · ${a.heads} heads, ${a.kv} KV heads (GQA)${a.experts ? ` · ${a.experts} experts, top ${a.topk}` : ''} · vocab ${fmt(a.vocab)}</p></div></div>
    ${m.versions.map(([v, method, run, st, data]) => { const d = deps.filter((x) => x.model === v || (x.canary && x.canary.to === v)); return `<div class="ver-card"><div class="row between"><div><b class="mono">${h(v)}</b> ${pill(stage[st] || '', st)}</div><span class="note">${h(method)}</span></div><div class="chain">${[['Data', data], ['Run', run], ['Checkpoint', `s3://acme-ckpt/${run}/final`], ['Evals', st === 'Evaluating' ? '17 of 18 pass' : st === 'Training' ? 'pending' : '18 of 18 pass'], ['Serving', d.map((x) => x.name).join(', ') || 'not deployed']].map(([k, val]) => `<span><small>${k}</small>${h(val)}</span>`).join('<i>›</i>')}</div><p class="note">Training data approved by the governance platform; snapshot pinned. Weights signed (cosign), digest in the transparency log.</p></div>`; }).join('')}
    </div></div></div>`;
};
CLICKS.push(['modelsel', (id) => { S.model = id; }]);

/* ───────────────────────── design review ───────────────────────── */

const OWNS = [
  ['Distributed training on Ray', 'One execution layer for pretraining and fine-tuning: Ray Train worker groups over torch.distributed, FSDP2 and Megatron-style TP/PP, with a planner that picks the layout from model size and GPU budget.', [['runs', 'Runs'], ['planner', 'Planner']]],
  ['Post-training APIs', 'SFT, DPO, KTO, GRPO, DAPO and PPO as versioned recipes behind one SDK. Teams supply data, reward functions and hyperparameters; the platform owns placement, sync and fault tolerance.', [['pipelines', 'Pipelines'], ['sdk', 'SDK']]],
  ['RL systems', 'Rollouts on vLLM or SGLang actors, verifiers in sandboxes, FSDP trainers, NCCL weight sync, one-step async with partial rollouts for the long tail.', [['rl', 'RL runs'], ['ray', 'Ray']]],
  ['Inference runtime', 'Continuous batching, paged KV cache with prefix caching, FP8 weights and KV, speculative decoding, disaggregated prefill and decode, prefix-aware routing.', [['deployments', 'Deployments'], ['capacity', 'Capacity']]],
  ['Reliability', 'Burn-in, health agents, hot spares, async sharded checkpoints with peer-memory copies, reshardable restarts. Goodput is the headline metric.', [['fleet', 'Fleet'], ['runs', 'Recovery']]],
  ['Benchmarks and cost', 'Engines swept on fixed workloads; goodput at SLO and cost per million tokens drive defaults and catch regressions on upgrades.', [['benchmarks', 'Benchmarks']]],
  ['Shared fleet', 'Gang scheduling, team quotas with borrowing, preemption with checkpoint first, serving and training on one pool.', [['queue', 'Queue']]],
];
const NUMBERS = [['94%+', 'training goodput', 'large pretraining runs'], ['35 to 55%', 'MFU', 'dense, BF16 basis'], ['< 2 min', 'node failure to resumed', 'hot spare + peer memory'], ['< 1 day', 'idea to first RL step', 'recipe + defaults'], ['$0.5 to 1', 'per 1M output tokens', '70B, FP8, at SLO']];
const TRADEOFFS = [
  ['FSDP vs TP + PP', 'FSDP is simplest and wins while params fit after sharding; TP + PP win at the largest scale where all-gathers cannot hide behind compute. The planner decides per job, and checkpoints reshard between layouts.'],
  ['Colocated vs disaggregated RL', 'Colocated (trainer and engine time-share GPUs) uses every GPU but serializes phases. Disaggregated pools pipeline with one step of staleness. Default: colocated under 64 GPUs, split above.'],
  ['Speculative decoding', 'Big latency win at low batch; a net loss once a deployment is compute-bound. Enabled per deployment from the tuning sweep, not globally.'],
  ['Engine choice', 'vLLM, SGLang and TensorRT-LLM each win somewhere. One serving interface (load, generate, update weights, health) lets each deployment use the best engine and makes upgrades routine.'],
  ['Checkpoint frequency', 'Young/Daly: interval = √(2 · save time · MTBF). Async saves cut blocking time to seconds, so large jobs checkpoint every few minutes.'],
];
VIEWS.review = () => head('Design review', 'What a training and inference platform team owns, how Crucible does each part, and the trade-offs behind it.') + `<div class="grid">
  <div class="card c12"><h3>What the platform owns</h3><div class="own">${OWNS.map(([t, d, links], i) => `<div class="own-row"><span class="own-n">${i + 1}</span><div><b>${t}</b><p>${h(d)}</p></div><div class="own-links">${links.map(([v, l]) => `<button class="btn" data-go="${v}">${l}</button>`).join('')}</div></div>`).join('')}</div></div>
  <div class="card c12"><h3>Targets</h3><div class="slo-row">${NUMBERS.map(([v, k, s]) => `<div><b>${v}</b><span>${k}</span><small>${s}</small></div>`).join('')}</div></div>
  <div class="card c12"><h3>Trade-offs</h3>${glist(TRADEOFFS.map(([k, v]) => [k, v]))}</div></div>`;

/* ───────────────────────── SDK and API ───────────────────────── */

const SDK = `from crucible import train, rl, serve

# Fine-tune: layout, memory and checkpointing are planned for you.
sft = train.SFT(model="core-8b-base-v5", data="assistant-sft-v9",
                gpus=64, seq_len=8192, layout="auto")
sft.submit(team="assistant")

# RL with a custom verifiable reward.
@rl.reward
def unit_tests(sample) -> float:
    return rl.sandbox.run(sample.code, tests=sample.meta["tests"], timeout_s=20).pass_rate

job = rl.DAPO(policy=sft.output, prompts="math-code-verifiable-v4",
              reward=unit_tests, group_size=16,
              rollout=rl.Rollout(engine="vllm", gpus=64, tp=4),
              trainer=rl.FSDP(gpus=64), async_steps=1, partial_rollouts=True)
job.submit(team="assistant")

# Serve the result as a canary, gated on SLOs.
dep = serve.deploy(job.output, engine="sglang", gpu="H100", tp=1, quant="fp8",
                   slo=serve.SLO(ttft_p90="600ms", itl_p90="25ms"), canary=[5, 25, 50, 100])`;
const API = [['POST', '/v1/jobs', 'Submit a training, fine-tuning or RL job'], ['GET', '/v1/jobs/{id}', 'Status, metrics, checkpoints'], ['POST', '/v1/jobs/{id}:resume', 'Restart from a checkpoint, optionally with a new layout'], ['POST', '/v1/plan', 'Parallel layouts and memory for a model and GPU budget'], ['POST', '/v1/deployments', 'Deploy a model version as a canary'], ['POST', '/v1/deployments/{id}:advance', 'Advance a canary step'], ['GET', '/v1/capacity', 'Goodput and cost per token for a configuration'], ['POST', '/v1/benchmarks', 'Sweep an engine configuration on a workload']];
VIEWS.sdk = () => head('SDK and API', 'The same operations as the console, from Python, REST or the CLI. Jobs are declarative; the platform owns placement, retries and checkpoints.') + `<div class="grid"><div class="card c12"><h3>Python</h3><pre class="code">${h(SDK)}</pre></div>
  <div class="card c12"><h3>REST</h3><div class="api-list">${API.map(([m, p, d]) => `<div class="api-row"><span class="verb ${m.toLowerCase()}">${m}</span><span><span class="mono">${h(p)}</span><small>${h(d)}</small></span></div>`).join('')}</div></div>
  <div class="card c12"><h3>CLI</h3><pre class="code">${h(`crucible plan core-70b --gpus 1024 --gpu h100 --seq 8192
crucible jobs submit sft.yaml --team assistant
crucible jobs logs pt-core-70b-v3 --rank 1337 --follow
crucible deploy core-8b-dpo-v5.3 --engine sglang --tp 1 --quant fp8 --canary 5`)}</pre></div></div>`;

/* ───────────────────────── settings ───────────────────────── */

VIEWS.org = () => head('Organization', 'Identity, teams and who can change what.') + `<div class="grid"><div class="card c6"><h3>Identity</h3>${glist([['Sign-in', 'Acme SSO, OpenID Connect with PKCE'], ['Provisioning', 'SCIM from the directory'], ['Sessions', '8 hours, re-auth for production changes'], ['Service identity', 'Workload identity per job; no long-lived keys']])}</div>
  <div class="card c6"><h3>Roles</h3><table class="table"><thead><tr><th>Person</th><th>Role</th><th>Team</th></tr></thead><tbody>${Object.values(E.ROLES).map((r) => `<tr><td>${h(r.name)}</td><td>${h(r.title)}</td><td>${h(E.TEAMS[r.team].name)}</td></tr>`).join('')}</tbody></table></div></div>`;
const INTEG = [['Kubernetes + KubeRay', 'Every job and deployment is a Ray cluster or a ModelDeployment on EKS and on-prem GPU clusters.'], ['Kueue', 'Gang admission, quotas and borrowing.'], ['Object storage', 'Checkpoints and dataset snapshots, versioned and immutable.'], ['Governance platform', 'Dataset approvals and consent snapshots checked before a job reads data.'], ['Prometheus + Grafana', 'DCGM, NCCL and engine metrics; SLO burn alerts.'], ['Experiment tracking', 'Metrics, configs and artifacts per run, linked from the registry.']];
VIEWS.integrations = () => head('Integrations', 'Crucible runs on the infrastructure teams already use.') + `<div class="grid"><div class="card c12"><div class="integ">${INTEG.map(([k, v]) => `<div class="integ-item"><b>${k}</b>${pill('ok', 'Connected')}<p>${h(v)}</p></div>`).join('')}</div></div></div>`;
