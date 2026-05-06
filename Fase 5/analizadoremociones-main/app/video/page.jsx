"use client";
import { useState, useEffect, useRef } from 'react';
import Header from '../../src/components/Header';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import KpiCard from '../../src/components/KpiCard';
import CommentTable from '../../src/components/CommentTable';
import { EMOTIONS, MODEL_INFO } from '../../src/lib/emotionConfig';
import { getTopics } from '../../src/lib/dataService';
import { useVideoAnalysis } from '../../src/components/VideoAnalysisContext';
import {
  Hash, ToggleLeft, ToggleRight, Download, MessageCircle, Flame, AlertTriangle,
  BarChart3, Link, Loader2, Play, ChevronDown, BookOpen, RotateCcw, Check, Database, Cpu, Save
} from 'lucide-react';

// ── Phase stepper config ──────────────────────────────────
const PHASES = [
  { id: 'checking_db', label: 'Verificando',  icon: Database,  steps: ['checking_db'] },
  { id: 'scraping',   label: 'Extrayendo',   icon: Download,  steps: ['scraping'] },
  { id: 'analyzing',  label: 'Analizando',   icon: Cpu,       steps: ['analyzing'] },
  { id: 'saving',     label: 'Guardando',    icon: Save,      steps: ['saving'] },
];

function getPhaseStatus(phase, currentStep) {
  const order = ['checking_db', 'scraping', 'analyzing', 'saving', 'complete'];
  const currentIdx = order.indexOf(currentStep);
  const phaseIdx = order.indexOf(phase.steps[0]);
  if (currentStep === 'complete') return 'complete';
  if (phaseIdx < currentIdx) return 'complete';
  if (phase.steps.includes(currentStep)) return 'active';
  return 'pending';
}

