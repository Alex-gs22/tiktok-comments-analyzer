/**
 * inferenceService.js
 * ─────────────────────────────────────────────────────────
 * Model inference via HF Gradio API.
 * Handles single and batch predictions.
 * ─────────────────────────────────────────────────────────
 */

import { MODEL_INFO } from './emotionConfig';

/**
 * Classify a single comment via Gradio 2-step (submit → poll).
 * Returns { label, score, preds: [{label, score}...], isUncertain }
 */
export async function classifySingle(text) {
  const submit = await fetch(MODEL_INFO.apiSubmitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [text] }),
  });

  if (!submit.ok) {
    if (submit.status === 502 || submit.status === 503)
      throw new Error('El Space se está despertando (~30s). Intenta de nuevo.');
    throw new Error(`Error al conectar con el modelo (${submit.status})`);
  }

  const { event_id } = await submit.json();
  const poll = await fetch(`${MODEL_INFO.apiSubmitUrl}/${event_id}`);
  const raw = await poll.text();
  const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) throw new Error('Respuesta inesperada del modelo.');

  const result = JSON.parse(dataLine.slice(6))[0];
  const preds = result.confidences
    .map((c) => ({
      label: c.label.replace(/^[^\p{L}]+/u, '').trim(),
      score: c.confidence,
    }))
    .sort((a, b) => b.score - a.score);

  const top = preds[0];
  const isUncertain = top.score < MODEL_INFO.uncertaintyThreshold;

  return {
    label: isUncertain ? 'Incierto' : top.label,
    score: top.score,
    isUncertain,
    preds,
    scores: Object.fromEntries(preds.map((p) => [p.label, p.score])),
  };
}

/**
 * Classify an array of comments.
 * Returns array of results (same shape as classifySingle).
 * Includes a delay between calls to avoid rate limiting.
 */
export async function classifyBatch(texts, { onProgress, delayMs = 300 } = {}) {
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      const result = await classifySingle(texts[i]);
      results.push({ ...result, texto: texts[i], index: i });
    } catch (err) {
      results.push({
        label: 'Incierto',
        score: 0,
        isUncertain: true,
        preds: [],
        scores: {},
        texto: texts[i],
        index: i,
        error: err.message,
      });
    }
    if (onProgress) onProgress(i + 1, texts.length, results[results.length - 1]);
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

/**
 * Check if the model is awake and ready.
 */
export async function checkModelStatus() {
  try {
    await classifySingle('test');
    return true;
  } catch {
    return false;
  }
}
