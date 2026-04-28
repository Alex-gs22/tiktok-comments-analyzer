/**
 * dataService.js
 * ─────────────────────────────────────────────────────────
 * Data access layer.
 * - Supabase configured → always use real data (even if empty)
 * - Supabase NOT configured → fall back to mockData
 *
 * All public getters are wrapped with the in-memory cache
 * (see dataCache.js). Writes call notifyDataChange() so
 * every subscribed page auto-refreshes.
 * ─────────────────────────────────────────────────────────
 */

import { supabase } from './supabaseClient';
import * as mock from './mockData';
import { EMOTION_KEYS } from './emotionConfig';
import { cached, notifyDataChange } from './dataCache';

// ── Helper ──────────────────────────────────────────────

async function query(table, options = {}) {
  if (!supabase) return null;
  try {
    let q = supabase.from(table).select(options.select || '*');
    if (options.order) q = q.order(options.order, { ascending: options.ascending ?? false });
    if (options.limit) q = q.limit(options.limit);
    if (options.eq) q = q.eq(options.eq[0], options.eq[1]);
    if (options.filter) q = options.filter(q);
    const { data, error } = await q;
    if (error) { console.error(`[dataService] ${table}:`, error.message); return null; }
    return data;
  } catch (err) {
    console.error(`[dataService] ${table}:`, err);
    return null;
  }
}

// ── Virtual topic name ──────────────────────────────────

const INDEPENDENT_TOPIC = 'Comentarios Independientes';

// ── Dashboard KPIs ──────────────────────────────────────

async function _getDashboardKpis() {
  if (!supabase) return mock.dashboardKpis;

  const data = await query('v_dashboard_kpis');
  if (data?.[0]) {
    return {
      totalPredicciones: data[0].total_predicciones ?? 0,
      totalVideos: data[0].total_videos ?? 0,
      totalInciertos: data[0].total_inciertos ?? 0,
      pctInciertos: parseFloat(data[0].pct_inciertos) || 0,
      emocionDominante: data[0].emocion_dominante || '—',
    };
  }
  // Supabase configured but empty tables
  return { totalPredicciones: 0, totalVideos: 0, totalInciertos: 0, pctInciertos: 0, emocionDominante: '—' };
}

export function getDashboardKpis() {
  return cached('dashboard-kpis', _getDashboardKpis);
}

// ── Emotion distribution ────────────────────────────────

async function _getEmotionDistribution() {
  if (!supabase) return mock.emotionDistribution;

  const data = await query('v_distribucion_emociones', { order: 'total' });
  if (data?.length) {
    return data.map((d) => ({
      emotion: d.emocion_predicha,
      total: d.total,
      porcentaje: parseFloat(d.porcentaje),
      confianzaPromedio: parseFloat(d.confianza_promedio),
    }));
  }
  // Empty — return zero-filled
  return EMOTION_KEYS.map((e) => ({ emotion: e, total: 0, porcentaje: 0, confianzaPromedio: 0 }));
}

export function getEmotionDistribution() {
  return cached('emotion-distribution', _getEmotionDistribution);
}

// ── Sentiment aggregated ────────────────────────────────

async function _getSentimentAggregated() {
  if (!supabase) return mock.sentimentAggregated;

  const data = await query('v_sentimiento_agregado');
  if (data?.length) {
    const result = {};
    data.forEach((d) => {
      result[d.sentimiento] = { total: d.total, porcentaje: parseFloat(d.porcentaje) };
    });
    return result;
  }
  return { Positivo: { total: 0, porcentaje: 0 }, Neutro: { total: 0, porcentaje: 0 }, Negativo: { total: 0, porcentaje: 0 } };
}

export function getSentimentAggregated() {
  return cached('sentiment-aggregated', _getSentimentAggregated);
}

// ── Top confident comments ──────────────────────────────

async function _getTopConfidentComments(limit) {
  if (!supabase) return mock.topConfidentComments.slice(0, limit);

  const data = await query('v_top_confiables', { limit });
  if (data?.length) {
    return data.map((d) => ({
      id: d.id,
      texto: d.texto_original,
      emocion: d.emocion_predicha,
      confianza: parseFloat(d.confianza_maxima),
      likes: d.likes || 0,
      fecha: d.created_at,
    }));
  }
  return [];
}

export function getTopConfidentComments(limit = 5) {
  return cached(`top-comments-${limit}`, () => _getTopConfidentComments(limit));
}

