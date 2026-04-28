/**
 * mockData.js
 * ─────────────────────────────────────────────────────────
 * Mock data for the dashboard.
 * All numbers are coherent with the 6 model classes and
 * simulate what production data would look like from Supabase.
 *
 * When Supabase is connected, these will be replaced by
 * real queries from the views defined in 005_fase5_predicciones.sql.
 * ─────────────────────────────────────────────────────────
 */

// ── Dashboard KPIs ──────────────────────────────────────

export const dashboardKpis = {
  totalPredicciones: 1247,
  totalVideos: 18,
  totalInciertos: 89,
  pctInciertos: 7.1,
  emocionDominante: 'Rechazo',
};

// ── Emotion distribution (for treemap) ──────────────────

export const emotionDistribution = [
  { emotion: 'Rechazo',     total: 362, porcentaje: 31.3, confianzaPromedio: 0.7421 },
  { emotion: 'Confianza',   total: 246, porcentaje: 21.2, confianzaPromedio: 0.6813 },
  { emotion: 'Tristeza',    total: 198, porcentaje: 17.1, confianzaPromedio: 0.7102 },
  { emotion: 'Expectación', total: 152, porcentaje: 13.1, confianzaPromedio: 0.5934 },
  { emotion: 'Alegría',     total: 112, porcentaje: 9.7,  confianzaPromedio: 0.5621 },
  { emotion: 'Miedo',       total: 88,  porcentaje: 7.6,  confianzaPromedio: 0.6247 },
];

// ── Sentiment aggregated ────────────────────────────────

export const sentimentAggregated = {
  Positivo: { total: 358, porcentaje: 28.7 },
  Negativo: { total: 648, porcentaje: 51.9 },
  Neutro:   { total: 241, porcentaje: 19.3 },
};

// ── Top confident comments ──────────────────────────────

export const topConfidentComments = [
  {
    id: 1,
    texto: 'Esto es una falta de respeto total, no puedo creerlo 😤',
    emocion: 'Rechazo',
    confianza: 0.9412,
    likes: 342,
    fecha: '2026-04-15',
  },
  {
    id: 2,
    texto: 'Me da muchísima tristeza ver cómo terminó todo esto 😢',
    emocion: 'Tristeza',
    confianza: 0.9187,
    likes: 128,
    fecha: '2026-04-18',
  },
  {
    id: 3,
    texto: 'Eres el mejor creador, siempre confío en tus recomendaciones 🤝',
    emocion: 'Confianza',
    confianza: 0.8956,
    likes: 567,
    fecha: '2026-04-10',
  },
  {
    id: 4,
    texto: 'Qué bonito video, me encantó! 😍 Lo mejor que he visto hoy',
    emocion: 'Alegría',
    confianza: 0.8834,
    likes: 891,
    fecha: '2026-04-20',
  },
  {
    id: 5,
    texto: 'Me da mucho miedo que esto pueda pasar en mi ciudad 😰',
    emocion: 'Miedo',
    confianza: 0.8721,
    likes: 45,
    fecha: '2026-04-22',
  },
];

// ── Topics (temas) ──────────────────────────────────────

export const topics = [
  {
    id: 1,
    nombre: 'Checo Pérez regresa a F1',
    categoria: 'Entretenimiento / Deportes',
    totalComentarios: 412,
    emocionDominante: 'Alegría',
    pctInciertos: 5.3,
  },
  {
    id: 2,
    nombre: 'La historia de Beto',
    categoria: 'Criminal / Conspiración',
    totalComentarios: 356,
    emocionDominante: 'Rechazo',
    pctInciertos: 8.1,
  },
  {
    id: 3,
    nombre: 'Madres Buscadoras',
    categoria: 'Tragedia',
    totalComentarios: 289,
    emocionDominante: 'Tristeza',
    pctInciertos: 4.5,
  },
  {
    id: 4,
    nombre: 'ICE en EE.UU.',
    categoria: 'Política / Social',
    totalComentarios: 190,
    emocionDominante: 'Rechazo',
    pctInciertos: 9.2,
  },
];

// ── Topic emotion profiles (for radar + comparison) ─────

