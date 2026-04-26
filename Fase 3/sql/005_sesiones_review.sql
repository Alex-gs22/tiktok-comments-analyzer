-- ============================================================
-- 005: Sesiones de revisión – locking concurrente multi-revisor
-- ============================================================
-- Prerequisitos (ya ejecutados manualmente):
--   ALTER TABLE pseudo_labels_review
--     ADD COLUMN locked_by UUID,
--     ADD COLUMN locked_at TIMESTAMPTZ;
--   CREATE INDEX idx_plr_locked ON pseudo_labels_review (locked_by, locked_at);
-- ============================================================

-- 1. Liberar locks expirados (>5 min) — utilidad interna
CREATE OR REPLACE FUNCTION _release_expired_locks()
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE pseudo_labels_review
    SET locked_by = NULL,
        locked_at = NULL
    WHERE locked_by IS NOT NULL
      AND locked_at < NOW() - INTERVAL '5 minutes'
      AND revision_estado = 'pendiente';
$$;

-- 2. Nueva versión de get_next_review con sesión y SKIP LOCKED
CREATE OR REPLACE FUNCTION get_next_review(
    p_session_id UUID,
    cantidad     INTEGER DEFAULT 5
)
RETURNS SETOF pseudo_labels_review
LANGUAGE plpgsql
AS $$
BEGIN
    -- Paso 1: Liberar locks expirados de cualquier sesión
    PERFORM _release_expired_locks();

    -- Paso 2: Liberar locks previos de ESTA sesión que no se hayan revisado
    --         (re-fetch: el usuario recarga la página o pide otro batch)
    UPDATE pseudo_labels_review
    SET locked_by = NULL,
        locked_at = NULL
    WHERE locked_by = p_session_id
      AND revision_estado = 'pendiente';

    -- Paso 3: Reservar atómicamente los siguientes N pendientes
    --         usando FOR UPDATE SKIP LOCKED para evitar conflictos
    UPDATE pseudo_labels_review
    SET locked_by = p_session_id,
        locked_at = NOW()
    WHERE id IN (
        SELECT id
        FROM pseudo_labels_review
        WHERE revision_estado = 'pendiente'
          AND locked_by IS NULL
        ORDER BY entropia DESC, id ASC
        LIMIT cantidad
        FOR UPDATE SKIP LOCKED
    );

    -- Paso 4: Devolver los registros reservados para esta sesión
    RETURN QUERY
        SELECT *
        FROM pseudo_labels_review
        WHERE locked_by = p_session_id
          AND revision_estado = 'pendiente'
        ORDER BY entropia DESC, id ASC;
END;
$$;

-- 3. Actualizar save_review para validar sesión
CREATE OR REPLACE FUNCTION save_review(
    p_id          INTEGER,
    p_session_id  UUID,
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

    -- Actualizar solo si está pendiente Y la sesión coincide (o no tiene lock)
    UPDATE pseudo_labels_review
    SET revision_emocion_id     = p_emocion_id,
        revision_emocion_nombre = v_nombre,
        revision_estado         = p_estado,
        revisado_en             = NOW(),
        locked_by               = NULL,
        locked_at               = NULL
    WHERE id = p_id
      AND revision_estado = 'pendiente'
      AND (locked_by = p_session_id OR locked_by IS NULL);
END;
$$;

-- 4. Liberar todos los locks de una sesión (llamado al cerrar pestaña)
CREATE OR REPLACE FUNCTION release_session_locks(p_session_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE pseudo_labels_review
    SET locked_by = NULL,
        locked_at = NULL
    WHERE locked_by = p_session_id
      AND revision_estado = 'pendiente';
$$;

-- 5. Estadísticas (sin cambios funcionales, se mantiene)
-- La función get_review_stats() existente sigue siendo válida.

-- ============================================================
-- NOTAS:
--   • Cada pestaña del navegador genera un UUID de sesión.
--   • get_next_review() reserva un batch atómicamente.
--   • Los locks expiran automáticamente a los 5 minutos.
--   • Al cerrar la pestaña se llama release_session_locks().
-- ============================================================
