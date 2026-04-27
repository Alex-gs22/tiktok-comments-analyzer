/* ═══════════════════════════════════════════════════════
   Emotion Detector — Script
   Uses Gradio API from HF Spaces (free, CORS enabled)
   ═══════════════════════════════════════════════════════ */

const SPACE_URL = "https://falexone-tiktok-emotion-detector.hf.space";
const GRADIO_API = `${SPACE_URL}/api/predict`;

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
const statusEl = document.getElementById("model-status");

// ─── State ────────────────────────────────────────────────

let isLoading = false;

// ─── Check Space Status ───────────────────────────────────

async function checkSpace() {
  statusEl.textContent = "⏳ Conectando con el modelo...";
  statusEl.className = "model-status model-status--loading";

  try {
    const resp = await fetch(`${SPACE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: ["test"] }),
    });
    if (resp.ok) {
      statusEl.textContent = "✅ Modelo conectado — listo para analizar";
      statusEl.className = "model-status model-status--ready";
    } else {
      statusEl.textContent = "⏳ Modelo iniciando (~1 min la primera vez)...";
    }
  } catch {
    statusEl.textContent = "⏳ Modelo iniciando — intenta en 1 minuto...";
    statusEl.className = "model-status model-status--loading";
  }
}

checkSpace();

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

async function queryGradio(text) {
  const response = await fetch(GRADIO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [text] }),
  });

  if (!response.ok) {
    if (response.status === 503 || response.status === 502) {
      throw new Error("El modelo se está iniciando. Espera ~1 minuto e intenta de nuevo.");
    }
    throw new Error(`Error del servidor: ${response.status}`);
  }

  const result = await response.json();
  // Gradio returns { data: [{ label: score, ... }] } for gr.Label
  return result.data[0];
}

// ─── Main Analyze Function ────────────────────────────────

async function analyzeEmotion() {
  const text = textarea.value.trim();
  if (!text) return;

  setLoading(true);
  hideError();
  hideResults();

  try {
    const labelScores = await queryGradio(text);

    // Convert {label: score} to [{label, score}] format
    const predictions = Object.entries(labelScores.confidences || labelScores)
      .map(([label, score]) => {
        // Handle both Gradio formats: confidences array or label dict
        if (typeof score === "object") {
          return { label: score.label, score: score.confidence };
        }
        return { label: label.replace(/^[^\w]+ /, ""), score };
      });

    // If Gradio returned confidences array directly
    if (labelScores.confidences) {
      predictions.length = 0;
      for (const c of labelScores.confidences) {
        predictions.push({
          label: c.label.replace(/^[^\w]+ /, ""), // remove emoji prefix
          score: c.confidence,
        });
      }
    }

    predictions.sort((a, b) => b.score - a.score);

    statusEl.textContent = "✅ Modelo conectado — listo para analizar";
    statusEl.className = "model-status model-status--ready";

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

  predictionBadge.textContent = `${meta.emoji} ${top.label}`;
  predictionBadge.style.background = `${meta.color}20`;
  predictionBadge.style.color = meta.color;
  predictionBadge.style.border = `1px solid ${meta.color}40`;

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

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        row.querySelector(".bar-row__fill").style.width = `${pct}%`;
      });
    });
  });

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