export const topicEmotionProfiles = {
  'Checo Pérez regresa a F1': {
    Alegría: 34.2, Confianza: 28.1, Miedo: 3.5,
    Expectación: 18.7, Tristeza: 5.2, Rechazo: 10.3,
  },
  'La historia de Beto': {
    Alegría: 4.1, Confianza: 12.6, Miedo: 8.9,
    Expectación: 9.3, Tristeza: 22.8, Rechazo: 42.3,
  },
  'Madres Buscadoras': {
    Alegría: 2.3, Confianza: 18.4, Miedo: 12.1,
    Expectación: 6.7, Tristeza: 38.9, Rechazo: 21.6,
  },
  'ICE en EE.UU.': {
    Alegría: 1.8, Confianza: 3.2, Miedo: 24.5,
    Expectación: 7.1, Tristeza: 18.4, Rechazo: 45.0,
  },
};

// ── Global emotion profile (for comparison baseline) ────

export const globalEmotionProfile = {
  Alegría: 9.7, Confianza: 21.2, Miedo: 7.6,
  Expectación: 13.1, Tristeza: 17.1, Rechazo: 31.3,
};

// ── Topic keywords ──────────────────────────────────────

export const topicKeywords = {
  'Checo Pérez regresa a F1': [
    { label: 'Checo', value: 287 },
    { label: 'F1', value: 198 },
    { label: 'Cadillac', value: 156 },
    { label: 'Orgullo', value: 134 },
    { label: 'Regresa', value: 112 },
  ],
  'La historia de Beto': [
    { label: 'Injusticia', value: 201 },
    { label: 'Criminal', value: 178 },
    { label: 'Víctimas', value: 145 },
    { label: 'Empatía', value: 112 },
    { label: 'Sociedad', value: 89 },
  ],
  'Madres Buscadoras': [
    { label: 'Madres', value: 245 },
    { label: 'Desaparecidos', value: 198 },
    { label: 'Búsqueda', value: 167 },
    { label: 'Gobierno', value: 134 },
    { label: 'Justicia', value: 112 },
  ],
  'ICE en EE.UU.': [
    { label: 'Deportación', value: 156 },
    { label: 'Familias', value: 143 },
    { label: 'Frontera', value: 121 },
    { label: 'Niños', value: 98 },
    { label: 'Injusticia', value: 87 },
  ],
};

// ── Comments sample per topic ───────────────────────────