// ── Topics ──────────────────────────────────────────────

async function _getTopics() {
  if (!supabase) return mock.topics;

  const { data, error } = await supabase
    .from('videos_analizados')
    .select('id, id_tema, total_comentarios, total_analizados, temas_produccion(id, nombre, categoria)')
    .order('created_at', { ascending: false });

  if (error) { console.error('[dataService] getTopics:', error.message); }

  const temaMap = {};
  if (data?.length) {
    for (const v of data) {
      const tema = v.temas_produccion;
      if (!tema) continue;
      if (!temaMap[tema.nombre]) {
        temaMap[tema.nombre] = {
          id: tema.id,
          nombre: tema.nombre,
          categoria: tema.categoria || '',
          totalComentarios: 0,
          emocionDominante: 'Incierto',
          pctInciertos: 0,
          confianzaPromedio: 0,
        };
      }
      temaMap[tema.nombre].totalComentarios += v.total_analizados || 0;
    }
  }

  const topics = Object.values(temaMap);

  // Compute dominant emotion and confianza promedio for each topic
  for (const t of topics) {
    const { data: dist } = await supabase
      .from('predicciones')
      .select('emocion_predicha, confianza_maxima')
      .eq('id_video', t.id)
      .eq('es_incierto', false);

    if (dist?.length) {
      const counts = {};
      let totalConf = 0;
      dist.forEach((d) => {
        counts[d.emocion_predicha] = (counts[d.emocion_predicha] || 0) + 1;
        totalConf += parseFloat(d.confianza_maxima) || 0;
      });
      t.emocionDominante = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Incierto';
      t.confianzaPromedio = parseFloat((totalConf / dist.length).toFixed(3));
    }
  }

  // ── Virtual topic: "Comentarios Independientes" ────────
  // Comments with id_video = NULL (from Live Analyzer / individual)
  const { data: indep, error: indepErr } = await supabase
    .from('predicciones')
    .select('emocion_predicha, confianza_maxima')
    .is('id_video', null);

  if (!indepErr && indep?.length > 0) {
    const counts = {};
    let totalConf = 0;
    indep.forEach((d) => {
      counts[d.emocion_predicha] = (counts[d.emocion_predicha] || 0) + 1;
      totalConf += parseFloat(d.confianza_maxima) || 0;
    });
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Incierto';

    topics.push({
      id: '__independent__',
      nombre: INDEPENDENT_TOPIC,
      categoria: 'Análisis Individual',
      totalComentarios: indep.length,
      emocionDominante: dominant,
      pctInciertos: 0,
      confianzaPromedio: parseFloat((totalConf / indep.length).toFixed(3)),
    });
  }

  return topics;
}

export function getTopics() {
  return cached('topics', _getTopics);
}

// ── Topic emotion profile ───────────────────────────────

async function _getTopicEmotionProfile(topicName) {
  if (!supabase) return mock.topicEmotionProfiles[topicName] || {};

  // Handle virtual topic
  if (topicName === INDEPENDENT_TOPIC) {
    const { data } = await supabase
      .from('predicciones')
      .select('emocion_predicha')
      .is('id_video', null)
      .eq('es_incierto', false);

    const profile = {};
    EMOTION_KEYS.forEach((e) => { profile[e] = 0; });

    if (data?.length) {
      const total = data.length;
      data.forEach((d) => {
        if (profile[d.emocion_predicha] !== undefined) {
          profile[d.emocion_predicha]++;
        }
      });
      EMOTION_KEYS.forEach((e) => {
        profile[e] = parseFloat(((profile[e] / total) * 100).toFixed(1));
      });
    }
    return profile;
  }

  const { data } = await supabase
    .from('v_distribucion_por_tema')
    .select('*')
    .eq('tema', topicName);

  if (data?.length) {
    const profile = {};
    const total = data.reduce((s, d) => s + d.total, 0);
    EMOTION_KEYS.forEach((e) => { profile[e] = 0; });
    data.forEach((d) => {
      if (profile[d.emocion_predicha] !== undefined) {
        profile[d.emocion_predicha] = parseFloat(((d.total / total) * 100).toFixed(1));
      }
    });
    return profile;
  }
  const profile = {};
  EMOTION_KEYS.forEach((e) => { profile[e] = 0; });
  return profile;
}