function PhaseStepper({ step, progress }) {
  if (step === 'idle' || step === 'error') return null;
  return (
    <div className="space-y-3">
      {/* Steps row */}
      <div className="flex items-center">
        {PHASES.map((phase, i) => {
          const status = getPhaseStatus(phase, step);
          const Icon = phase.icon;
          const isLast = i === PHASES.length - 1;
          return (
            <div key={phase.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500"
                  style={{
                    backgroundColor: status === 'complete' ? '#22c55e20'
                      : status === 'active' ? 'rgba(6,182,212,0.15)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${status === 'complete' ? '#22c55e60'
                      : status === 'active' ? '#06b6d4'
                      : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: status === 'active' ? '0 0 12px rgba(6,182,212,0.3)' : 'none',
                  }}
                >
                  {status === 'complete' ? (
                    <Check className="w-4 h-4 text-[#22c55e]" />
                  ) : status === 'active' ? (
                    <Loader2 className="w-4 h-4 text-accent-cyan animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4 text-[#4a4a5e]" />
                  )}
                </div>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors duration-300"
                  style={{
                    color: status === 'complete' ? '#22c55e'
                      : status === 'active' ? '#06b6d4'
                      : '#4a4a5e',
                  }}
                >
                  {phase.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 h-px mx-2 transition-colors duration-500"
                  style={{
                    backgroundColor: getPhaseStatus(PHASES[i + 1], step) !== 'pending'
                      ? '#22c55e40' : 'rgba(255,255,255,0.06)'
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar (only during analyzing) */}
      {step === 'analyzing' && progress.total > 0 && (
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-gradient rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[#4a4a5e] text-right">
            {progress.current} / {progress.total} comentarios
          </p>
        </div>
      )}

      {/* Scraping indeterminate bar */}
      {(step === 'scraping' || step === 'checking_db' || step === 'saving') && (
        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-accent-gradient rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{ animation: 'indeterminate 1.5s ease-in-out infinite' }} />
        </div>
      )}
    </div>
  );
}

export default function VideoPage() {
  const {
    videoUrl, setVideoUrl,
    topic, setTopic,
    autoTopic, setAutoTopic,
    step, errorMsg, progress, videoInfo, results,
    handleReset, handleScrapeAndAnalyze,
  } = useVideoAnalysis();

  // UI-only state
  const [existingTopics, setExistingTopics] = useState([]);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const topicDropdownRef = useRef(null);

  useEffect(() => {
    if (!autoTopic && existingTopics.length === 0) {
      getTopics().then((t) => setExistingTopics(t.filter((x) => x.id !== '__independent__')));
    }
    setShowTopicDropdown(false);
  }, [autoTopic]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(e.target)) {
        setShowTopicDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const isBusy = step === 'scraping' || step === 'analyzing' || step === 'checking_db' || step === 'saving';

  return (
    <div className="w-full">
      <Header title="Analizar Video" subtitle="Extrae y analiza comentarios de un video de TikTok automáticamente" />

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        <GlassCard className="max-w-4xl mx-auto border-accent-cyan/20">
          <div className="space-y-5">
            {/* URL Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  URL del Video de TikTok
                </label>
                <button
                  onClick={() => setVideoUrl('https://www.tiktok.com/@pavelorockstar/video/7588331288608673025')}
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
                  disabled={isBusy}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl pl-11 pr-4 py-3.5 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] focus:outline-none focus:border-accent-cyan/40 transition-all font-mono disabled:opacity-40"
                />
              </div>
            </div>

            {/* Topic Selection */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider mb-2 block">
                  Asignar Tema
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a4a5e]" />
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={autoTopic ? 'El Worker detectará el tema automáticamente...' : 'Escribe un tema nuevo...'}
                      disabled={autoTopic || isBusy}
                      className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] disabled:opacity-40 focus:outline-none focus:border-accent-cyan/40 transition-all"
                    />
                  </div>
                  {!autoTopic && existingTopics.length > 0 && (
                    <div ref={topicDropdownRef} className="relative">
                      <button
                        onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                        disabled={isBusy}
                        className="flex items-center gap-2 px-3 py-3 rounded-xl border border-subtle text-xs font-medium text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)] transition-all whitespace-nowrap disabled:opacity-40 h-full"
                      >
                        <BookOpen className="w-4 h-4" />
                        Existentes
                        <ChevronDown className={`w-3 h-3 transition-transform ${showTopicDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showTopicDropdown && (
                        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#13131a] border border-subtle shadow-2xl overflow-hidden z-50">
                          <div className="max-h-56 overflow-y-auto">
                            {existingTopics.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => { setTopic(t.nombre); setShowTopicDropdown(false); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                              >
                                <p className="text-sm font-medium text-[#f0f0f5] truncate">{t.nombre}</p>
                                <p className="text-[10px] text-[#4a4a5e] mt-0.5">{t.categoria} · {t.totalComentarios} comentarios</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setAutoTopic(!autoTopic)}
                disabled={isBusy}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-subtle text-xs font-medium text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)] transition-all whitespace-nowrap disabled:opacity-40"
              >
                {autoTopic ? <ToggleRight className="w-4 h-4 text-em-confianza" /> : <ToggleLeft className="w-4 h-4 text-[#4a4a5e]" />}
                Auto-detectar
              </button>
            </div>

            {/* Error */}
            {step === 'error' && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleScrapeAndAnalyze}
              disabled={!videoUrl || isBusy}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-accent-gradient text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-[0.98]"
            >
              {!isBusy ? (
                <><Download className="w-4 h-4" /> Extraer y Analizar Video</>
              ) : (
                <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
              )}
            </button>

            {/* Phase stepper */}
            <PhaseStepper step={step} progress={progress} />
          </div>
        </GlassCard>

        {/* Results */}
        {results && videoInfo && (
          <div className="space-y-6 animate-fade-in">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between p-4 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-subtle">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#a1a1b5] font-medium mb-1">@{videoInfo.author}</p>
                <h3 className="text-sm font-bold text-[#f0f0f5] truncate">{videoInfo.title || 'Video sin título'}</h3>
              </div>
              <div className="flex gap-3 items-center text-xs text-[#a1a1b5]">
                <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> {videoInfo.play_count?.toLocaleString()}</span>
                <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> {videoInfo.digg_count?.toLocaleString()}</span>
                <span className="flex items-center gap-1.5 font-semibold text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-lg">
                  <Hash className="w-3.5 h-3.5" /> {topic}
                </span>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle text-[#6b6b80] hover:text-[#f0f0f5] hover:border-[#6b6b80] transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Nuevo análisis
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <KpiCard title="Extraídos" value={results.total} icon={MessageCircle} color="#06b6d4" />
              <KpiCard title="Emoción Dominante" value={results.emocionDominante} icon={Flame} color={EMOTIONS[results.emocionDominante]?.color || '#888'} animate={false} delay={0.1} />
              <KpiCard title="Inciertos" value={results.totalInciertos} icon={AlertTriangle} color="#A1A1AA" delay={0.2} />
              <KpiCard title="Confianza Prom." value={results.confianzaPromedio} decimals={2} icon={BarChart3} color="#8b5cf6" delay={0.3} />
            </div>

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
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${d.pct}%`, backgroundColor: config.color }} />
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

            <div className="max-w-4xl mx-auto">
              <CommentTable comments={results.comments} />
            </div>

            <div className="text-center text-[10px] text-[#4a4a5e]">
              <p>Los resultados se han guardado en la base de datos bajo el tema &quot;{topic}&quot;.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
