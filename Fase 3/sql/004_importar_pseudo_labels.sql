-- ============================================================
-- 004: Tabla e importación de pseudo-labels para revisión humana
-- ============================================================
-- Ejecutar en Supabase SQL Editor ANTES de importar el CSV.

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS pseudo_labels_review (
    id            SERIAL PRIMARY KEY,
    corpus_id     INTEGER,
    id_comment    BIGINT,
    texto_raw     TEXT NOT NULL,
    texto_limpio  TEXT,

    -- Predicción del modelo
    pred_emocion_id       SMALLINT NOT NULL,   -- 1-6
    pred_emocion_nombre   TEXT NOT NULL,
    pred_confianza        REAL NOT NULL,        -- 0.0 – 1.0
    entropia              REAL,
    margen_top2           REAL,

    -- Probabilidades por clase (para referencia)
    prob_alegria       REAL,
    prob_confianza     REAL,
    prob_miedo         REAL,
    prob_expectacion   REAL,
    prob_tristeza      REAL,
    prob_rechazo       REAL,

    -- Contexto temático
    tema_nombre   TEXT,
    categoria     TEXT,

    -- Revisión humana (se llena desde la app)
    revision_emocion_id    SMALLINT,            -- NULL = pendiente
    revision_emocion_nombre TEXT,
    revision_estado        TEXT DEFAULT 'pendiente'
        CHECK (revision_estado IN ('pendiente', 'confirmado', 'corregido', 'descartado')),
    revisado_en            TIMESTAMPTZ
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_plr_estado ON pseudo_labels_review (revision_estado);
CREATE INDEX IF NOT EXISTS idx_plr_entropia ON pseudo_labels_review (entropia DESC);
CREATE INDEX IF NOT EXISTS idx_plr_estado_entropia ON pseudo_labels_review (revision_estado, entropia DESC);

-- 3. Catálogo de emociones fusionadas (referencia para la app)
CREATE TABLE IF NOT EXISTS emociones_fusionadas (
    id     SMALLINT PRIMARY KEY,
    nombre TEXT NOT NULL
);

INSERT INTO emociones_fusionadas (id, nombre) VALUES
    (1, 'Alegría'),
    (2, 'Confianza'),
    (3, 'Miedo'),
    (4, 'Expectación'),
    (5, 'Tristeza'),
    (6, 'Rechazo')
ON CONFLICT (id) DO NOTHING;

-- 4. RPC: Obtener siguientes comentarios para revisión (por entropía DESC)
CREATE OR REPLACE FUNCTION get_next_review(cantidad INTEGER DEFAULT 1)
RETURNS SETOF pseudo_labels_review
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM pseudo_labels_review
    WHERE revision_estado = 'pendiente'
    ORDER BY entropia DESC, id ASC
    LIMIT cantidad;
$$;

-- 5. RPC: Guardar revisión
CREATE OR REPLACE FUNCTION save_review(
    p_id          INTEGER,
    p_emocion_id  SMALLINT,
    p_estado      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_nombre TEXT;
BEGIN
    -- Resolver nombre de emoción
    SELECT nombre INTO v_nombre
    FROM emociones_fusionadas
    WHERE id = p_emocion_id;

    UPDATE pseudo_labels_review
    SET revision_emocion_id    = p_emocion_id,
        revision_emocion_nombre = v_nombre,
        revision_estado        = p_estado,
        revisado_en            = NOW()
    WHERE id = p_id
      AND revision_estado = 'pendiente';
END;
$$;

-- 6. RPC: Estadísticas de revisión
CREATE OR REPLACE FUNCTION get_review_stats()
RETURNS TABLE (
    total       BIGINT,
    pendientes  BIGINT,
    confirmados BIGINT,
    corregidos  BIGINT,
    descartados BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE revision_estado = 'pendiente')   AS pendientes,
        COUNT(*) FILTER (WHERE revision_estado = 'confirmado')  AS confirmados,
        COUNT(*) FILTER (WHERE revision_estado = 'corregido')   AS corregidos,
        COUNT(*) FILTER (WHERE revision_estado = 'descartado')  AS descartados
    FROM pseudo_labels_review;
$$;

-- ============================================================
-- DESPUÉS de ejecutar este script:
--   1. Ir a Table Editor → pseudo_labels_review → Import CSV
--   2. Subir: data/pseudo_labels_para_supabase.csv
--      (las columnas ya coinciden con la tabla, no requiere mapeo)
-- ============================================================
