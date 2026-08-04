# Demo script

A 10 minute walkthrough, plus the questions it invites and how to answer them.

## Before you start

```bash
cd fl-demo
python3 -m http.server 8934      # terminal 1
open http://localhost:8934
```

Have a second terminal open in `fl-demo/python` for the FSDP run.
Hard-refresh the page once (Cmd+Shift+R) so nothing is cached.

## 0. The opening line (30s)

Do not start by clicking. Start with the hero, which is already showing
measured numbers:

> "This is a federated learning platform for Apple Maps ad ranking. Everything
> on screen was measured in this browser, not quoted. The device data is
> synthetic. The training, the differential privacy, and the compression are
> real."

Saying "synthetic data, real ML" first is disarming. If you wait to be asked,
it looks like something you were hiding.

## 1. Run the whole lifecycle (1 min)

Press **Run full pipeline**. It takes about 10 seconds and walks
pre-train, federate, evaluate, compress, deploy, serve.

While it runs, say what the pipeline rail is doing. When it lands on Inference,
you have a live ad auction on screen.

Then point at the one thing that usually gets a reaction:

> "Notice it kept the pre-trained model and discarded the federated one. The DP
> noise cost more accuracy than the on-device data added at this model size, so
> the platform picked the better checkpoint. A pipeline that always ships the
> last checkpoint silently regresses models."

## 2. Privacy, and what it costs (2 min)

Train tab. Point at the **noise/signal** readout under the z slider.

> "This is z times the square root of params over K. The clip norm cancels out
> entirely, which surprises people. Only the noise multiplier, the model size,
> and how many devices you sample matter."

Move z to 3 and watch it turn red. Then:

- Turn on **Secure aggregation**, train 2 rounds.
- The **Update norms** panel goes dark and reads *withheld*.

> "That panel can only exist because the server sees each device's individual
> update. Under secure aggregation the masks cancel in the sum and the server
> can only recover the total, so there is nothing per-device left to plot. The
> panel going dark IS the guarantee."

This is the strongest single moment in the demo. Do not rush it.

## 3. Evaluation that fits the domain (1 min)

Eval tab, Run evaluation.

> "MAE and RMSE score a regressor. An ad ranker is judged on whether it puts the
> right item first, so this reports AUC, NDCG at 5, MRR, and calibration error.
> Calibration matters because eCPM consumes the pCTR value, not just its
> ranking. A model that orders perfectly but predicts twice too high misprices
> every bid in the auction."

If asked why AUC is 0.999: **volunteer that the synthetic task is easy**. Do not
defend the number.

## 4. Compression and adapters (1.5 min)

Deploy tab, Run compression analysis. Real int8, real pruning, real distillation
with measured accuracy deltas.

Then click **LoRA** (cohort defaults to a different one than training).

> "LoRA freezes the base and trains a low rank update, so only a fraction of
> parameters move. It reports the target cohort MAE and the source cohort MAE,
> because adaptation costs you accuracy on the original distribution. That is
> catastrophic forgetting and hiding it would make LoRA look free."

## 5. On-device personalization (1 min)

Inference tab, **Personalize for this device**.

> "Every other privacy mechanism here is a tax. DP costs accuracy, secure
> aggregation costs collectives, k-anonymity suppresses rows. This is the
> opposite: a 40 percent accuracy gain at zero privacy cost, because the adapter
> never leaves the device. It is a 63 parameter, 252 byte adapter. Shared global
> model plus a private local layer is Apple's architectural bet."

## 6. Reporting (1 min)

Same tab, scroll to **Advertiser reporting**. Press **Run a day of traffic**.

Watch the counts move through Delayed, then Crowd anonymity, then Aggregated.

> "Delay is randomized per impression so a report cannot be correlated with the
> moment of a tap. A bucket is released only when at least 5 distinct devices
> share it, and it counts devices not impressions, so twenty views from two
> phones never clear the bar. Sub threshold buckets are withheld entirely rather
> than rounded or noised, because below k there is no aggregate that could not
> single someone out."

## 7. Real FSDP (2 min)

Switch to your second terminal.

```bash
cd fl-demo/python
torchrun --nproc_per_node=4 scripts/train_distributed.py --strategy zero3 --preset large
```

Point at the line that says `3,585 params total, 897 materialized per rank`
and `shard ratio 4.00x`.

> "That is real torch.distributed with real FSDP. Four processes, real
> collectives, real parameter sharding. It uses gloo so the identical code path
> runs on a laptop, and swapping to nccl runs it on a real GPU box."

Then be honest about the boundary:

> "The Deploy tab computes ZeRO memory for any world size, but that is
> arithmetic. This is the part that actually executes."

## 8. The engineering, if there is time (1 min)

Open the **Code** panel (right edge). Use the lifecycle filter: click
**Federate** and you get `fl.js` and its PyTorch mirror `trainer.py` side by
side, the same algorithm in two languages.

Then `npm test`:

```
tests 13   pass 13   fail 0
```

> "Ranking metric math against known values, DP clipping, epsilon composition,
> tensor leak detection, and a test asserting the mask cancellation property."

## Questions you should expect

**"Is any of this real data?"**
No. 1.84 million synthetic devices, generated on demand from a seed. Nothing is
stored; a device only exists when sampled. Place names are real OpenStreetMap
data. Open `data/README.md` and show them.

**"Why is epsilon 48? That is enormous."**
Because the accounting composes naively across rounds. A real RDP or PLD
accountant on the identical run gives a far tighter bound. It is documented in
`fl.js` as a deliberate simplification. Volunteer this before being asked.

**"Is the federated part actually parallel?"**
No. The device loop is sequential in one tab. The algorithm is real, the
parallelism is simulated. `docs/federated-round.md` says exactly this. The FSDP
script is the part with real processes.

**"Why does pruning hurt so much?"**
At 385 parameters there is no redundancy to remove. On the 1,153 parameter model
40 percent pruning costs about 12 percent MAE. Small models are not
overparameterized, which is the whole premise pruning relies on.

**"What would you do next?"**
A serving layer with p50/p95/p99 under real concurrency, and a model registry
with lineage and one command rollback. Those are the two things a platform team
builds for other teams that this does not have yet.

## If something breaks

Every command is in the terminal (Ctrl+`) and the palette (Cmd+K). If the UI
misbehaves, `init` prints platform state and you can drive the whole demo from
the terminal. `devices` shows the real compute backend.

Do not hide a failure. Reading an error out loud and explaining what it means is
better signal than a demo that never stumbles.