export function getTopicEmotionProfile(topicName) {
  return cached(`topic-profile-${topicName}`, () => _getTopicEmotionProfile(topicName));
}

// ── Global emotion profile ──────────────────────────────

async function _getGlobalEmotionProfile() {
  const dist = await _getEmotionDistribution();
  const profile = {};
  dist.forEach((d) => { profile[d.emotion] = d.porcentaje; });
  return profile;
}

export function getGlobalEmotionProfile() {
  return cached('global-profile', _getGlobalEmotionProfile);
}

// ── Topic comments ──────────────────────────────────────

async function _getTopicComments(topicName) {
  if (!supabase) return mock.topicComments[topicName] || [];

  // Handle virtual topic
  if (topicName === INDEPENDENT_TOPIC) {
    const { data } = await supabase
      .from('predicciones')
      .select('id, texto_original, emocion_predicha, confianza_maxima, likes')
      .is('id_video', null)
      .order('confianza_maxima', { ascending: false })
      .limit(50);

    if (data?.length) {
      return data.map((d) => ({
        id: d.id,
        texto: d.texto_original,
        emocion: d.emocion_predicha,
        confianza: parseFloat(d.confianza_maxima),
        likes: d.likes || 0,
      }));
    }
    return [];
  }

  const { data: videos } = await supabase
    .from('videos_analizados')
    .select('id, temas_produccion!inner(nombre)')
    .eq('temas_produccion.nombre', topicName);

  if (!videos?.length) return [];

  const videoIds = videos.map((v) => v.id);
  const { data } = await supabase
    .from('predicciones')
    .select('id, texto_original, emocion_predicha, confianza_maxima, likes')
    .in('id_video', videoIds)
    .order('confianza_maxima', { ascending: false })
    .limit(50);

  if (data?.length) {
    return data.map((d) => ({
      id: d.id,
      texto: d.texto_original,
      emocion: d.emocion_predicha,
      confianza: parseFloat(d.confianza_maxima),
      likes: d.likes || 0,
    }));
  }
  return [];
}

export function getTopicComments(topicName) {
  return cached(`topic-comments-${topicName}`, () => _getTopicComments(topicName));
}

// ── Timeline ────────────────────────────────────────────

async function _getTimelineData() {
  if (!supabase) return mock.timelineData;

  const data = await query('v_timeline_semanal');
  if (data?.length) {
    const weekMap = {};
    data.forEach((d) => {
      const w = d.semana;
      if (!weekMap[w]) {
        weekMap[w] = { semana: w };
        EMOTION_KEYS.forEach((e) => { weekMap[w][e] = 0; });
      }
      if (weekMap[w][d.emocion_predicha] !== undefined) {
        weekMap[w][d.emocion_predicha] = d.total;
      }
    });
    return Object.values(weekMap).sort((a, b) => a.semana.localeCompare(b.semana));
  }
  return [];
}

export function getTimelineData() {
  return cached('timeline', _getTimelineData);
}

/**
 * getTimelineFiltered — Timeline with granularity + topic filtering.
 * @param {'week'|'month'} granularity
 * @param {string|null} topicName — null = all topics
 * @returns {Promise<Array<{ periodo: string, ...emotions }>>}
 */
