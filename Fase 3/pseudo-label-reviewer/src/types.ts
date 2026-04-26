export interface PseudoLabel {
  id: number;
  corpus_id: number | null;
  id_comment: number | null;
  texto_raw: string;
  texto_limpio: string | null;
  pred_emocion_id: number;
  pred_emocion_nombre: string;
  pred_confianza: number;
  entropia: number | null;
  margen_top2: number | null;
  prob_alegria: number | null;
  prob_confianza: number | null;
  prob_miedo: number | null;
  prob_expectacion: number | null;
  prob_tristeza: number | null;
  prob_rechazo: number | null;
  tema_nombre: string | null;
  categoria: string | null;
  revision_emocion_id: number | null;
  revision_emocion_nombre: string | null;
  revision_estado: string;
  revisado_en: string | null;
  locked_by: string | null;
  locked_at: string | null;
}

export interface EmocionFusionada {
  id: number;
  nombre: string;
}

export interface ReviewStats {
  total: number;
  pendientes: number;
  confirmados: number;
  corregidos: number;
  descartados: number;
  omitidos: number;
}
