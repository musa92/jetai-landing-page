# federated_ranker

Python/PyTorch implementation of the same DP-FedAvg system as the browser
demo (`fl-demo/fl.js` + `data.js` + `models.js`) — a federated learning
pipeline for ranking Apple Maps ads, trained across a simulated population
of iPhones without any raw interaction data leaving the device.

This exists so the algorithm can be read and run as ordinary Python, not
just clicked through in a browser tab. Same synthetic world, same
generative model for the data, same clip-and-noise privacy mechanics, same
simplified epsilon accounting — just PyTorch instead of TensorFlow.js.

## Layout

```
python/
  federated_ranker/
    config.py      cohorts, feature names, device population (matches data.js)
    data.py         synthetic non-IID device data, seeded per (cohort, index)
    models.py       AdRank-Net presets (small/medium/large/linear)
    privacy.py      per-update clip + Gaussian noise, epsilon accounting
    trainer.py      FederatedTrainer — the DP-FedAvg training loop
    evaluate.py      held-out eval report: MAE/RMSE/baseline lift/buckets
  scripts/
    train.py         CLI entry point
  tests/               pytest suite (18 tests, data/privacy/trainer)
  requirements.txt
```

## Install

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python scripts/train.py --cohort us --rounds 15 --k 6 --preset small
```

Flags:

| flag | default | meaning |
|---|---|---|
| `--cohort` | `us` | `all`, `us`, `eu`, `apac`, `commute`, `travel` |
| `--rounds` | `15` | federated rounds to run |
| `--k` | `6` | devices sampled per round (client sampling, not a fixed roster) |
| `--preset` | `small` | `small` / `medium` / `large` / `transformer` / `linear` |
| `--clip-norm` | `0.5` | per-update L2 clip threshold (C) |
| `--noise` | `3.0` | Gaussian noise multiplier (z); `0` disables DP entirely |
| `--local-epochs` | `2` | local epochs per client per round |

Turning `--noise 0` off is the fastest way to sanity-check the underlying
FedAvg mechanics in isolation from the privacy noise — on this synthetic
task it converges from ~0.22 MAE to ~0.07 MAE over 20 rounds and beats a
naive mean-baseline predictor by ~70%.

## Test

```bash
python -m pytest tests/ -v
```

## How this maps to the browser demo

| Browser demo | Python package |
|---|---|
| `data.js` | `federated_ranker/data.py` + `config.py` |
| `models.js` | `federated_ranker/models.py` |
| `fl.js` | `federated_ranker/trainer.py` + `privacy.py` |
| Eval tab | `federated_ranker/evaluate.py` |
| Terminal log | stdout from `scripts/train.py` |

The privacy accounting is the same intentional simplification in both: a
single Gaussian-mechanism bound per round, composed naively (additively)
across rounds. A production system would use an RDP or PLD accountant for
a materially tighter composed bound — this is the honest back-of-envelope
version, not a claim of a rigorous privacy guarantee.
