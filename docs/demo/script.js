/* ═══════════════════════════════════════════════════════
   Emotion Detector — TikTok Comments Analyzer
   Calls Gradio API on HF Spaces (2-step: submit → poll)
   ═══════════════════════════════════════════════════════ */

const SPACE = "https://falexone-tiktok-emotion-detector.hf.space";
const API_SUBMIT = SPACE + "/gradio_api/call/predict";

const EMOTION_META = {
  "Alegría":     { emoji: "😊", color: "#facc15" },
  "Confianza":   { emoji: "🤝", color: "#34d399" },
  "Miedo":       { emoji: "😰", color: "#a78bfa" },
  "Expectación": { emoji: "😲", color: "#38bdf8" },
  "Tristeza":    { emoji: "😢", color: "#60a5fa" },
  "Rechazo":     { emoji: "😤", color: "#f87171" },
};

/* ─── DOM ─────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);
const textarea   = $("comment-input");
const charCount  = $("char-count");
const analyzeBtn = $("analyze-btn");
const resultsEl  = $("results");
const resultsBars = $("results-bars");
const badge      = $("prediction-badge");
const metaEl     = $("results-meta");
const errorEl    = $("error-msg");
const errorText  = $("error-text");
const statusEl   = $("model-status");
const chips      = document.querySelectorAll(".chip");

let busy = false;

/* ─── Gradio API (2-step) ─────────────────────────────── */

async function classify(text) {
  // Step 1: Submit → get event_id
  const submit = await fetch(API_SUBMIT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [text] }),
  });

  if (!submit.ok) {
    if (submit.status === 502 || submit.status === 503)
      throw new Error("El Space se está despertando (~30s). Intenta de nuevo.");
    throw new Error("Error al conectar con el modelo (" + submit.status + ")");
  }

  const { event_id } = await submit.json();

  // Step 2: Poll result via SSE
  const poll = await fetch(API_SUBMIT + "/" + event_id);
  const raw  = await poll.text();

  // Parse SSE response: "event: complete\ndata: [...]"
  const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
  if (!dataLine) throw new Error("Respuesta inesperada del modelo.");

  const parsed = JSON.parse(dataLine.slice(6)); // remove "data: "
  return parsed[0]; // { label, confidences: [{label, confidence}] }
}

/* ─── Status check ────────────────────────────────────── */

async function checkStatus() {
  statusEl.textContent = "⏳ Conectando con el modelo...";
  statusEl.className = "model-status model-status--loading";
  try {
    await classify("test");
    setReady();
  } catch {
    statusEl.textContent = "⏳ El modelo está iniciando (~30s)...";
  }
}

function setReady() {
  statusEl.textContent = "✅ Modelo listo";
  statusEl.className = "model-status model-status--ready";
}

checkStatus();

/* ─── Events ──────────────────────────────────────────── */

textarea.addEventListener("input", () => {
  charCount.textContent = textarea.value.length;
  analyzeBtn.disabled = !textarea.value.trim();
});

textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!analyzeBtn.disabled && !busy) run();
  }
});

analyzeBtn.addEventListener("click", () => { if (!busy) run(); });

chips.forEach((c) =>
  c.addEventListener("click", () => {
    textarea.value = c.dataset.text;
    charCount.textContent = c.dataset.text.length;
    analyzeBtn.disabled = false;
    run();
  })
);

/* ─── Main ────────────────────────────────────────────── */

async function run() {
  const text = textarea.value.trim();
  if (!text) return;

  busy = true;
  analyzeBtn.disabled = true;
  analyzeBtn.classList.add("btn--loading");
  errorEl.hidden = true;
  resultsEl.hidden = true;

  try {
    const result = await classify(text);
    setReady();
    render(result, text);
  } catch (err) {
    errorText.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    busy = false;
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove("btn--loading");
  }
}

/* ─── Render results ──────────────────────────────────── */

function render(result, text) {
  resultsBars.innerHTML = "";

  const preds = result.confidences
    .map((c) => ({
      label: c.label.replace(/^[^\p{L}]+/u, "").trim(),
      score: c.confidence,
    }))
    .sort((a, b) => b.score - a.score);

  const top  = preds[0];
  const meta = EMOTION_META[top.label] || { emoji: "❓", color: "#888" };

  badge.textContent = meta.emoji + " " + top.label;
  badge.style.cssText =
    "background:" + meta.color + "20;color:" + meta.color +
    ";border:1px solid " + meta.color + "40";

  preds.forEach((p, i) => {
    const info = EMOTION_META[p.label] || { emoji: "❓", color: "#888" };
    const pct  = (p.score * 100).toFixed(1);
    const row  = document.createElement("div");
    row.className = "bar-row" + (i === 0 ? " bar-row--top" : "");
    row.dataset.emotion = p.label;
    row.innerHTML =
      '<div class="bar-row__label">' + info.emoji + " " + p.label + "</div>" +
      '<div class="bar-row__track"><div class="bar-row__fill" style="width:0%"></div></div>' +
      '<div class="bar-row__pct">' + pct + "%</div>";
    resultsBars.appendChild(row);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        row.querySelector(".bar-row__fill").style.width = pct + "%"
      )
    );
  });

  const conf = top.score >= 0.6 ? "Alta" : top.score >= 0.4 ? "Media" : "Baja";
  metaEl.innerHTML =
    "<span>Confianza: <strong>" + conf + "</strong> (" +
    (top.score * 100).toFixed(1) + "%)</span>" +
    "<span>" + text.length + " caracteres</span>";

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
