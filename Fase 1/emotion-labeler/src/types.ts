export interface Emocion {
  id: number;
  nombre: string;
  descripcion: string | null;
  intensidad_min: string;
  intensidad_max: string;
}

export interface Tema {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  emociones_esperadas: string | null;
}

export interface Comentario {
  id: number;
  id_comment: string;
  video_id: string | null;
  texto_raw: string;
  texto_limpio: string | null;
  id_emocion: number | null;
  intensidad: number | null;
  id_tema: number | null;
  likes: number | null;
  fecha: string | null;
}

// Lo que se muestra en la UI con el tema resuelto
export interface ComentarioPendiente {
  comentario: Comentario;
  tema: Tema | null;
}
