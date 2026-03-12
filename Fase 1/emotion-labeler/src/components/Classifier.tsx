import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { Emocion, Comentario, Tema, ComentarioPendiente } from "../types";
import "./Classifier.css";

const COOLDOWN_SECONDS = 3;
const MAX_RETRIES = 5;

export default function Classifier() {
  const [emociones, setEmociones] = useState<Emocion[]>([]);
  const [current, setCurrent] = useState<ComentarioPendiente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [retryData, setRetryData] = useState<{
    idCorpus: number;
    idEmocion: number;
    intensidad: number;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // IDs ya clasificados en esta sesión para evitar repetir
  const classified = useRef(new Set<number>());
  // Contador de intentos para evitar loops
  const fetchAttempts = useRef(0);

  // Contador de sesión persistido en sessionStorage
  const [sessionCount, setSessionCount] = useState(() => {
    const saved = sessionStorage.getItem("emotion-labeler-count");
    return saved ? Number(saved) : 0;
  });
  const incrementSession = useCallback(() => {
    setSessionCount((prev) => {
      const next = prev + 1;
      sessionStorage.setItem("emotion-labeler-count", String(next));
      return next;
    });
  }, []);

  // --- Carga inicial: emociones + primer comentario ---
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const { data: emos, error: emoErr } = await supabase
          .from("emociones")
          .select("*")
          .order("id");

        if (emoErr) throw emoErr;
        setEmociones(emos ?? []);

        await fetchNext();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Traer un comentario aleatorio pendiente via RPC ---
  const fetchNext = useCallback(async () => {
    fetchAttempts.current = 0;

    while (fetchAttempts.current < MAX_RETRIES) {
      // Usar RPC con random() del servidor
      const { data: rows, error: err } = await supabase.rpc(
        "get_random_pending",
        { cantidad: 3 },
      );

      if (err) throw err;
      if (!rows || rows.length === 0) {
        setDone(true);
        setCurrent(null);
        return;
      }

      // Buscar uno que no hayamos visto en esta sesión
      const fresh = (rows as Comentario[]).find(
        (r) => !classified.current.has(r.id),
      );

      if (!fresh) {
        // Todos los devueltos ya los vimos, reintentar
        fetchAttempts.current++;
        continue;
      }

      // Resolver tema
      let tema: Tema | null = null;
      if (fresh.id_tema) {
        const { data: temaData } = await supabase
          .from("temas_training")
          .select("*")
          .eq("id", fresh.id_tema)
          .single();
        tema = temaData ?? null;
      }

      setCurrent({ comentario: fresh, tema });
      setCooldown(COOLDOWN_SECONDS);
      setConfirmDelete(false);
      return;
    }

    // Si agotamos reintentos, probablemente ya no hay pendientes nuevos
    setDone(true);
    setCurrent(null);
  }, []);

  // --- Cooldown timer ---
  useEffect(() => {
    if (!current || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown, current]);

  // --- Guardar clasificación ---
  const saveClassification = useCallback(
    async (idEmocion: number, intensidad: number) => {
      if (!current) return;
      setSaving(true);
      setError(null);
      setRetryData(null);

      try {
        const { error: upErr, count } = await supabase
          .from("corpus_training")
          .update({ id_emocion: idEmocion, intensidad })
          .eq("id", current.comentario.id)
          .is("id_emocion", null);

        if (upErr) throw upErr;

        classified.current.add(current.comentario.id);

        // Si count es 0, alguien ya lo clasificó antes
        if (count === 0) {
          // Saltar silenciosamente al siguiente
          await loadNext();
          return;
        }

        incrementSession();
        await loadNext();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al guardar");
        setRetryData({
          idCorpus: current.comentario.id,
          idEmocion,
          intensidad,
        });
      } finally {
        setSaving(false);
      }
    },
    [current],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cargar siguiente comentario ---
  const loadNext = useCallback(async () => {
    setLoading(true);
    try {
      await fetchNext();
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [fetchNext]);

  // --- Omitir ---
  const skip = useCallback(() => {
    if (cooldown > 0) return;
    if (current) classified.current.add(current.comentario.id);
    loadNext();
  }, [cooldown, current, loadNext]);

  // --- Reintentar ---
  const retry = useCallback(() => {
    if (retryData) {
      saveClassification(retryData.idEmocion, retryData.intensidad);
    }
  }, [retryData, saveClassification]);

  // --- Eliminar comentario ---
  const deleteComment = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from("corpus_training")
        .delete()
        .eq("id", current.comentario.id);
      if (delErr) throw delErr;
      classified.current.add(current.comentario.id);
      setConfirmDelete(false);
      await loadNext();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setSaving(false);
    }
  }, [current, loadNext]);

  // --- Atajos de teclado ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cooldown > 0 || saving) return;

      // Omitir con Tab
      if (e.key === "Tab") {
        e.preventDefault();
        skip();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cooldown, saving, skip]);

  // --- Renders ---
  if (loading && !current) {
    return <div className="status">Cargando datos...</div>;
  }

  if (done && !current) {
    return (
      <div className="status done">
        <h2>¡Listo!</h2>
        <p>No hay más comentarios pendientes por clasificar.</p>
      </div>
    );
  }

  if (!current) {
    return <div className="status">Cargando siguiente comentario...</div>;
  }

  const texto = current.comentario.texto_limpio || current.comentario.texto_raw;
  const disabled = cooldown > 0 || saving;

  return (
    <div className="classifier">
      {/* Encabezado con progreso */}
      <header className="header">
        <h1>Etiquetador de Emociones</h1>
        <div className="header-meta">
          <span className="session-count">Contador: {sessionCount}</span>
          <span className="counter">#{current.comentario.id}</span>
        </div>
      </header>

      {/* Comentario */}
      <section className="comment-section">
        <p className="comment-text">{texto}</p>
        {current.tema && (
          <div className="tema-info">
            <span className="tema-nombre">Tema: {current.tema.nombre}</span>
            {current.tema.categoria && (
              <span className="tema-cat"> · {current.tema.categoria}</span>
            )}
          </div>
        )}
      </section>

      {/* Acciones: Omitir y Eliminar */}
      <div className="actions-bar">
        <button
          className="action-btn skip-btn"
          disabled={disabled}
          onClick={skip}
        >
          Omitir
        </button>
        {!confirmDelete ? (
          <button
            className="action-btn delete-btn"
            disabled={disabled}
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar
          </button>
        ) : (
          <span className="confirm-group">
            <span className="confirm-label">¿Seguro?</span>
            <button className="action-btn confirm-yes" onClick={deleteComment}>
              Sí
            </button>
            <button
              className="action-btn confirm-no"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </span>
        )}
      </div>

      {/* Cooldown */}
      {cooldown > 0 && (
        <div className="cooldown">
          Disponible para clasificar en {cooldown}...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-bar">
          <span>{error}</span>
          {retryData && <button onClick={retry}>Reintentar</button>}
        </div>
      )}

      {/* Grilla de emociones */}
      <section className={`emotions-grid ${disabled ? "disabled" : ""}`}>
        {emociones.map((emo) => (
          <div key={emo.id} className="emotion-col">
            <span className="emo-name">{emo.nombre}</span>
            <div className="intensity-buttons">
              <button
                className="int-btn low"
                onClick={() => saveClassification(emo.id, 1)}
              >
                {emo.intensidad_min}
              </button>
              <button
                className="int-btn mid"
                onClick={() => saveClassification(emo.id, 2)}
              >
                {emo.nombre}
              </button>
              <button
                className="int-btn high"
                onClick={() => saveClassification(emo.id, 3)}
              >
                {emo.intensidad_max}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Hint */}
      {!disabled && (
        <div className="hint">Selecciona emoción + intensidad en un click</div>
      )}
    </div>
  );
}
