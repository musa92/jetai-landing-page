/* Execution backends: Ray and its alternatives for training, RL and serving.
   The same three workloads rendered as Ray, Kubernetes, Slurm, SkyPilot or
   the serving stacks, with when each one wins. Generators are shared with the
   terminal's `crucible export`. */
import { E, h, ctx, S, VIEWS, CLICKS, head, pill, seg } from './core.js?v=20261101-2';

export const BACKENDS = {
  train: [['ray', 'Ray Train'], ['k8s', 'Kubernetes (Kubeflow + Kueue)'], ['slurm', 'Slurm'], ['skypilot', 'SkyPilot'], ['torchrun', 'torchrun']],
  rl: [['ray', 'Ray (VeRL / OpenRLHF style)'], ['k8s', 'Kubernetes (JobSet)'], ['monolith', 'Single SPMD job']],
  serve: [['ray', 'Ray Serve LLM'], ['kserve', 'KServe + vLLM'], ['dynamo', 'NVIDIA Dynamo'], ['llmd', 'llm-d'], ['triton', 'Triton + TensorRT-LLM']],
};

/* Training job → backend config. j: a fleet job (or defaults). */
export function genTrain(b, j = {}) {
  const gpus = j.cfg ? E.jobGpus(j) : 64, nodes = Math.max(1, Math.ceil(gpus / 8)), name = j.id || 'sft-core-70b', model = j.base || j.arch || 'core-70b';
  const args = `train.py --model ${model} --fsdp --seq-len ${j.cfg ? j.cfg.seq : 8192}`;
  return {
    ray: `from ray.train import ScalingConfig, RunConfig, FailureConfig, CheckpointConfig
from ray.train.torch import TorchTrainer

def train_loop(cfg):
    model = build_model("${model}")
    for block in model.layers:                      # FSDP2, one unit per block
        fully_shard(block, mesh=init_device_mesh("cuda", (${gpus},)))
    fully_shard(model)
    for batch in ray.train.get_dataset_shard("train").iter_torch_batches(batch_size=1):
        ...                                         # step, then ray.train.report(metrics, checkpoint=ckpt)

trainer = TorchTrainer(
    train_loop,
    scaling_config=ScalingConfig(num_workers=${gpus}, use_gpu=True, placement_strategy="PACK"),
    run_config=RunConfig(
        name="${name}", storage_path="s3://acme-ckpt",
        failure_config=FailureConfig(max_failures=5),        # restart from last checkpoint
        checkpoint_config=CheckpointConfig(num_to_keep=3)),
    datasets={"train": ray.data.read_parquet("s3://acme-train/${j.dataset || 'assistant-sft-v9'}/")},
)
trainer.fit()`,
    k8s: `apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: ${name}
  labels: { kueue.x-k8s.io/queue-name: ${j.team || 'foundation'} }   # gang admission + quota
spec:
  runPolicy: { backoffLimit: 5 }
  elasticPolicy: { rdzvBackend: c10d, minReplicas: ${nodes}, maxReplicas: ${nodes}, maxRestarts: 5 }
  pytorchReplicaSpecs:
    Worker:
      replicas: ${nodes}
      template:
        spec:
          containers:
          - name: trainer
            image: registry.acme.internal/train:3.4
            command: [torchrun, --nproc_per_node=8, ${args.split(' ').join(', ')}]
            resources: { limits: { nvidia.com/gpu: 8, rdma/ib: 8 } }
          nodeSelector: { acme.dev/rail-group: auto }   # topology-aware placement`,
    slurm: `#!/bin/bash
#SBATCH --job-name=${name}
#SBATCH --nodes=${nodes} --gpus-per-node=8 --ntasks-per-node=1 --exclusive
#SBATCH --requeue                       # requeued on node failure
HEAD=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)
srun torchrun --nnodes=${nodes} --nproc_per_node=8 \\
  --rdzv_backend=c10d --rdzv_endpoint=$HEAD:29500 \\
  ${args} --resume-from latest`,
    skypilot: `name: ${name}
resources: { accelerators: H100:8, use_spot: false }
num_nodes: ${nodes}
file_mounts: { /ckpt: { source: s3://acme-ckpt, mode: MOUNT } }
run: |
  torchrun --nnodes=$SKYPILOT_NUM_NODES --node_rank=$SKYPILOT_NODE_RANK \\
    --master_addr=$(echo "$SKYPILOT_NODE_IPS" | head -n1) --nproc_per_node=8 \\
    ${args} --ckpt-dir /ckpt/${name}`,
    torchrun: `# on every node (rank 0 is the rendezvous host)
torchrun --nnodes=${nodes} --nproc_per_node=8 --node_rank=$NODE_RANK \\
  --rdzv_backend=c10d --rdzv_endpoint=node0:29500 --max_restarts=3 \\
  ${args}`,
  }[b];
}

