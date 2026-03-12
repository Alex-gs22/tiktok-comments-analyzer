import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { Emocion, Comentario, Tema, ComentarioPendiente } from "../types";
import "./Classifier.css";

const BATCH_SIZE = 20;
const COOLDOWN_SECONDS = 3;

export default function Classifier() {
  const [emociones, setEmociones] = useState<Emocion[]>([]);
  const [pendientes, setPendientes] = useState<ComentarioPendiente[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmocion, setSelectedEmocion] = useState<Emocion | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [retryData, setRetryData] = useState<{
    idCorpus: number;
    idEmocion: number;
    intensidad: number;
  } | null>(null);

  // IDs ya clasificados en esta sesión para evitar repetir
  const classified = useRef(new Set<number>());
  // Último ID cargado para paginación estable
  const lastLoadedId = useRef(0);

  const current = pendientes[currentIndex] ?? null;

  // --- Carga inicial: emociones + primer lote ---
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

        await fetchBatch();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Cargar lote de comentarios pendientes ---
  const fetchBatch = useCallback(async () => {
    const { data: rows, error: err } = await supabase
      .from("corpus")
      .select("*")
      .is("id_emocion", null)
      .gt("id", lastLoadedId.current)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (err) throw err;
    if (!rows || rows.length === 0) {
      setDone(true);
      return;
    }

    lastLoadedId.current = rows[rows.length - 1].id;

    // Resolver temas
    const temaIds = [
      ...new Set(rows.map((r: Comentario) => r.id_tema).filter(Boolean)),
    ];
    let temasMap: Record<number, Tema> = {};

    if (temaIds.length > 0) {
      const { data: temas } = await supabase
        .from("temas")
        .select("*")
        .in("id", temaIds);

      if (temas) {
        temasMap = Object.fromEntries(temas.map((t: Tema) => [t.id, t]));
      }
    }

    const nuevos: ComentarioPendiente[] = rows
      .filter((r: Comentario) => !classified.current.has(r.id))
      .map((r: Comentario) => ({
        comentario: r,
        tema: r.id_tema ? (temasMap[r.id_tema] ?? null) : null,
      }));

    setPendientes((prev) => [...prev, ...nuevos]);
    setDone(nuevos.length === 0 && rows.length < BATCH_SIZE);
  }, []);

  // --- Cooldown timer ---
  useEffect(() => {
    if (!current || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown, current]);

  // Reset cooldown al cambiar de comentario
  useEffect(() => {
    setCooldown(COOLDOWN_SECONDS);
    setSelectedEmocion(null);
  }, [currentIndex]);

  // --- Guardar clasificación ---
  const saveClassification = useCallback(
    async (idEmocion: number, intensidad: number) => {
      if (!current) return;
      setSaving(true);
      setError(null);
      setRetryData(null);

      try {
        const { error: upErr } = await supabase
          .from("corpus")
          .update({ id_emocion: idEmocion, intensidad })
          .eq("id", current.comentario.id);

        if (upErr) throw upErr;

        classified.current.add(current.comentario.id);
        advance();
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

  // --- Avanzar al siguiente ---
  const advance = useCallback(() => {
    setSelectedEmocion(null);
    const next = currentIndex + 1;
    if (next >= pendientes.length) {
      // Intentar cargar más
      setLoading(true);
      fetchBatch()
        .then(() => setCurrentIndex(next))
        .catch(() => setDone(true))
        .finally(() => setLoading(false));
    } else {
      setCurrentIndex(next);
    }
  }, [currentIndex, pendientes.length, fetchBatch]);

  // --- Omitir ---
  const skip = useCallback(() => {
    if (cooldown > 0) return;
    advance();
  }, [cooldown, advance]);

  // --- Reintentar ---
  const retry = useCallback(() => {
    if (retryData) {
      saveClassification(retryData.idEmocion, retryData.intensidad);
    }
  }, [retryData, saveClassification]);

  // --- Selección de intensidad ---
  const selectIntensidad = useCallback(
    (nivel: number) => {
      if (!selectedEmocion || cooldown > 0) return;
      saveClassification(selectedEmocion.id, nivel);
    },
    [selectedEmocion, cooldown, saveClassification],
  );

  // --- Atajos de teclado ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (cooldown > 0 || saving) return;

      // Si hay emoción seleccionada → elegir intensidad con 1, 2, 3
      if (selectedEmocion) {
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          e.preventDefault();
          selectIntensidad(Number(e.key));
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSelectedEmocion(null);
          return;
        }
      }

      // Sin emoción seleccionada → números para seleccionar emoción por posición
      if (!selectedEmocion && e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (idx < emociones.length) {
          e.preventDefault();
          setSelectedEmocion(emociones[idx]);
          return;
        }
      }

      // Omitir con Tab
      if (e.key === "Tab") {
        e.preventDefault();
        skip();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cooldown, saving, selectedEmocion, emociones, selectIntensidad, skip]);

  // --- Renders ---
  if (loading && pendientes.length === 0) {
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
        <span className="counter">#{current.comentario.id}</span>
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
        {emociones.map((emo, idx) => {
          const isSelected = selectedEmocion?.id === emo.id;
          return (
            <div
              key={emo.id}
              className={`emotion-col ${isSelected ? "selected" : ""}`}
              onClick={() => {
                if (disabled) return;
                setSelectedEmocion(isSelected ? null : emo);
              }}
            >
              <span className="emo-key">{idx + 1}</span>
              <span className="emo-level low">{emo.intensidad_min}</span>
              <span className="emo-name">{emo.nombre}</span>
              <span className="emo-level high">{emo.intensidad_max}</span>

              {/* Selector de intensidad */}
              {isSelected && !disabled && (
                <div className="intensity-picker">
                  <button
                    className="int-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectIntensidad(1);
                    }}
                  >
                    <kbd>1</kbd> {emo.intensidad_min}
                  </button>
                  <button
                    className="int-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectIntensidad(2);
                    }}
                  >
                    <kbd>2</kbd> {emo.nombre}
                  </button>
                  <button
                    className="int-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectIntensidad(3);
                    }}
                  >
                    <kbd>3</kbd> {emo.intensidad_max}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Omitir */}
      <footer className="footer">
        <button className="skip-btn" disabled={disabled} onClick={skip}>
          Omitir (Tab)
        </button>
        {selectedEmocion && (
          <span className="hint">
            Esc para cancelar · 1/2/3 para intensidad
          </span>
        )}
        {!selectedEmocion && !disabled && (
          <span className="hint">Click o número para elegir emoción</span>
        )}
      </footer>
    </div>
  );
}
