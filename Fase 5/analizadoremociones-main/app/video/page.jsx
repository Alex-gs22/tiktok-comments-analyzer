"use client";
import { useState, useCallback } from 'react';
import Header from '../../src/components/Header';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';

import KpiCard from '../../src/components/KpiCard';
import CommentTable from '../../src/components/CommentTable';
import { EMOTIONS, MODEL_INFO } from '../../src/lib/emotionConfig';
import { classifyBatch } from '../../src/lib/inferenceService';
import { insertPrediction, insertSession, insertVideo } from '../../src/lib/dataService';
import { Hash, ToggleLeft, ToggleRight, Download, MessageCircle, Flame, AlertTriangle, BarChart3, Link, Loader2, Play } from 'lucide-react';

export default function VideoPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [autoTopic, setAutoTopic] = useState(true);
  
  // idle | scraping | analyzing | complete | error
  const [step, setStep] = useState('idle'); 
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [videoInfo, setVideoInfo] = useState(null);
  const [results, setResults] = useState(null);

  const loadExampleUrl = () => {
    setVideoUrl('https://www.tiktok.com/@pavelorockstar/video/7588331288608673025');
  };

  const handleScrapeAndAnalyze = useCallback(async () => {
    if (!videoUrl) return;
    setStep('scraping');
    setErrorMsg(null);
    setResults(null);
    setVideoInfo(null);

    const startTime = Date.now();

    try {
      // 1. Scrape comments from Cloudflare Worker
      const scraperRes = await fetch(`https://tiktok-scraper-worker.alex-gs1978.workers.dev/?url=${encodeURIComponent(videoUrl)}`);
      const scraperData = await scraperRes.json();

      if (!scraperRes.ok || scraperData.error) {
        throw new Error(scraperData.error || 'Error al extraer comentarios del video.');
      }

      if (!scraperData.comments || scraperData.comments.length === 0) {
        throw new Error('No se encontraron comentarios válidos en el video.');
      }

      setVideoInfo(scraperData);
      
      const finalTopic = autoTopic ? scraperData.detected_topic : (topic || 'Tema General');
      if (autoTopic) setTopic(finalTopic);

      const commentsToAnalyze = scraperData.comments;
      const texts = commentsToAnalyze.map(c => c.texto_raw);

      // 2. Run Inference in browser
      setStep('analyzing');
      setProgress({ current: 0, total: texts.length });

      const batchResults = await classifyBatch(texts, {
        onProgress: (current, total) => setProgress({ current, total }),
        delayMs: 50, // Faster since we have up to 500
      });

      const duracionMs = Date.now() - startTime;

      // 3. Build Results
      const emotionCounts = {};
      let totalInciertos = 0;
      let totalConfianza = 0;
      const commentResults = [];

      batchResults.forEach((r, idx) => {
        const sourceComment = commentsToAnalyze[idx];
        emotionCounts[r.label] = (emotionCounts[r.label] || 0) + 1;
        if (r.isUncertain) totalInciertos++;
        totalConfianza += r.score;
        
        commentResults.push({
          id: sourceComment.id_comment,
          texto: r.texto,
          emocion: r.label,
          confianza: r.score,
          likes: sourceComment.likes || 0,
          fecha: sourceComment.fecha
        });
      });

      const emocionDominante = Object.entries(emotionCounts)
        .filter(([k]) => k !== 'Incierto')
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Incierto';

      const summary = {
        total: texts.length,
        totalInciertos,
        emocionDominante,
        confianzaPromedio: totalConfianza / texts.length,
        duracionMs,
        distribution: Object.entries(emotionCounts).map(([emotion, count]) => ({
          emotion,
          count,
          pct: ((count / texts.length) * 100).toFixed(1),
        })).sort((a, b) => b.count - a.count),
        comments: commentResults.sort((a,b) => b.confianza - a.confianza), // Sort by confidence
      };

      // 4. Persist to Supabase
      const videoIdDb = await insertVideo({
        url: videoUrl,
        video_id_tiktok: scraperData.video_id,
        titulo: scraperData.title,
        tema: finalTopic,
        temaAutoGenerado: autoTopic,
        totalComentarios: scraperData.comments_extracted,
        totalAnalizados: texts.length
      });

      if (videoIdDb) {
        // Guardar predicciones vinculadas al video
        for (const [idx, r] of batchResults.entries()) {
          const sourceComment = commentsToAnalyze[idx];
          await insertPrediction({
            texto: r.texto,
            emocion: r.label,
            confianza: r.score,
            esIncierto: r.isUncertain,
            scores: r.scores,
            tipo: 'batch_video',
            idVideo: videoIdDb,
            likes: sourceComment.likes,
            fecha: sourceComment.fecha
          });
        }
      }

      await insertSession({
        idVideo: videoIdDb,
        tipo: 'batch_video',
        totalProcesados: texts.length,
        totalInciertos,
        emocionDominante,
        confianzaPromedio: parseFloat((totalConfianza / texts.length).toFixed(4)),
        duracionMs,
      });

      setResults(summary);
      setStep('complete');

    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }, [videoUrl, topic, autoTopic]);

  return (
    <div className="w-full">
      <Header title="Analizar Video" subtitle="Extrae y analiza comentarios de un video de TikTok automáticamente" />

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* Input section */}
        <GlassCard className="max-w-4xl mx-auto border-accent-cyan/20">
          <div className="space-y-5">
            {/* URL Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  URL del Video de TikTok
                </label>
                <button
                  onClick={loadExampleUrl}
                  className="text-[10px] text-accent-cyan hover:underline"
                >
                  Cargar URL de ejemplo
                </button>
              </div>
              <div className="relative">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a4a5e]" />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@usuario/video/123456789..."
                  disabled={step === 'scraping' || step === 'analyzing'}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl pl-11 pr-4 py-3.5 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] focus:outline-none focus:border-accent-cyan/40 transition-all font-mono"
                />
              </div>
            </div>

            {/* Topic Selection */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider mb-2 block">
                  Asignar Tema
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a4a5e]" />
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={autoTopic ? 'El Worker detectará el tema automáticamente...' : 'Ej: Política, Deportes...'}
                    disabled={autoTopic || step === 'scraping' || step === 'analyzing'}
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] disabled:opacity-40 focus:outline-none focus:border-accent-cyan/40 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={() => setAutoTopic(!autoTopic)}
                disabled={step === 'scraping' || step === 'analyzing'}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-subtle text-xs font-medium text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)] transition-all whitespace-nowrap disabled:opacity-40"
              >
                {autoTopic ? <ToggleRight className="w-4 h-4 text-em-confianza" /> : <ToggleLeft className="w-4 h-4 text-[#4a4a5e]" />}
                Auto-detectar
              </button>
            </div>

            {/* Error Message */}
            {step === 'error' && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleScrapeAndAnalyze}
              disabled={!videoUrl || step === 'scraping' || step === 'analyzing'}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-accent-gradient text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-[0.98]"
            >
              {step === 'idle' || step === 'error' || step === 'complete' ? (
                <>
                  <Download className="w-4 h-4" />
                  Extraer y Analizar Video
                </>
              ) : step === 'scraping' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extrayendo comentarios de TikTok...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 animate-pulse" />
                  Analizando emociones... {progress.current}/{progress.total}
                </>
              )}
            </button>

            {/* Progress bar */}
            {(step === 'scraping' || step === 'analyzing') && (
              <div className="w-full h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-gradient rounded-full transition-all duration-300"
                  style={{ width: step === 'scraping' ? '15%' : `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            )}
          </div>
        </GlassCard>

        {/* Results */}
        {results && videoInfo && (
          <div className="space-y-6 animate-fade-in">
            {/* Video Meta Header */}
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between p-4 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-subtle">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#a1a1b5] font-medium mb-1">@{videoInfo.author}</p>
                <h3 className="text-sm font-bold text-[#f0f0f5] truncate">{videoInfo.title || 'Video sin título'}</h3>
              </div>
              <div className="flex gap-4 text-xs text-[#a1a1b5]">
                <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> {videoInfo.play_count?.toLocaleString()}</span>
                <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> {videoInfo.digg_count?.toLocaleString()}</span>
                <span className="flex items-center gap-1.5 font-semibold text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-lg">
                  <Hash className="w-3.5 h-3.5" /> {topic}
                </span>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <KpiCard title="Extraídos" value={results.total} icon={MessageCircle} color="#06b6d4" />
              <KpiCard title="Emoción Dominante" value={results.emocionDominante} icon={Flame} color={EMOTIONS[results.emocionDominante]?.color || '#888'} animate={false} delay={0.1} />
              <KpiCard title="Inciertos" value={results.totalInciertos} icon={AlertTriangle} color="#A1A1AA" delay={0.2} />
              <KpiCard title="Confianza Prom." value={results.confianzaPromedio} decimals={2} icon={BarChart3} color="#8b5cf6" delay={0.3} />
            </div>

            {/* Distribution bars */}
            <GlassCard className="max-w-4xl mx-auto">
              <SectionHeader icon={BarChart3} title="Distribución de Emociones" subtitle="Resultados del análisis" />
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
                Tiempo Total: {(results.duracionMs / 1000).toFixed(1)}s · Modelo: {MODEL_INFO.name.split('/')[1]}
              </p>
            </GlassCard>

            {/* Comments table */}
            <div className="max-w-4xl mx-auto">
              <CommentTable comments={results.comments} />
            </div>

            {/* Info */}
            <div className="text-center text-[10px] text-[#4a4a5e] space-y-1">
              <p>Los resultados se han guardado en la base de datos bajo el tema "{topic}".</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
