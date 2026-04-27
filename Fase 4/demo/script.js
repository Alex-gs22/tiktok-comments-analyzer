/* ═══════════════════════════════════════════════════════
   Emotion Detector — Script
   Uses Hugging Face Inference API (serverless)
   ═══════════════════════════════════════════════════════ */

const HF_MODEL = "FalexOne/robertuito-emociones-tiktok";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const EMOTION_META = {
  "Alegría":      { emoji: "😊", color: "#facc15" },
  "Confianza":    { emoji: "🤝", color: "#34d399" },
  "Miedo":        { emoji: "😰", color: "#a78bfa" },
  "Expectación":  { emoji: "😲", color: "#38bdf8" },
  "Tristeza":     { emoji: "😢", color: "#60a5fa" },
  "Rechazo":      { emoji: "😤", color: "#f87171" },
};

// ─── DOM References ───────────────────────────────────────

const textarea = document.getElementById("comment-input");
const charCount = document.getElementById("char-count");
const analyzeBtn = document.getElementById("analyze-btn");
const resultsEl = document.getElementById("results");
const resultsBars = document.getElementById("results-bars");
const predictionBadge = document.getElementById("prediction-badge");
const resultsMeta = document.getElementById("results-meta");
const errorEl = document.getElementById("error-msg");
const errorText = document.getElementById("error-text");
const chips = document.querySelectorAll(".chip");

// ─── State ────────────────────────────────────────────────

let isLoading = false;

// ─── Event Listeners ──────────────────────────────────────

textarea.addEventListener("input", () => {
  charCount.textContent = textarea.value.length;
  analyzeBtn.disabled = textarea.value.trim().length === 0;
});

textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!analyzeBtn.disabled && !isLoading) analyzeEmotion();
  }
});

analyzeBtn.addEventListener("click", () => {
  if (!isLoading) analyzeEmotion();
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.dataset.text;
    textarea.value = text;
    charCount.textContent = text.length;
    analyzeBtn.disabled = false;
    textarea.focus();
    analyzeEmotion();
  });
});

// ─── API Call ─────────────────────────────────────────────

async function queryHuggingFace(text) {
  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text }),
  });

  if (response.status === 503) {
    const data = await response.json();
    const wait = data.estimated_time || 20;
    throw new Error(
      `El modelo se está cargando. Espera ~${Math.ceil(wait)}s e intenta de nuevo.`
    );
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Error HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Main Analyze Function ────────────────────────────────

async function analyzeEmotion() {
  const text = textarea.value.trim();
  if (!text) return;

  setLoading(true);
  hideError();
  hideResults();

  try {
    const data = await queryHuggingFace(text);

    // HF returns [[{label, score}, ...]] for text-classification
    const predictions = Array.isArray(data[0]) ? data[0] : data;

    // Sort by score descending
    predictions.sort((a, b) => b.score - a.score);

    showResults(predictions, text);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// ─── UI Helpers ───────────────────────────────────────────

function setLoading(loading) {
  isLoading = loading;
  analyzeBtn.disabled = loading;
  analyzeBtn.classList.toggle("btn--loading", loading);
}

function showResults(predictions, text) {
  resultsBars.innerHTML = "";

  const top = predictions[0];
  const meta = EMOTION_META[top.label] || { emoji: "❓", color: "#888" };

  // Prediction badge
  predictionBadge.textContent = `${meta.emoji} ${top.label}`;
  predictionBadge.style.background = `${meta.color}20`;
  predictionBadge.style.color = meta.color;
  predictionBadge.style.border = `1px solid ${meta.color}40`;

  // Bars
  predictions.forEach((pred, i) => {
    const info = EMOTION_META[pred.label] || { emoji: "❓", color: "#888" };
    const pct = (pred.score * 100).toFixed(1);

    const row = document.createElement("div");
    row.className = `bar-row${i === 0 ? " bar-row--top" : ""}`;
    row.dataset.emotion = pred.label;

    row.innerHTML = `
      <div class="bar-row__label">${info.emoji} ${pred.label}</div>
      <div class="bar-row__track">
        <div class="bar-row__fill" style="width: 0%"></div>
      </div>
      <div class="bar-row__pct">${pct}%</div>
    `;

    resultsBars.appendChild(row);

    // Animate bar width after a brief delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        row.querySelector(".bar-row__fill").style.width = `${pct}%`;
      });
    });
  });

  // Meta info
  const confidence = top.score >= 0.6 ? "Alta" : top.score >= 0.4 ? "Media" : "Baja";
  resultsMeta.innerHTML = `
    <span>Confianza: <strong>${confidence}</strong> (${(top.score * 100).toFixed(1)}%)</span>
    <span>${text.length} caracteres analizados</span>
  `;

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideResults() {
  resultsEl.hidden = true;
}

function showError(message) {
  errorText.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}
