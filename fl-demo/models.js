// Model architectures for the coordinator's global model. Presets build a fresh
// tf.js model from scratch; import loads a real exported tf.js LayersModel
// (model.json + weight shard .bin files) via tf.io.browserFiles, validates the
// input/output shape matches this dataset, and uses it as the starting point.

const MODEL_PRESETS = {
  small: { label: "AdRank-Net S · 16-8-1", hidden: [16, 8] },
  medium: { label: "AdRank-Net M · 32-16-8-1", hidden: [32, 16, 8] },
  large: { label: "AdRank-Net L · 64-32-16-1", hidden: [64, 32, 16] },
  linear: { label: "Linear baseline · 1", hidden: [] },
  transformer: { label: "AdRank-Transformer · 2-head attn (6 tok x 8d)", attention: true },
};

// Attention hyperparameters for the transformer preset. SEQ_LEN tokens are
// *learned slots*, not a 1:1 mapping to the 14 raw features: each slot is an
// independent linear projection of the full feature vector (the tabular
// analogue of FT-Transformer-style feature tokenization), so self-attention
// has an actual sequence to relate rather than needing per-feature slicing.
const ATTN_SEQ_LEN = 6;
const ATTN_D_MODEL = 8;
const ATTN_NUM_HEADS = 2;
const ATTN_HEAD_DIM = ATTN_D_MODEL / ATTN_NUM_HEADS;

function buildAttentionModel(numFeatures, lr) {
  const input = tf.input({ shape: [numFeatures] });

  const tokenSlots = [];
  for (let i = 0; i < ATTN_SEQ_LEN; i++) {
    const slot = tf.layers.dense({ units: ATTN_D_MODEL, activation: "relu" }).apply(input);
    tokenSlots.push(tf.layers.reshape({ targetShape: [1, ATTN_D_MODEL] }).apply(slot));
  }
  const tokens = tf.layers.concatenate({ axis: 1 }).apply(tokenSlots); // [ATTN_SEQ_LEN, ATTN_D_MODEL]

  // Multi-head self-attention, built head-by-head from stock tf.js layers
  // (this bundle has no fused MultiHeadAttention layer) and concatenated.
  const headOutputs = [];
  for (let h = 0; h < ATTN_NUM_HEADS; h++) {
    const Q = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: ATTN_HEAD_DIM }) }).apply(tokens);
    const K = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: ATTN_HEAD_DIM }) }).apply(tokens);
    const V = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: ATTN_HEAD_DIM }) }).apply(tokens);

    let scores = tf.layers.dot({ axes: [2, 2] }).apply([Q, K]); // [seq, seq]
    scores = tf.layers.rescaling({ scale: 1 / Math.sqrt(ATTN_HEAD_DIM) }).apply(scores);
    const weights = tf.layers.softmax({ axis: -1 }).apply(scores);
    headOutputs.push(tf.layers.dot({ axes: [2, 1] }).apply([weights, V])); // [seq, headDim]
  }
  const multiHead = ATTN_NUM_HEADS > 1 ? tf.layers.concatenate({ axis: -1 }).apply(headOutputs) : headOutputs[0];
  const attnOut = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: ATTN_D_MODEL }) }).apply(multiHead);

  // Residual + layer norm, then a standard position-wise feed-forward block.
  let x = tf.layers.add().apply([tokens, attnOut]);
  x = tf.layers.layerNormalization().apply(x);
  const ffn1 = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: ATTN_D_MODEL * 2, activation: "relu" }) }).apply(x);
  const ffn2 = tf.layers.timeDistributed({ layer: tf.layers.dense({ units: ATTN_D_MODEL }) }).apply(ffn1);
  let y = tf.layers.add().apply([x, ffn2]);
  y = tf.layers.layerNormalization().apply(y);

  const pooled = tf.layers.globalAveragePooling1d().apply(y);
  const output = tf.layers.dense({ units: 1, activation: "sigmoid" }).apply(pooled);

  const model = tf.model({ inputs: input, outputs: output });
  model.compile({ optimizer: tf.train.adam(lr), loss: "meanSquaredError" });
  return model;
}

function buildPresetModel(key, numFeatures, lr) {
  const spec = MODEL_PRESETS[key] || MODEL_PRESETS.small;
  if (spec.attention) return buildAttentionModel(numFeatures, lr);

  const model = tf.sequential();
  if (spec.hidden.length === 0) {
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid", inputShape: [numFeatures] }));
  } else {
    spec.hidden.forEach((units, i) => {
      model.add(
        i === 0
          ? tf.layers.dense({ units, activation: "relu", inputShape: [numFeatures] })
          : tf.layers.dense({ units, activation: "relu" })
      );
    });
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  }
  model.compile({ optimizer: tf.train.adam(lr), loss: "meanSquaredError" });
  return model;
}

function makePresetModelSpec(key, numFeatures, lr) {
  return {
    key,
    label: (MODEL_PRESETS[key] || MODEL_PRESETS.small).label,
    initialModel: buildPresetModel(key, numFeatures, lr),
    cloneFactory: async () => buildPresetModel(key, numFeatures, lr),
  };
}

async function makeImportedModelSpec(fileList, numFeatures, lr) {
  const files = Array.from(fileList);
  const jsonFile = files.find((f) => f.name.toLowerCase().endsWith(".json"));
  if (!jsonFile) {
    throw new Error("Select the model.json file together with its weight .bin shard(s).");
  }

  let loaded;
  try {
    loaded = await tf.loadLayersModel(tf.io.browserFiles(files));
  } catch (err) {
    throw new Error(`Couldn't load model: ${err.message || err}`);
  }

  const inShape = loaded.inputs[0].shape;
  const outShape = loaded.outputs[0].shape;
  const inFeatures = inShape[inShape.length - 1];
  const outUnits = outShape[outShape.length - 1];

  if (inFeatures !== numFeatures) {
    loaded.dispose();
    throw new Error(`Model expects ${inFeatures} input features — this dataset has ${numFeatures} ranking feature channels.`);
  }
  if (outUnits !== 1) {
    loaded.dispose();
    throw new Error(`Model must output exactly 1 value (predicted engagement score) — this model outputs ${outUnits}.`);
  }

  loaded.compile({ optimizer: tf.train.adam(lr), loss: "meanSquaredError" });
  const topology = loaded.toJSON(null, false);

  return {
    key: "imported",
    label: `Imported · ${jsonFile.name.replace(/\.json$/i, "")}`,
    initialModel: loaded,
    cloneFactory: async () => {
      const m = await tf.models.modelFromJSON(topology);
      m.compile({ optimizer: tf.train.adam(lr), loss: "meanSquaredError" });
      return m;
    },
  };
}