async function _getTimelineFiltered(granularity, topicName) {
  if (!supabase) {
    // Mock: aggregate mock data by month if needed
    if (granularity === 'month') {
      const monthMap = {};
      mock.timelineData.forEach((d) => {
        const m = d.semana.slice(0, 7); // YYYY-MM
        if (!monthMap[m]) {
          monthMap[m] = { periodo: m };
          EMOTION_KEYS.forEach((e) => { monthMap[m][e] = 0; });
        }
        EMOTION_KEYS.forEach((e) => { monthMap[m][e] += d[e] || 0; });
      });
      return Object.values(monthMap).sort((a, b) => a.periodo.localeCompare(b.periodo));
    }
    return mock.timelineData.map((d) => ({ ...d, periodo: d.semana }));
  }

  // Determine the view + field names based on granularity
  const isMonth = granularity === 'month';
  const viewName = isMonth ? 'v_timeline_mensual_detalle' : 'v_timeline_semanal_detalle';
  const dateField = isMonth ? 'mes' : 'semana';

  // Get video IDs for the topic (if filtering)
  let videoIds = null;
  if (topicName) {
    if (topicName === 'Comentarios Independientes') {
      videoIds = [null]; // special marker — filter by id_video IS NULL
    } else {
      const { data: videos } = await supabase
        .from('videos_analizados')
        .select('id, temas_produccion!inner(nombre)')
        .eq('temas_produccion.nombre', topicName);
      if (videos?.length) {
        videoIds = videos.map((v) => v.id);
      } else {
        return []; // topic with no videos
      }
    }
  }

  // Fetch timeline data from the detail view
  let q = supabase.from(viewName).select('*');

  // Apply topic filter
  if (videoIds) {
    if (videoIds[0] === null) {
      // Comentarios Independientes — id_video IS NULL
      q = q.is('id_video', null);
    } else {
      q = q.in('id_video', videoIds);
    }
  }

  const { data, error } = await q;
  if (error) { console.error('[dataService] timeline filtered:', error.message); return []; }

  if (data?.length) {
    const periodMap = {};
    data.forEach((d) => {
      const p = d[dateField];
      if (!periodMap[p]) {
        periodMap[p] = { periodo: p };
        EMOTION_KEYS.forEach((e) => { periodMap[p][e] = 0; });
      }
      if (periodMap[p][d.emocion_predicha] !== undefined) {
        periodMap[p][d.emocion_predicha] += d.total;
      }
    });
    return Object.values(periodMap).sort((a, b) => a.periodo.localeCompare(b.periodo));
  }
  return [];
}

export function getTimelineFiltered(granularity = 'week', topicName = null) {
  const key = `timeline-${granularity}-${topicName || 'all'}`;
  return cached(key, () => _getTimelineFiltered(granularity, topicName));
}

// ── Confidence heatmap ──────────────────────────────────

async function _getConfidenceHeatmap() {
  if (!supabase) return mock.confidenceHeatmap;

  const topics = await _getTopics();
  if (!topics.length) return { labels: { rows: [], cols: EMOTION_KEYS }, data: [] };

  const rows = topics.slice(0, 4).map((t) => t.nombre);
  const cols = EMOTION_KEYS;
  const data = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = [];
    for (const emotion of cols) {
      const { data: avg } = await supabase
        .from('predicciones')
        .select('confianza_maxima')
        .eq('emocion_predicha', emotion)
        .limit(100);

      const avgVal = avg?.length
        ? avg.reduce((s, d) => s + parseFloat(d.confianza_maxima), 0) / avg.length
        : 0;
      row.push(parseFloat(avgVal.toFixed(2)));
    }
    data.push(row);
  }

  return { labels: { rows, cols }, data };
}

export function getConfidenceHeatmap() {
  return cached('confidence-heatmap', _getConfidenceHeatmap);
}

// ── Insert prediction ───────────────────────────────────

export async function insertPrediction(prediction) {
  if (!supabase) { console.warn('[dataService] Supabase not configured — prediction not saved'); return null; }

  const { data, error } = await supabase
    .from('predicciones')
    .insert({
      texto_original: prediction.texto,
      texto_limpio: prediction.textoLimpio || null,
      emocion_predicha: prediction.emocion,
      confianza_maxima: prediction.confianza,
      es_incierto: prediction.esIncierto || false,
      score_alegria: prediction.scores?.Alegría || 0,
      score_confianza: prediction.scores?.Confianza || 0,
      score_miedo: prediction.scores?.Miedo || 0,
      score_expectacion: prediction.scores?.Expectación || 0,
      score_tristeza: prediction.scores?.Tristeza || 0,
      score_rechazo: prediction.scores?.Rechazo || 0,
      id_video: prediction.idVideo || null,
      tipo_analisis: prediction.tipo || 'individual',
    })
    .select('id')
    .single();

  if (error) { console.error('[dataService] insert:', error.message); return null; }

  // Notify all subscribed pages to refresh
  notifyDataChange();

  return data?.id;
}

// ── Insert session ──────────────────────────────────────

export async function insertSession(session) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('sesiones_analisis')
    .insert({
      id_video: session.idVideo || null,
      tipo: session.tipo,
      total_procesados: session.totalProcesados,
      total_inciertos: session.totalInciertos,
      emocion_dominante: session.emocionDominante,
      confianza_promedio: session.confianzaPromedio,
      duracion_ms: session.duracionMs,
    })
    .select('id')
    .single();

  if (error) { console.error('[dataService] session:', error.message); return null; }

  // Notify all subscribed pages to refresh
  notifyDataChange();

  return data?.id;
}
