from federated_ranker.config import get_cohort
from federated_ranker.data import build_cohort_validation, build_round_clients
from federated_ranker.evaluate import evaluate
from federated_ranker.models import count_params
from federated_ranker.trainer import FederatedTrainer


def _make_trainer(cohort_id="us", **kwargs):
    cohort = get_cohort(cohort_id)
    val_xs, val_ys = build_cohort_validation(cohort)
    trainer = FederatedTrainer(val_xs, val_ys, **kwargs)
    return cohort, trainer


def test_one_round_produces_valid_stat():
    cohort, trainer = _make_trainer()
    clients = build_round_clients(cohort, k=5, round_seed=1)
    stat = trainer.run_round(clients)

    assert stat.round == 1
    assert trainer.round == 1
    assert 0.0 <= stat.val_mae <= 2.0
    assert stat.val_loss >= 0.0
    assert len(stat.client_stats) == 5
    assert 0.0 <= stat.clip_rate <= 1.0


def test_epsilon_accumulates_across_rounds():
    cohort, trainer = _make_trainer(noise_multiplier=2.0)
    for i in range(3):
        clients = build_round_clients(cohort, k=4, round_seed=i)
        trainer.run_round(clients)
    assert trainer.history[0].epsilon_total < trainer.history[1].epsilon_total < trainer.history[2].epsilon_total


def test_zero_noise_gives_infinite_epsilon():
    cohort, trainer = _make_trainer(noise_multiplier=0.0)
    clients = build_round_clients(cohort, k=4, round_seed=1)
    stat = trainer.run_round(clients)
    assert stat.epsilon_total == float("inf")


def test_training_without_dp_reduces_loss_over_rounds():
    """Sanity check that the core FedAvg mechanics (data, local training,
    aggregation) are actually correct: with privacy noise disabled, loss
    should trend down over enough rounds on this synthetic, learnable task."""
    cohort, trainer = _make_trainer(noise_multiplier=0.0, local_epochs=3)
    for i in range(12):
        clients = build_round_clients(cohort, k=8, round_seed=i)
        trainer.run_round(clients)
    first_mae = trainer.history[0].val_mae
    last_mae = trainer.history[-1].val_mae
    assert last_mae < first_mae * 0.6


def test_model_snapshot_is_independent_of_live_model():
    """Mirrors the browser demo's checkpoint guarantee: cloning weights into
    a fresh model must not alias the live model's parameters."""
    import copy
    import torch

    cohort, trainer = _make_trainer()
    clients = build_round_clients(cohort, k=4, round_seed=1)
    trainer.run_round(clients)

    from federated_ranker.models import build_model

    snapshot = build_model(trainer.preset)
    snapshot.load_state_dict(copy.deepcopy(trainer.model.state_dict()))

    clients2 = build_round_clients(cohort, k=4, round_seed=2)
    trainer.run_round(clients2)  # keep training the live model

    live_param = next(trainer.model.parameters())
    snap_param = next(snapshot.parameters())
    assert not torch.equal(live_param, snap_param)


def test_evaluate_returns_sane_report():
    cohort, trainer = _make_trainer(noise_multiplier=0.0)
    for i in range(5):
        clients = build_round_clients(cohort, k=6, round_seed=i)
        trainer.run_round(clients)

    report = evaluate(trainer)
    assert report.mae >= 0.0
    assert report.rmse >= report.mae * 0.99  # RMSE >= MAE always, small float slack
    assert len(report.buckets) == 3
    assert sum(b.count for b in report.buckets) == len(trainer.val_ys)


def test_model_param_counts_match_presets():
    assert count_params(_make_trainer(preset="small")[1].model) < count_params(_make_trainer(preset="medium")[1].model)
    assert count_params(_make_trainer(preset="medium")[1].model) < count_params(_make_trainer(preset="large")[1].model)
