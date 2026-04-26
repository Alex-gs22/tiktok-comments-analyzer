import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { PseudoLabel, EmocionFusionada, ReviewStats } from "../types";
import "./Reviewer.css";

const COOLDOWN_SECONDS = 3;
const BATCH_SIZE = 5;

const EMOCION_COLORS: Record<string, string> = {
  Alegría: "#f6ad55",
  Confianza: "#68d391",
  Miedo: "#b794f4",
  Expectación: "#63b3ed",
  Tristeza: "#90cdf4",
  Rechazo: "#fc8181",
};

function confidenceColor(conf: number): string {
  if (conf >= 0.7) return "#48bb78";
  if (conf >= 0.5) return "#ecc94b";
  return "#f56565";
}

function confidenceLabel(conf: number): string {
  if (conf >= 0.7) return "Alta";
  if (conf >= 0.5) return "Media";
  return "Baja";
}

/** Generate a UUID v4 (crypto-safe) */
function uuid4(): string {
  return crypto.randomUUID();
}

/** Get or create session ID for this tab (persists per tab via sessionStorage) */
function getSessionId(): string {
  const KEY = "reviewer-session-id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = uuid4();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

/** Get or create reviewer name (persists across tabs via localStorage) */
function getReviewerName(): string | null {
  return localStorage.getItem("reviewer-name");
}

function setReviewerName(name: string) {
  localStorage.setItem("reviewer-name", name.trim());
}

/* ═══════════════════════════════════════════════════════════
   Login Screen – Reviewer Name
   ═══════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length >= 2) {
      onLogin(trimmed);
    }
  };

  return (
    <div className="rv-login-backdrop">
      <form className="rv-login-card" onSubmit={submit}>
        <div className="rv-login-icon">👤</div>
        <h2 className="rv-login-title">Revisor de Pseudo-Labels</h2>
        <p className="rv-login-subtitle">
          Ingresa tu nombre para iniciar tu sesión de revisión.
          <br />
          Cada pestaña trabaja con comentarios exclusivos.
        </p>
        <input
          className="rv-login-input"
          type="text"
          placeholder="Tu nombre…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          minLength={2}
          maxLength={40}
        />
        <button
          className="rv-login-btn"
          type="submit"
          disabled={name.trim().length < 2}
        >
          Comenzar revisión →
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Reviewer Component
   ═══════════════════════════════════════════════════════════ */
export default function Reviewer() {
  // Auth state
  const [reviewerName, setReviewerNameState] = useState<string | null>(
    getReviewerName,
  );
  const sessionId = useRef(getSessionId());

  // Data state
  const [emociones, setEmociones] = useState<EmocionFusionada[]>([]);
  const [current, setCurrent] = useState<PseudoLabel | null>(null);
  const [queue, setQueue] = useState<PseudoLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);
  const [stats, setStats] = useState<ReviewStats>({
    total: 0,
    pendientes: 0,
    confirmados: 0,
    corregidos: 0,
    descartados: 0,
    omitidos: 0,
  });

  const [sessionCount, setSessionCount] = useState(() => {
    const saved = sessionStorage.getItem("reviewer-session-count");
    return saved ? Number(saved) : 0;
  });

  const incrementSession = useCallback(() => {
    setSessionCount((prev) => {
      const next = prev + 1;
      sessionStorage.setItem("reviewer-session-count", String(next));
      return next;
    });
  }, []);

  // --- Handle login ---
  const handleLogin = useCallback((name: string) => {
    setReviewerName(name);
    setReviewerNameState(name);
  }, []);

  // --- Refresh stats ---
  const refreshStats = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("get_review_stats");
      if (data && Array.isArray(data) && data.length > 0) {
        setStats(data[0] as ReviewStats);
      } else if (data && !Array.isArray(data)) {
        setStats(data as ReviewStats);
      }
    } catch {
      // silent
    }
  }, []);

  // --- Fetch batch (with session locking) ---
  const fetchBatch = useCallback(async (): Promise<PseudoLabel[]> => {
    const { data, error: err } = await supabase.rpc("get_next_review", {
      p_session_id: sessionId.current,
      cantidad: BATCH_SIZE,
    });
    if (err) throw err;
    if (!data || (data as PseudoLabel[]).length === 0) return [];
    return data as PseudoLabel[];
  }, []);

  // --- Load next from queue or fetch ---
  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowCorrect(false);

    try {
      let nextQueue = [...queue];

      // If queue is empty, fetch more
      if (nextQueue.length === 0) {
        nextQueue = await fetchBatch();
      }

      if (nextQueue.length === 0) {
        setDone(true);
        setCurrent(null);
        setLoading(false);
        return;
      }

      const next = nextQueue.shift()!;
      setQueue(nextQueue);
      setCurrent(next);
      setCooldown(COOLDOWN_SECONDS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
      refreshStats();
    }
  }, [queue, fetchBatch, refreshStats]);

  // --- Init ---
  useEffect(() => {
    if (!reviewerName) return;

    async function init() {
      setLoading(true);
      try {
        const { data: emos, error: emoErr } = await supabase
          .from("emociones_fusionadas")
          .select("*")
          .order("id");

        if (emoErr) throw emoErr;
        setEmociones(emos ?? []);

        const batch = await fetchBatch();
        if (batch.length === 0) {
          setDone(true);
          setLoading(false);
          return;
        }

        const first = batch.shift()!;
        setQueue(batch);
        setCurrent(first);
        setCooldown(COOLDOWN_SECONDS);
        await refreshStats();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewerName]);

  // --- Release locks on tab close ---
  useEffect(() => {
    if (!reviewerName) return;

    const releaseLocks = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const url = `${supabaseUrl}/rest/v1/rpc/release_session_locks?apikey=${supabaseKey}`;
      const body = JSON.stringify({ p_session_id: sessionId.current });

      // Try fetch with keepalive first (supports headers, reliable on unload)
      try {
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Fallback: sendBeacon (apikey in query param since no custom headers)
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      }
    };

    window.addEventListener("beforeunload", releaseLocks);
    return () => window.removeEventListener("beforeunload", releaseLocks);
  }, [reviewerName]);

  // --- Stats refresh interval ---
  useEffect(() => {
    if (!reviewerName) return;
    const id = window.setInterval(refreshStats, 15000);
    return () => window.clearInterval(id);
  }, [refreshStats, reviewerName]);

  // --- Cooldown timer ---
  useEffect(() => {
    if (!current || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown, current]);

  // --- Save review (with session ID) ---
  const saveReview = useCallback(
    async (emocionId: number, estado: "confirmado" | "corregido" | "descartado" | "omitido") => {
      if (!current) return;
      setSaving(true);
      setError(null);

      try {
        const { error: rpcErr } = await supabase.rpc("save_review", {
          p_id: current.id,
          p_session_id: sessionId.current,
          p_emocion_id: emocionId,
          p_estado: estado,
        });

        if (rpcErr) throw rpcErr;

        incrementSession();
        await loadNext();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      } finally {
        setSaving(false);
      }
    },
    [current, loadNext, incrementSession],
  );

  // --- Confirm prediction ---
  const confirm = useCallback(() => {
    if (!current) return;
    saveReview(current.pred_emocion_id, "confirmado");
  }, [current, saveReview]);

  // --- Correct with different emotion ---
  const correct = useCallback(
    (emocionId: number) => {
      saveReview(emocionId, "corregido");
    },
    [saveReview],
  );

  // --- Discard ---
  const discard = useCallback(() => {
    if (!current) return;
    saveReview(current.pred_emocion_id, "descartado");
  }, [current, saveReview]);

  // --- Skip ---
  const skip = useCallback(() => {
    if (cooldown > 0 || !current) return;
    saveReview(current.pred_emocion_id, "omitido");
  }, [cooldown, current, saveReview]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cooldown > 0 || saving) return;

      if (e.key === "Enter" && !showCorrect) {
        e.preventDefault();
        confirm();
      } else if (e.key === "Tab") {
        e.preventDefault();
        skip();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCorrect(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cooldown, saving, confirm, skip, showCorrect]);

  // --- Login screen ---
  if (!reviewerName) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // --- Renders ---
  if (loading && !current) {
    return <div className="rv-status">Cargando datos…</div>;
  }

  if (done && !current) {
    return (
      <div className="rv-status rv-done">
        <h2>🎉 ¡Revisión completada!</h2>
        <p>No hay más comentarios pendientes por revisar.</p>
        <div className="rv-final-stats">
          <span>✅ {stats.confirmados} confirmados</span>
          <span>🔄 {stats.corregidos} corregidos</span>
          <span>🗑 {stats.descartados} descartados</span>
          <span>⏭ {stats.omitidos} omitidos</span>
        </div>
      </div>
    );
  }

  if (!current) {
    return <div className="rv-status">Cargando siguiente comentario…</div>;
  }

  const texto = current.texto_limpio || current.texto_raw;
  const disabled = cooldown > 0 || saving;
  const conf = current.pred_confianza;

  return (
    <div className="rv-container">
      {/* Header */}
      <header className="rv-header">
        <h1>Revisor de Pseudo-Labels</h1>
        <div className="rv-header-meta">
          <span className="rv-reviewer-name" title={`Sesión: ${sessionId.current.slice(0, 8)}…`}>
            👤 {reviewerName}
          </span>
          <span className="rv-session">Sesión: {sessionCount}</span>
          <span className="rv-id">#{current.id}</span>
        </div>
      </header>

      {/* Comment card */}
      <section className="rv-comment-card">
        <p className="rv-comment-text">{texto}</p>
        {current.tema_nombre && (
          <div className="rv-tema">
            <span className="rv-tema-label">Tema:</span> {current.tema_nombre}
            {current.categoria && (
              <span className="rv-tema-cat"> · {current.categoria}</span>
            )}
          </div>
        )}
      </section>

      {/* Model prediction */}
      <section className="rv-prediction">
        <div className="rv-pred-header">
          <span className="rv-pred-label">Predicción del modelo:</span>
          <span
            className="rv-pred-emotion"
            style={{
              backgroundColor: EMOCION_COLORS[current.pred_emocion_nombre] ?? "#a0aec0",
            }}
          >
            {current.pred_emocion_nombre}
          </span>
        </div>
        <div className="rv-confidence-row">
          <div className="rv-confidence-bar">
            <div
              className="rv-confidence-fill"
              style={{
                width: `${Math.round(conf * 100)}%`,
                backgroundColor: confidenceColor(conf),
              }}
            />
          </div>
          <span
            className="rv-confidence-text"
            style={{ color: confidenceColor(conf) }}
          >
            {(conf * 100).toFixed(1)}% — {confidenceLabel(conf)}
          </span>
        </div>
        {current.entropia != null && (
          <div className="rv-meta-row">
            <span>Entropía: {current.entropia.toFixed(3)}</span>
            {current.margen_top2 != null && (
              <span>Margen top-2: {current.margen_top2.toFixed(3)}</span>
            )}
          </div>
        )}
      </section>

      {/* Cooldown */}
      {cooldown > 0 && (
        <div className="rv-cooldown">
          Lee el comentario… disponible en {cooldown}s
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rv-error">
          <span>{error}</span>
        </div>
      )}

      {/* Action buttons */}
      {!showCorrect ? (
        <div className="rv-actions">
          <button
            className="rv-btn rv-btn-confirm"
            disabled={disabled}
            onClick={confirm}
          >
            ✅ Confirmar
          </button>
          <button
            className="rv-btn rv-btn-correct"
            disabled={disabled}
            onClick={() => setShowCorrect(true)}
          >
            🔄 Corregir
          </button>
          <button
            className="rv-btn rv-btn-discard"
            disabled={disabled}
            onClick={discard}
          >
            🗑 Descartar
          </button>
          <button
            className="rv-btn rv-btn-skip"
            disabled={disabled}
            onClick={skip}
          >
            ⏭ Omitir
          </button>
        </div>
      ) : (
        <div className="rv-correct-panel">
          <p className="rv-correct-title">Selecciona la emoción correcta:</p>
          <div className="rv-emotions-grid">
            {emociones
              .filter((e) => e.id !== current.pred_emocion_id)
              .map((emo) => (
                <button
                  key={emo.id}
                  className="rv-emotion-btn"
                  disabled={disabled}
                  style={{
                    borderColor: EMOCION_COLORS[emo.nombre] ?? "#a0aec0",
                  }}
                  onClick={() => correct(emo.id)}
                >
                  {emo.nombre}
                </button>
              ))}
          </div>
          <button
            className="rv-btn rv-btn-cancel"
            onClick={() => setShowCorrect(false)}
          >
            ← Volver
          </button>
        </div>
      )}

      {/* Hints */}
      {!disabled && !showCorrect && (
        <div className="rv-hint">
          <kbd>Enter</kbd> Confirmar · <kbd>Tab</kbd> Omitir
        </div>
      )}

      {/* Stats footer */}
      <footer className="rv-stats">
        <span className="rv-stat">
          ✅ {stats.confirmados}
        </span>
        <span className="rv-stat">
          🔄 {stats.corregidos}
        </span>
        <span className="rv-stat">
          🗑 {stats.descartados}
        </span>
        <span className="rv-stat">
          ⏭ {stats.omitidos}
        </span>
        <span className="rv-stat rv-stat-pending">
          ⏳ {stats.pendientes} pendientes
        </span>
      </footer>
    </div>
  );
}
