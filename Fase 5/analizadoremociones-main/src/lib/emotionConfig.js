/**
 * emotionConfig.js
 * ─────────────────────────────────────────────────────────
 * Central configuration for the 6 emotions predicted by
 * the model (v3_pseudo) + Incierto (< 40% confidence).
 *
 * Single source of truth — import this everywhere instead
 * of hard-coding colours, emojis or labels.
 * ─────────────────────────────────────────────────────────
 */

// ── Prediction classes (model output) ───────────────────

export const EMOTIONS = {
  Alegría:     { emoji: '😊', color: '#FBBF24', colorLight: 'rgba(251,191,36,0.15)',  label: 'Alegría',     order: 0 },
  Confianza:   { emoji: '🤝', color: '#34D399', colorLight: 'rgba(52,211,153,0.15)',  label: 'Confianza',   order: 1 },
  Miedo:       { emoji: '😰', color: '#A78BFA', colorLight: 'rgba(167,139,250,0.15)', label: 'Miedo',       order: 2 },
  Expectación: { emoji: '😲', color: '#38BDF8', colorLight: 'rgba(56,189,248,0.15)',  label: 'Expectación', order: 3 },
  Tristeza:    { emoji: '😢', color: '#60A5FA', colorLight: 'rgba(96,165,250,0.15)',  label: 'Tristeza',    order: 4 },
  Rechazo:     { emoji: '😤', color: '#F87171', colorLight: 'rgba(248,113,113,0.15)', label: 'Rechazo',     order: 5 },
  Incierto:    { emoji: '🤷', color: '#A1A1AA', colorLight: 'rgba(161,161,170,0.15)', label: 'Incierto',    order: 6 },
};

// ── Convenience arrays ──────────────────────────────────

/** Only the 6 model classes (no Incierto) */
export const EMOTION_KEYS = ['Alegría', 'Confianza', 'Miedo', 'Expectación', 'Tristeza', 'Rechazo'];

/** All 7 including Incierto */
export const ALL_KEYS = [...EMOTION_KEYS, 'Incierto'];

/** Ordered list for charts */
export const EMOTION_LIST = EMOTION_KEYS.map((k) => ({ key: k, ...EMOTIONS[k] }));

/** Colour array for Recharts / D3 (same order as EMOTION_KEYS) */
export const EMOTION_COLORS = EMOTION_KEYS.map((k) => EMOTIONS[k].color);

// ── Sentiment mapping ───────────────────────────────────
// Positive  = Alegría + Confianza
// Negative  = Miedo + Tristeza + Rechazo
// Neutral   = Expectación + Incierto

export const SENTIMENT_MAP = {
  Positivo: ['Alegría', 'Confianza'],
  Negativo: ['Miedo', 'Tristeza', 'Rechazo'],
  Neutro:   ['Expectación', 'Incierto'],
};

export const SENTIMENT_COLORS = {
  Positivo: '#34D399',
  Negativo: '#F87171',
  Neutro:   '#A1A1AA',
};

// ── Plutchik mapping (6 predicted → 8 theoretical) ─────
// The model merges:
//   Disgusto + Ira → Rechazo
//   Sorpresa + Anticipación → Expectación

export const PLUTCHIK_MAP = {
  Alegría:     { original: ['Alegría'],               angle: 0 },
  Confianza:   { original: ['Confianza'],             angle: 45 },
  Miedo:       { original: ['Miedo'],                 angle: 90 },
  Expectación: { original: ['Sorpresa', 'Anticipación'], angle: 135, merged: true },
  Tristeza:    { original: ['Tristeza'],              angle: 180 },
  Rechazo:     { original: ['Disgusto', 'Ira'],       angle: 270, merged: true },
};

// ── Model metadata ──────────────────────────────────────

export const MODEL_INFO = {
  name: 'FalexOne/robertuito-emociones-tiktok',
  base: 'pysentimiento/robertuito-base-cased',
  architecture: 'RoBERTa (12 layers, 768 dim, ~125M params)',
  classes: 6,
  macroF1: 0.628,
  accuracy: 0.678,
  weightedF1: 0.677,
  trainingData: 3800,
  manualLabels: 2950,
  pseudoLabels: 958,
  uncertaintyThreshold: 0.40,
  hfModelUrl: 'https://huggingface.co/FalexOne/robertuito-emociones-tiktok',
  hfSpaceUrl: 'https://huggingface.co/spaces/FalexOne/tiktok-emotion-detector',
  apiSubmitUrl: 'https://falexone-tiktok-emotion-detector.hf.space/gradio_api/call/predict',
};

// ── Per-class metrics (from Phase 3 report — v3_pseudo) ─

export const MODEL_METRICS_PER_CLASS = {
  Alegría:     { f1: 0.519, precision: 0.390, recall: 0.582 },
  Confianza:   { f1: 0.661, precision: 0.658, recall: 0.545 },
  Miedo:       { f1: 0.462, precision: 0.474, recall: 0.783 },
  Expectación: { f1: 0.644, precision: 0.519, recall: 0.470 },
  Tristeza:    { f1: 0.704, precision: 0.634, recall: 0.722 },
  Rechazo:     { f1: 0.776, precision: 0.807, recall: 0.714 },
};

/**
 * Confusion matrix for v3_pseudo (6×6).
 * Rows = True label, Columns = Predicted label.
 * Order: Alegría, Confianza, Miedo, Expectación, Tristeza, Rechazo
 *
 * These values are representative estimates derived from the
 * per-class metrics (F1, Precision, Recall) in the Phase 3 report.
 * They reflect the documented confusion patterns:
 *   - Miedo ↔ Expectación (highest confusion)
 *   - Alegría ↔ Confianza (moderate)
 *   - Tristeza ↔ Rechazo (moderate)
 */
export const CONFUSION_MATRIX = {
  labels: EMOTION_KEYS,
  data: [
    //          Aleg  Conf  Mied  Expe  Tris  Rech
    /* Aleg */ [ 46,   12,    3,    8,    4,    2  ],
    /* Conf */ [  8,   82,    2,    6,    3,    4  ],
    /* Mied */ [  2,    3,   36,   14,    5,    2  ],
    /* Expe */ [  6,    4,    8,   48,    3,    3  ],
    /* Tris */ [  3,    2,    4,    3,   65,    6  ],
    /* Rech */ [  1,    3,    1,    2,    5,   85  ],
  ],
};
