"use client";
import { useState, useCallback } from 'react';
import Header from '../../src/components/Header';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';

import KpiCard from '../../src/components/KpiCard';
import CommentTable from '../../src/components/CommentTable';
import { EMOTIONS, MODEL_INFO } from '../../src/lib/emotionConfig';
import { classifyBatch } from '../../src/lib/inferenceService';
import { insertPrediction, insertSession } from '../../src/lib/dataService';
import { Hash, ToggleLeft, ToggleRight, Download, MessageCircle, Flame, AlertTriangle, BarChart3 } from 'lucide-react';

/**
 * VideoPage — Batch analysis of TikTok video comments.
 * For now: user pastes comments manually (textarea).
 * When Cloudflare Worker is ready, this will accept a URL and scrape automatically.
 */

const EXAMPLE_COMMENTS = [
  'Que orgullo ver a Checo de vuelta! México representa 🇲🇽',
  'Siempre confié en que iba a volver, es un grande',
  'No creo que dure mucho, ya está grande para la F1',
  'Me preocupa que le vaya mal y arruine su legado',
  'Esperemos que le vaya bien en Cadillac, se lo merece',
  'Es increíble que haya gente que lo defienda',
  'Me da mucha tristeza por las víctimas y sus familias',
  'Qué miedo vivir en un país donde pasan estas cosas',
  'Me encantó este video, es lo mejor que he visto hoy 😍',
  'No puedo creer lo que acabo de ver, es impactante!!',
];