export function genRL(b, j = {}) {
  const rl = j.rl || { rolloutGpus: 64, trainGpus: 64, verifiers: 512, group: 16, engine: 'vLLM' };
  return {
    ray: `# One driver, actor groups per role, NCCL between them.
pg_rollout = placement_group([{"GPU": 4}] * ${rl.rolloutGpus / 4}, strategy="STRICT_PACK")
rollout = [VLLMEngine.options(num_gpus=4, placement_group=pg_rollout).remote("${j.base || 'core-8b-sft-v5'}", tp=4)
           for _ in range(${rl.rolloutGpus / 4})]
trainer = [FSDPWorker.options(num_gpus=1).remote(rank=i, world=${rl.trainGpus}) for i in range(${rl.trainGpus})]
verifiers = ActorPool([Sandbox.options(num_cpus=1).remote() for _ in range(${rl.verifiers})])
weights_group = collective.create_collective_group(trainer[:1] + rollout, backend="nccl")

for step in range(steps):
    samples = ray.get([e.generate.remote(prompts.shard(i), n=${rl.group}) for i, e in enumerate(rollout)])
    rewards = list(verifiers.map(lambda a, s: a.score.remote(s), flatten(samples)))
    ray.get([t.train_step.remote(samples, grpo_advantages(rewards, ${rl.group})) for t in trainer])
    ray.get(trainer[0].broadcast_weights.remote())          # NCCL, not the object store`,
    k8s: `# Kubernetes has no actor model: each role is a replicated job, wired by services.
apiVersion: jobset.x-k8s.io/v1alpha2
kind: JobSet
metadata: { name: ${j.id || 'grpo-core-8b'} }
spec:
  replicatedJobs:
  - name: rollout        # vLLM servers, ${rl.rolloutGpus / 4} pods × 4 GPUs, OpenAI API inside the cluster
    replicas: ${rl.rolloutGpus / 4}
  - name: trainer        # torchrun FSDP, ${rl.trainGpus} GPUs; pulls samples, pushes weights over NCCL
    replicas: ${rl.trainGpus / 8}
  - name: verifiers      # CPU sandbox pool behind a queue
    replicas: ${rl.verifiers / 32}
# You build the controller loop, weight sync and failure handling yourself.`,
    monolith: `# Every rank does every role in turn, all in one torchrun job (colocated).
for step in range(steps):
    engine.wake_up(); samples = engine.generate(prompts.local_shard(), n=${rl.group}); engine.sleep()  # free KV memory
    rewards = score_local(samples)                   # verifiers on host CPUs
    loss = policy.train_step(samples, grpo_advantages(rewards, ${rl.group}))
    engine.load_weights(policy.state_dict())          # CUDA IPC, same GPU
# Simple and fully utilized at small scale; generation and training cannot overlap.`,
  }[b];
}