export const topicComments = {
  'Checo Pérez regresa a F1': [
    { id: 101, texto: 'Que orgullo ver a Checo de vuelta! México representa 🇲🇽', emocion: 'Alegría', confianza: 0.82, likes: 1203 },
    { id: 102, texto: 'Siempre confié en que iba a volver, es un grande', emocion: 'Confianza', confianza: 0.78, likes: 567 },
    { id: 103, texto: 'Esperemos que le vaya bien en Cadillac, se lo merece', emocion: 'Expectación', confianza: 0.61, likes: 234 },
    { id: 104, texto: 'No creo que dure mucho, ya está grande para la F1', emocion: 'Rechazo', confianza: 0.65, likes: 89 },
    { id: 105, texto: 'Me preocupa que le vaya mal y arruine su legado', emocion: 'Miedo', confianza: 0.54, likes: 45 },
  ],
  'La historia de Beto': [
    { id: 201, texto: 'Es increíble que haya gente que lo defienda, es un criminal', emocion: 'Rechazo', confianza: 0.91, likes: 432 },
    { id: 202, texto: 'Me da mucha tristeza por las víctimas y sus familias', emocion: 'Tristeza', confianza: 0.87, likes: 298 },
    { id: 203, texto: 'Qué miedo vivir en un país donde pasan estas cosas', emocion: 'Miedo', confianza: 0.73, likes: 187 },
    { id: 204, texto: 'La sociedad lo creó, hay que ver el contexto completo', emocion: 'Confianza', confianza: 0.48, likes: 156 },
    { id: 205, texto: 'No puedo creer lo que acabo de ver, es impactante', emocion: 'Expectación', confianza: 0.62, likes: 234 },
  ],
  'Madres Buscadoras': [
    { id: 301, texto: 'Es desgarrador ver a estas madres buscando a sus hijos', emocion: 'Tristeza', confianza: 0.92, likes: 876 },
    { id: 302, texto: 'El gobierno debería hacer más por ellas, es una vergüenza', emocion: 'Rechazo', confianza: 0.85, likes: 543 },
    { id: 303, texto: 'Admiro su fuerza y determinación, son un ejemplo', emocion: 'Confianza', confianza: 0.79, likes: 432 },
    { id: 304, texto: 'Qué miedo saber que esto puede pasarle a cualquiera', emocion: 'Miedo', confianza: 0.71, likes: 198 },
    { id: 305, texto: 'Ojalá encuentren lo que buscan, no pierdan la esperanza', emocion: 'Expectación', confianza: 0.58, likes: 267 },
  ],
  'ICE en EE.UU.': [
    { id: 401, texto: 'Están separando familias, esto es inhumano', emocion: 'Rechazo', confianza: 0.93, likes: 567 },
    { id: 402, texto: 'Me da mucho miedo por mis familiares que viven allá', emocion: 'Miedo', confianza: 0.84, likes: 345 },
    { id: 403, texto: 'Es muy triste ver los videos de los niños llorando', emocion: 'Tristeza', confianza: 0.88, likes: 432 },
    { id: 404, texto: 'No entiendo cómo hay gente que apoya estas medidas', emocion: 'Rechazo', confianza: 0.76, likes: 234 },
    { id: 405, texto: 'Espero que cambien las leyes pronto, no puede seguir así', emocion: 'Expectación', confianza: 0.52, likes: 123 },
  ],
};

// ── Confidence heatmap (topics × emotions) ──────────────

export const confidenceHeatmap = {
  labels: {
    rows: ['Checo Pérez', 'Historia de Beto', 'Madres Buscadoras', 'ICE en EE.UU.'],
    cols: ['Alegría', 'Confianza', 'Miedo', 'Expectación', 'Tristeza', 'Rechazo'],
  },
  data: [
    [0.72, 0.68, 0.45, 0.61, 0.52, 0.65],
    [0.38, 0.48, 0.73, 0.62, 0.87, 0.91],
    [0.35, 0.79, 0.71, 0.58, 0.92, 0.85],
    [0.32, 0.41, 0.84, 0.52, 0.88, 0.93],
  ],
};

// ── Timeline data (weekly) ──────────────────────────────

export const timelineData = [
  { semana: '2026-03-02', Alegría: 18, Confianza: 32, Miedo: 8,  Expectación: 15, Tristeza: 22, Rechazo: 45 },
  { semana: '2026-03-09', Alegría: 22, Confianza: 28, Miedo: 12, Expectación: 18, Tristeza: 25, Rechazo: 38 },
  { semana: '2026-03-16', Alegría: 15, Confianza: 35, Miedo: 6,  Expectación: 22, Tristeza: 18, Rechazo: 42 },
  { semana: '2026-03-23', Alegría: 28, Confianza: 30, Miedo: 10, Expectación: 20, Tristeza: 15, Rechazo: 35 },
  { semana: '2026-03-30', Alegría: 12, Confianza: 25, Miedo: 18, Expectación: 14, Tristeza: 32, Rechazo: 52 },
  { semana: '2026-04-06', Alegría: 20, Confianza: 38, Miedo: 8,  Expectación: 25, Tristeza: 20, Rechazo: 30 },
  { semana: '2026-04-13', Alegría: 25, Confianza: 42, Miedo: 5,  Expectación: 28, Tristeza: 12, Rechazo: 28 },
  { semana: '2026-04-20', Alegría: 16, Confianza: 30, Miedo: 15, Expectación: 18, Tristeza: 28, Rechazo: 48 },
];

export const timelineEvents = [
  { semana: '2026-03-09', label: 'Video viral: Checo Pérez' },
  { semana: '2026-03-30', label: 'Tendencia: ICE deportaciones' },
  { semana: '2026-04-13', label: 'Análisis batch: 5 videos' },
];
