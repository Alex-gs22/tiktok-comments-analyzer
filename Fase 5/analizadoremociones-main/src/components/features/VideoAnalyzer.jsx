"use client";
import { useState } from 'react';
import GlassCard from '../GlassCard';
import { Link2, Hash, ToggleLeft, ToggleRight, Download, ArrowRight } from 'lucide-react';

/**
 * VideoAnalyzer — UI for batch analysis of TikTok video comments.
 * Design-only for now; actual scraping flow will be connected later.
 * 
 * Separation of concerns: This component handles ONLY the UI.
 * The scraping logic will be in src/lib/scrapers/tiktokScraper.js
 * The model inference in src/lib/services/inferenceService.js
 * The persistence in src/lib/services/predictionService.js
 */
export default function VideoAnalyzer() {
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [autoTopic, setAutoTopic] = useState(true);
  const [step, setStep] = useState('idle'); // idle | scraping | analyzing | complete

  const isValidUrl = url.includes('tiktok.com') || url.includes('vm.tiktok');

  const handleStart = () => {
    if (!isValidUrl) return;
    // TODO: Connect to actual scraping + inference pipeline
    // This will call:
    //   1. tiktokScraper.scrapeComments(url)
    //   2. inferenceService.batchAnalyze(comments)
    //   3. predictionService.persistResults(predictions, videoId)
    
    // For now, simulate the flow
    setStep('scraping');
    setTimeout(() => setStep('analyzing'), 2000);
    setTimeout(() => setStep('complete'), 4500);
  };

  return (
    <GlassCard className="max-w-3xl mx-auto">
      <div className="space-y-5">
        {/* URL Input */}
        <div>
          <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider mb-2 block">
            Link del video de TikTok
          </label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a4a5e]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/123..."
              className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all"
            />
            {url && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold ${isValidUrl ? 'text-em-confianza' : 'text-em-rechazo'}`}>
                {isValidUrl ? '✓ URL válida' : '✕ URL no válida'}
              </span>
            )}
          </div>
        </div>

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
            Auto-detectar tema
          </button>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!isValidUrl || step !== 'idle'}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-accent-gradient text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-accent-cyan/10 transition-all active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          Descargar y Analizar Comentarios
        </button>

        {/* Progress steps */}
        {step !== 'idle' && (
          <div className="space-y-3 pt-4 border-t border-subtle">
            {[
              { id: 'scraping',  label: 'Descargando comentarios del video...', icon: '📥' },
              { id: 'analyzing', label: 'Analizando emociones con el modelo...', icon: '🧠' },
              { id: 'complete',  label: 'Análisis completado — datos guardados', icon: '✅' },
            ].map((s) => {
              const stepOrder = ['scraping', 'analyzing', 'complete'];
              const currentIdx = stepOrder.indexOf(step);
              const thisIdx = stepOrder.indexOf(s.id);
              const isDone = thisIdx < currentIdx;
              const isActive = thisIdx === currentIdx;

              return (
                <div key={s.id} className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                  isDone || isActive ? 'opacity-100' : 'opacity-30'
                }`}>
                  <span className="text-base">{s.icon}</span>
                  <span className={isDone ? 'text-em-confianza' : isActive ? 'text-[#f0f0f5]' : 'text-[#4a4a5e]'}>
                    {s.label}
                  </span>
                  {isActive && !isDone && s.id !== 'complete' && (
                    <span className="ml-auto flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              );
            })}

            {step === 'complete' && (
              <button className="flex items-center gap-2 text-sm text-accent-cyan hover:underline mt-2">
                Ver resultados del análisis <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
