"""AdRank-Net architectures — same presets as the browser demo's models.js.
A tiny sigmoid-output regressor predicting a [0, 1] ad engagement score."""

import torch
import torch.nn as nn

from .config import NUM_FEATURES

MODEL_PRESETS = {
    "small": [16, 8],
    "medium": [32, 16, 8],
    "large": [64, 32, 16],
    "linear": [],
}

# Attention hyperparameters, matching models.js's ATTN_* constants exactly so
# the JS and PyTorch implementations are the same architecture, not just the
# same idea.
ATTN_SEQ_LEN = 6
ATTN_D_MODEL = 8
ATTN_NUM_HEADS = 2
ATTN_HEAD_DIM = ATTN_D_MODEL // ATTN_NUM_HEADS


class AdRankTransformer(nn.Module):
    """Tabular self-attention block: SEQ_LEN independent linear projections of
    the full feature vector act as learned token 'slots' (the tabular analogue
    of FT-Transformer-style feature tokenization, not a 1:1 feature->token
    mapping), then standard multi-head self-attention + a feed-forward block
    relate those tokens to each other before pooling to a single score."""

    def __init__(self, num_features: int = NUM_FEATURES):
        super().__init__()
        self.tokenizers = nn.ModuleList(
            [nn.Linear(num_features, ATTN_D_MODEL) for _ in range(ATTN_SEQ_LEN)]
        )
        self.q = nn.ModuleList([nn.Linear(ATTN_D_MODEL, ATTN_HEAD_DIM) for _ in range(ATTN_NUM_HEADS)])
        self.k = nn.ModuleList([nn.Linear(ATTN_D_MODEL, ATTN_HEAD_DIM) for _ in range(ATTN_NUM_HEADS)])
        self.v = nn.ModuleList([nn.Linear(ATTN_D_MODEL, ATTN_HEAD_DIM) for _ in range(ATTN_NUM_HEADS)])
        self.attn_out = nn.Linear(ATTN_D_MODEL, ATTN_D_MODEL)
        self.norm1 = nn.LayerNorm(ATTN_D_MODEL)
        self.ffn1 = nn.Linear(ATTN_D_MODEL, ATTN_D_MODEL * 2)
        self.ffn2 = nn.Linear(ATTN_D_MODEL * 2, ATTN_D_MODEL)
        self.norm2 = nn.LayerNorm(ATTN_D_MODEL)
        self.head = nn.Linear(ATTN_D_MODEL, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        tokens = torch.stack([torch.relu(t(x)) for t in self.tokenizers], dim=1)  # [B, seq, d_model]

        head_outs = []
        for q_l, k_l, v_l in zip(self.q, self.k, self.v):
            q, k, v = q_l(tokens), k_l(tokens), v_l(tokens)
            scores = torch.bmm(q, k.transpose(1, 2)) / (ATTN_HEAD_DIM ** 0.5)  # [B, seq, seq]
            weights = torch.softmax(scores, dim=-1)
            head_outs.append(torch.bmm(weights, v))  # [B, seq, head_dim]
        attn = self.attn_out(torch.cat(head_outs, dim=-1))

        x1 = self.norm1(tokens + attn)
        ffn = self.ffn2(torch.relu(self.ffn1(x1)))
        x2 = self.norm2(x1 + ffn)

        pooled = x2.mean(dim=1)  # global average pool over tokens
        return torch.sigmoid(self.head(pooled))


def build_model(preset: str = "small") -> nn.Module:
    if preset == "transformer":
        return AdRankTransformer()
    if preset not in MODEL_PRESETS:
        valid = ", ".join(list(MODEL_PRESETS) + ["transformer"])
        raise KeyError(f"Unknown preset '{preset}', valid: {valid}")
    hidden = MODEL_PRESETS[preset]
    layers = []
    in_dim = NUM_FEATURES
    for units in hidden:
        layers.append(nn.Linear(in_dim, units))
        layers.append(nn.ReLU())
        in_dim = units
    layers.append(nn.Linear(in_dim, 1))
    layers.append(nn.Sigmoid())
    return nn.Sequential(*layers)


def count_params(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())
