/* ═══════════════════════════════════════════════════════
   Emotion Detector — Script
   Uses Transformers.js (runs model in browser, no API)
   ═══════════════════════════════════════════════════════ */

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.6.0";

const HF_MODEL = "FalexOne/robertuito-emociones-tiktok";

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
const errorHint = document.querySelector(".error-card__hint");
const chips = document.querySelectorAll(".chip");
const statusEl = document.getElementById("model-status");

// ─── State ────────────────────────────────────────────────

let isLoading = false;
let classifier = null;
let modelReady = false;

// ─── Load Model on Page Load ──────────────────────────────

async function loadModel() {
  statusEl.textContent = "⏳ Cargando modelo (~30s la primera vez)...";
  statusEl.className = "model-status model-status--loading";

  try {
    classifier = await pipeline("text-classification", HF_MODEL, {
      dtype: "fp32",
      device: "wasm",
    });
    modelReady = true;
    statusEl.textContent = "✅ Modelo listo — ejecutándose en tu navegador";
    statusEl.className = "model-status model-status--ready";
  } catch (err) {
    console.error("Error loading model:", err);
    statusEl.textContent = "❌ Error al cargar el modelo";
    statusEl.className = "model-status model-status--error";
  }
}

loadModel();

// ─── Event Listeners ──────────────────────────────────────

textarea.addEventListener("input", () => {
  charCount.textContent = textarea.value.length;
  analyzeBtn.disabled = textarea.value.trim().length === 0 || !modelReady;
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
    if (!modelReady) return;
    const text = chip.dataset.text;
    textarea.value = text;
    charCount.textContent = text.length;
    analyzeBtn.disabled = false;
    textarea.focus();
    analyzeEmotion();
  });
});

// ─── Main Analyze Function ────────────────────────────────

async function analyzeEmotion() {
  const text = textarea.value.trim();
  if (!text || !modelReady) return;

  setLoading(true);
  hideError();
  hideResults();

  try {
    const results = await classifier(text, { top_k: 6 });

    // results is an array of {label, score}
    const predictions = Array.isArray(results[0]) ? results[0] : results;
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

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        row.querySelector(".bar-row__fill").style.width = `${pct}%`;
      });
    });
  });

  const confidence = top.score >= 0.6 ? "Alta" : top.score >= 0.4 ? "Media" : "Baja";
  resultsMeta.innerHTML = `
    <span>Confianza: <strong>${confidence}</strong> (${(top.score * 100).toFixed(1)}%)</span>
    <span>${text.length} caracteres · Inferencia local</span>
  `;

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideResults() {
  resultsEl.hidden = true;
}

function showError(message) {
  errorText.textContent = message;
  errorHint.textContent = "El modelo se ejecuta localmente en tu navegador. Intenta recargar la página.";
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}