export function genServe(b, d = {}) {
  const c = d.cfg || { tp: 4, quant: 'fp8', kvq: 'fp8', spec: null }, model = d.model || 'core-70b-sft-v3.1', id = d.id || 'assistant-70b';
  return {
    ray: `from ray import serve
from ray.serve.llm import LLMConfig, build_openai_app

llm = LLMConfig(
    model_loading_config={"model_id": "${model}", "model_source": "s3://acme-models/${model}"},
    engine_kwargs={"tensor_parallel_size": ${c.tp}, "quantization": "${c.quant}", "kv_cache_dtype": "${c.kvq === 'fp8' ? 'fp8' : 'auto'}",
                   "enable_prefix_caching": True, "enable_chunked_prefill": True},
    deployment_config={"autoscaling_config": {"min_replicas": ${d.min || 4}, "max_replicas": ${d.max || 32},
                                              "target_ongoing_requests": 32}},
    accelerator_type="H100",
)
serve.run(build_openai_app({"llm_configs": [llm]}), name="${id}")`,
    kserve: `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata: { name: ${id} }
spec:
  predictor:
    minReplicas: ${d.min || 4}
    maxReplicas: ${d.max || 32}
    model:
      modelFormat: { name: huggingface }
      storageUri: s3://acme-models/${model}
      args: ["--tensor-parallel-size=${c.tp}", "--quantization=${c.quant}", "--enable-prefix-caching"]
      resources: { limits: { nvidia.com/gpu: "${c.tp}" } }`,
    dynamo: `# NVIDIA Dynamo: disaggregated prefill and decode with a KV-aware router.
# frontend (OpenAI API) → router (scores workers by KV cache overlap)
#   → prefill workers: compute KV for new prompts
#   → decode workers: receive KV over NIXL (RDMA), generate tokens
# Backends: vLLM, SGLang or TensorRT-LLM; planner scales prefill and decode pools separately.
model: ${model}
prefill: { workers: ${Math.max(2, Math.ceil((d.replicas || 8) / 4))}, tensor_parallel: ${c.tp} }
decode:  { workers: ${d.replicas || 8}, tensor_parallel: ${c.tp} }
router:  { mode: kv-aware }
kv_transfer: nixl`,
    llmd: `# llm-d: Kubernetes-native distributed vLLM.
# Gateway API Inference Extension routes by prefix-cache affinity and load;
# optional prefill/decode split; vLLM pods as the model servers.
modelservice:
  model: s3://acme-models/${model}
  decode:  { replicas: ${d.replicas || 8}, parallelism: { tensor: ${c.tp} } }
  prefill: { replicas: ${Math.max(2, Math.ceil((d.replicas || 8) / 4))} }
routing:  { scorers: [prefix-cache, kv-cache-utilization, queue-depth] }`,
    triton: `# Triton Inference Server with the TensorRT-LLM backend.
# 1. build an engine for the exact GPU, TP and precision:
trtllm-build --checkpoint_dir ckpt/${model} --output_dir engines/${id} \\
  --tp_size ${c.tp} --use_fp8_context_fmha enable --max_batch_size 256 --max_num_tokens 8192
# 2. serve it; in-flight batching and paged KV are built in
tritonserver --model-repository=/models/${id}`,
  }[b];
}

const CMP = {
  train: [
    ['Ray Train', 'Python-first; one program drives data (Ray Data), training and eval; actor model; restarts from checkpoints', 'Another layer to operate (head node, GCS); fewer HPC scheduler features', 'Default for training and fine-tuning jobs'],
    ['Kubernetes (Kubeflow, JobSet, Kueue)', 'Standard ops: quotas, gang admission, RBAC, same cluster as services', 'Startup latency; elastic and multi-role jobs need operators; weaker for tight HPC loops', 'Underneath everything: Ray clusters run on it via KubeRay'],
    ['Slurm', 'HPC standard; fast gang scheduling, topology-aware, simple batch scripts; what most labs pretrain on', 'No services, weak multi-tenancy UX, static allocations, poor for serving or RL controllers', 'Research clusters that already use it; Crucible can target it for pretraining'],
    ['SkyPilot', 'Same job across clouds and regions; finds capacity; spot recovery', 'Not a fleet scheduler; per-job, not per-org quotas', 'Burst to cloud when the on-prem fleet is full'],
    ['torchrun / TorchX', 'Zero extra layers; exactly PyTorch distributed', 'You build placement, retries, data loading and checkpoints yourself', 'What every backend ultimately launches'],
  ],
  rl: [
    ['Ray', 'Heterogeneous roles (rollout engines, trainers, reward models, sandboxes) as actors in one program; placement groups; used by VeRL, OpenRLHF, NeMo-RL, SkyRL', 'Controller is a single point; large tensors must bypass the object store (NCCL, compiled graphs)', 'Default for RL'],
    ['Kubernetes JobSet', 'Each role scales and fails independently; plain containers', 'No actor model: controller, weight sync and backpressure are yours to build', 'Long-running services, such as shared verifier pools'],
    ['Single SPMD job', 'Simplest; all GPUs busy; colocated weight sync by CUDA IPC', 'Phases cannot overlap; one failure stops everything; hard past one model size', 'Small models and quick experiments'],
  ],
  serve: [
    ['Ray Serve LLM', 'Python composition (routers, pre and post processing, multi-model), autoscaling, vLLM or SGLang inside', 'Less Kubernetes-native; disaggregation newer', 'Default for multi-model apps and LoRA fleets'],
    ['KServe + vLLM', 'Kubernetes-native CRD, scale to zero, canaries, standard for platform teams', 'One model per service; LLM-specific routing needs add-ons', 'Simple single-model endpoints'],
    ['NVIDIA Dynamo', 'Disaggregated prefill and decode, KV-aware routing, NIXL KV transfer, planner per pool', 'NVIDIA-centric; newer', 'Long-prompt and reasoning traffic at scale'],
    ['llm-d', 'Kubernetes-native distributed vLLM; inference gateway with prefix-aware scoring', 'Young project; vLLM only', 'Prefix-heavy chat on Kubernetes'],
    ['Triton + TensorRT-LLM', 'Highest single-GPU throughput on NVIDIA; mature server', 'Engine build per GPU, TP and precision; slower iteration', 'Stable, high-volume models like code completion'],
  ],
};