export default function VideoPage() {
  const [commentsText, setCommentsText] = useState('');
  const [topic, setTopic] = useState('');
  const [autoTopic, setAutoTopic] = useState(true);
  const [step, setStep] = useState('idle'); // idle | analyzing | complete
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);

  const comments = commentsText
    .split('\n')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const loadExample = () => {
    setCommentsText(EXAMPLE_COMMENTS.join('\n'));
  };

  const handleAnalyze = useCallback(async () => {
    if (comments.length === 0) return;
    setStep('analyzing');
    setProgress({ current: 0, total: comments.length });
    setResults(null);

    const startTime = Date.now();

    const batchResults = await classifyBatch(comments, {
      onProgress: (current, total) => {
        setProgress({ current, total });
      },
      delayMs: 200,
    });

    const duracionMs = Date.now() - startTime;

    // Build results summary
    const emotionCounts = {};
    let totalInciertos = 0;
    let totalConfianza = 0;
    const commentResults = [];

    batchResults.forEach((r) => {
      emotionCounts[r.label] = (emotionCounts[r.label] || 0) + 1;
      if (r.isUncertain) totalInciertos++;
      totalConfianza += r.score;
      commentResults.push({
        id: r.index,
        texto: r.texto,
        emocion: r.label,
        confianza: r.score,
        likes: 0,
      });
    });

    const emocionDominante = Object.entries(emotionCounts)
      .filter(([k]) => k !== 'Incierto')
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Incierto';

    const summary = {
      total: comments.length,
      totalInciertos,
      emocionDominante,
      confianzaPromedio: totalConfianza / comments.length,
      duracionMs,
      distribution: Object.entries(emotionCounts).map(([emotion, count]) => ({
        emotion,
        count,
        pct: ((count / comments.length) * 100).toFixed(1),
      })).sort((a, b) => b.count - a.count),
      comments: commentResults,
    };

    // Persist to Supabase
    for (const r of batchResults) {
      await insertPrediction({
        texto: r.texto,
        emocion: r.label,
        confianza: r.score,
        esIncierto: r.isUncertain,
        scores: r.scores,
        tipo: 'batch_video',
      });
    }

    await insertSession({
      tipo: 'batch_video',
      totalProcesados: comments.length,
      totalInciertos,
      emocionDominante,
      confianzaPromedio: parseFloat((totalConfianza / comments.length).toFixed(4)),
      duracionMs,
    });

    setResults(summary);
    setStep('complete');
  }, [comments]);

  return (
    <div className="w-full">
      <Header title="Analizar Video" subtitle="Analiza comentarios de un video de TikTok en batch" />

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* Input section */}
        <GlassCard className="max-w-4xl mx-auto">
          <div className="space-y-5">
            {/* Topic */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider mb-2 block">
                  Tema del video
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a4a5e]" />
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={autoTopic ? 'Se detectará automáticamente...' : 'Ej: Política, Deportes...'}
                    disabled={autoTopic}
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] disabled:opacity-40 focus:outline-none focus:border-accent-cyan/40 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={() => setAutoTopic(!autoTopic)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-subtle text-xs font-medium text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)] transition-all whitespace-nowrap"
              >
                {autoTopic ? <ToggleRight className="w-4 h-4 text-em-confianza" /> : <ToggleLeft className="w-4 h-4 text-[#4a4a5e]" />}
                Auto-detectar
              </button>
            </div>

            {/* Comments textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  Comentarios (uno por línea)
                </label>
                <button
                  onClick={loadExample}
                  className="text-[10px] text-accent-cyan hover:underline"
                >
                  Cargar ejemplo (10 comentarios)
                </button>
              </div>
              <textarea
                value={commentsText}
                onChange={(e) => setCommentsText(e.target.value)}
                placeholder="Pega aquí los comentarios del video, uno por línea..."
                rows={8}
                className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl px-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] resize-none focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all font-mono"
              />
              <p className="text-[10px] text-[#4a4a5e] mt-1">
                {comments.length} comentarios detectados
              </p>
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={comments.length === 0 || step === 'analyzing'}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-accent-gradient text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-accent-cyan/10 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              {step === 'analyzing'
                ? `Analizando... ${progress.current}/${progress.total}`
                : `Analizar ${comments.length} comentarios`}
            </button>

            {/* Progress bar */}
            {step === 'analyzing' && (
              <div className="w-full h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-gradient rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            )}
          </div>
        </GlassCard>

        {/* Results */}
        {results && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <KpiCard title="Analizados" value={results.total} icon={MessageCircle} color="#06b6d4" />
              <KpiCard title="Emoción Dominante" value={results.emocionDominante} icon={Flame} color={EMOTIONS[results.emocionDominante]?.color || '#888'} animate={false} delay={0.1} />
              <KpiCard title="Inciertos" value={results.totalInciertos} icon={AlertTriangle} color="#A1A1AA" delay={0.2} />
              <KpiCard title="Confianza Prom." value={results.confianzaPromedio} decimals={2} icon={BarChart3} color="#8b5cf6" delay={0.3} />
            </div>

            {/* Distribution bars */}
            <GlassCard className="max-w-4xl mx-auto">
              <SectionHeader icon={BarChart3} title="Distribución de Emociones" subtitle="Resultados del análisis batch" />
              <div className="mt-4 space-y-3">
                {results.distribution.map((d) => {
                  const config = EMOTIONS[d.emotion] || EMOTIONS.Incierto;
                  return (
                    <div key={d.emotion} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-[#a1a1b5] flex items-center gap-1.5">
                        <span>{config.emoji}</span> {d.emotion}
                      </span>
                      <div className="flex-1 h-4 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${d.pct}%`, backgroundColor: config.color }}
                        />
                      </div>
                      <span className="text-xs font-bold w-16 text-right" style={{ color: config.color }}>
                        {d.count} ({d.pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#4a4a5e] mt-3 text-right">
                Tiempo: {(results.duracionMs / 1000).toFixed(1)}s · Modelo: {MODEL_INFO.name.split('/')[1]}
              </p>
            </GlassCard>

            {/* Comments table */}
            <div className="max-w-4xl mx-auto">
              <CommentTable comments={results.comments} />
            </div>
          </>
        )}

        {/* Info */}
        <div className="text-center text-[10px] text-[#4a4a5e] space-y-1">
          <p>Los resultados se guardan automáticamente en la base de datos para las métricas del dashboard.</p>
          <p>Umbral de incertidumbre: &lt; 40% confianza → Incierto</p>
        </div>
      </div>
    </div>
  );
}