S.be = S.be || { wl: 'train', b: 'ray' };
VIEWS.backends = () => {
  const B = S.be, opts = BACKENDS[B.wl];
  if (!opts.some(([k]) => k === B.b)) B.b = opts[0][0];
  const F = ctx.F;
  const code = B.wl === 'train' ? genTrain(B.b, F.job('dpo-core-8b-assist')) : B.wl === 'rl' ? genRL(B.b, F.job('rl-core-70b-reason')) : genServe(B.b, F.dep('assistant-70b'));
  const subject = B.wl === 'train' ? 'Core 8B assistant DPO, 64 GPUs, FSDP' : B.wl === 'rl' ? 'Core 70B reasoning RL: 256 rollout GPUs, 256 trainer GPUs, 2,048 sandboxes' : 'Assistant 70B: TP 4, FP8, prefix caching, autoscaled';
  return head('Execution backends', 'Ray is one way to run these workloads. The same job, written for each alternative, and where each one wins. Crucible submits to any of them from one spec.', 'Crucible keeps a backend-neutral job spec (model, data, layout, resources, SLOs). Adapters render it for Ray, Kubernetes operators, Slurm or SkyPilot for training, and for Ray Serve, KServe, Dynamo, llm-d or Triton for serving. Teams keep one SDK; the platform picks the backend per workload, and can move work between them when capacity or requirements change. `crucible export <job> --backend <name>` prints the same configs in the terminal.') + `
  <div class="grid"><div class="card c12"><div class="row between">${seg('bewl', B.wl, [['train', 'Training'], ['rl', 'RL post-training'], ['serve', 'Serving']])}<span class="note">${h(subject)}</span></div>
    <div class="row">${seg('beb', B.b, opts)}</div>
    <pre class="code">${h(code)}</pre></div>
    <div class="card c12"><h3>When each one wins</h3><table class="table"><thead><tr><th>Backend</th><th>Strengths</th><th>Weaknesses</th><th>In Crucible</th></tr></thead><tbody>${CMP[B.wl].map(([n, a, w, u], i) => `<tr${opts[i] && opts[i][0] === B.b ? ' class="sel"' : ''}><td><b>${h(n)}</b></td><td class="small">${h(a)}</td><td class="small">${h(w)}</td><td class="small">${i === 0 ? pill('blue', 'Default') + ' ' : ''}${h(u)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card c12"><h3>Same building blocks everywhere</h3><table class="table"><thead><tr><th>Concept</th><th>Ray</th><th>Kubernetes</th><th>Slurm</th></tr></thead><tbody>${[
      ['Gang placement', 'Placement group, STRICT_PACK', 'Kueue / Volcano gang admission + topology labels', 'Allocation of N nodes, --exclusive'],
      ['Process launch', 'Ray Train worker group', 'Operator pods running torchrun', 'srun torchrun'],
      ['Failure recovery', 'FailureConfig, actor restart', 'backoffLimit, elastic restarts', '--requeue'],
      ['Data feeding', 'Ray Data streaming', 'Init containers or a loader library', 'Shared filesystem'],
      ['Mixed roles (RL)', 'Actors in one program', 'JobSet replicated jobs + services', 'Heterogeneous job steps'],
      ['Autoscaling serving', 'Serve autoscaler', 'HPA / KEDA / KServe', 'Not a fit'],
    ].map((r) => `<tr>${r.map((x, i) => `<td${i ? ' class="small"' : ''}>${i ? h(x) : `<b>${h(x)}</b>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
};
CLICKS.push(['bewl', (k) => { S.be.wl = k; }]);
CLICKS.push(['beb', (k) => { S.be.b = k; }]);
