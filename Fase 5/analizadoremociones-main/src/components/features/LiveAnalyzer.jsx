"use client";
import { useState } from 'react';
import { EMOTIONS } from '../../lib/emotionConfig';
import { classifySingle } from '../../lib/inferenceService';
import { insertPrediction } from '../../lib/dataService';
import GlassCard from '../GlassCard';
import EmotionBadge from '../EmotionBadge';
import { Sparkles, Loader2, AlertCircle, Zap, Activity } from 'lucide-react';

const EXAMPLE_CHIPS = [
  { text: 'Que bonito video, me encantó! 😍', emotion: 'Alegría' },
  { text: 'Eres el mejor creador, siempre confío en ti', emotion: 'Confianza' },
  { text: 'Me da miedo que esto pase en mi ciudad 😰', emotion: 'Miedo' },
  { text: 'No puedo creer lo que vi, no me lo esperaba!!', emotion: 'Expectación' },
  { text: 'Esto me pone muy triste, ojalá mejore 😢', emotion: 'Tristeza' },
  { text: 'Que asco de contenido, da mucho coraje 😤', emotion: 'Rechazo' },
];

const TENSION_COMBOS = {
  'Tristeza-Miedo':       { label: 'Preocupación / Angustia', desc: 'Tristeza mezclada con miedo ante lo incierto o desconocido.' },
  'Miedo-Tristeza':       { label: 'Preocupación / Angustia', desc: 'Tristeza mezclada con miedo ante lo incierto o desconocido.' },
  'Tristeza-Rechazo':     { label: 'Indignación dolida',      desc: 'Dolor emocional combinado con rechazo o disgusto profundo.' },
  'Rechazo-Tristeza':     { label: 'Indignación dolida',      desc: 'Dolor emocional combinado con rechazo o disgusto profundo.' },
  'Alegría-Confianza':    { label: 'Entusiasmo',              desc: 'Positividad reforzada por seguridad; el texto proyecta optimismo.' },
  'Confianza-Alegría':    { label: 'Entusiasmo',              desc: 'Positividad reforzada por seguridad; el texto proyecta optimismo.' },
  'Alegría-Expectación':  { label: 'Optimismo expectante',    desc: 'El texto anticipa algo bueno con emoción.' },
  'Expectación-Alegría':  { label: 'Optimismo expectante',    desc: 'El texto anticipa algo bueno con emoción.' },
  'Miedo-Expectación':    { label: 'Incertidumbre',           desc: 'Tensión entre lo que puede venir y el temor a ello.' },
  'Expectación-Miedo':    { label: 'Incertidumbre',           desc: 'Tensión entre lo que puede venir y el temor a ello.' },
  'Rechazo-Miedo':        { label: 'Aversión angustiada',     desc: 'Disgusto intenso con tono amenazante o aterrador.' },
  'Miedo-Rechazo':        { label: 'Aversión angustiada',     desc: 'Disgusto intenso con tono amenazante o aterrador.' },
  'Confianza-Rechazo':    { label: 'Crítica directa',         desc: 'Desacuerdo expresado con certeza y firmeza.' },
  'Rechazo-Confianza':    { label: 'Crítica directa',         desc: 'Desacuerdo expresado con certeza y firmeza.' },
  'Tristeza-Expectación': { label: 'Resignación esperanzadora', desc: 'Pena presente pero con cierta esperanza sobre el futuro.' },
  'Expectación-Tristeza': { label: 'Resignación esperanzadora', desc: 'Pena presente pero con cierta esperanza sobre el futuro.' },
};

export default function LiveAnalyzer() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await classifySingle(text.trim());
      const topLabel = res.isUncertain ? 'Incierto' : res.label;

      const preds = res.preds;
      const top = preds[0];
      const second = preds[1];

      // Tension: strong secondary emotion (lowered thresholds)
      const hasTension = second && second.score > 0.08 && second.score / top.score > 0.20;
      const tensionKey = hasTension ? `${topLabel}-${second.label}` : null;
      const tension = tensionKey ? TENSION_COMBOS[tensionKey] : null;

      // Traces: secondary emotions present at 2–8% (or above if no tension)
      const traces = preds.slice(1).filter((p) =>
        hasTension ? (p.label !== second.label && p.score >= 0.02) : p.score >= 0.02
      );

      // Shannon entropy → normalized [0,1]: 0 = single peak, 1 = fully uniform
      const entropy = preds.reduce((s, p) => p.score > 0 ? s - p.score * Math.log2(p.score) : s, 0);
      const normalizedEntropy = parseFloat((entropy / Math.log2(preds.length)).toFixed(2));

      // Emotional pattern label
      const pattern = res.isUncertain     ? 'ambiguo'
        : top.score >= 0.75              ? 'dominante'
        : hasTension                     ? 'tension'
        : normalizedEntropy > 0.65       ? 'disperso'
        : 'mixto';

      const confidenceLevel = res.isUncertain ? 'Baja' : res.score >= 0.65 ? 'Alta' : 'Media';

      setResult({
        preds,
        topLabel,
        topScore: res.score,
        isUncertain: res.isUncertain,
        tension: tension ? { ...tension, emotions: [topLabel, second.label] } : null,
        traces,
        pattern,
        normalizedEntropy,
        confidenceLevel,
      });

      await insertPrediction({
        texto: text.trim(),
        emocion: res.label,
        confianza: res.score,
        esIncierto: res.isUncertain,
        scores: res.scores,
        tipo: 'individual',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confColor = !result ? '#888'
    : result.isUncertain              ? '#A1A1AA'
    : result.confidenceLevel === 'Alta'  ? '#22c55e'
    : result.confidenceLevel === 'Media' ? '#f59e0b'
    : '#A1A1AA';

  return (
    <GlassCard className="max-w-3xl mx-auto">
      <div className="space-y-4">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="💬 Escribe un comentario de TikTok..."
            maxLength={500}
            rows={3}
            className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-xl px-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] resize-none focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze(); }
            }}
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-[#4a4a5e]">{text.length}/500</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.text}
              onClick={() => setText(chip.text)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-subtle text-[#6b6b80] hover:text-[#a1a1b5] hover:border-default transition-all"
            >
              <span>{EMOTIONS[chip.emotion]?.emoji}</span>
              <span>{chip.emotion}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!text.trim() || loading}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-accent-gradient text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-accent-cyan/10 transition-all active:scale-[0.98]"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
            : <><Sparkles className="w-4 h-4" /> Analizar emoción</>}
        </button>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-em-rechazo/10 border border-em-rechazo/20 text-sm text-em-rechazo flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#a1a1b5]">Resultado del análisis</h4>
            <EmotionBadge emotion={result.topLabel} size="lg" />
          </div>

          {/* Distribución de scores */}
          <div className="space-y-2.5">
            {result.preds.map((pred, i) => {
              const config = EMOTIONS[pred.label] || EMOTIONS.Incierto;
              const pct = (pred.score * 100).toFixed(1);
              const isTop = i === 0;
              return (
                <div key={pred.label} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-[#a1a1b5] flex items-center gap-1.5 flex-shrink-0">
                    <span>{config.emoji}</span> {pred.label}
                  </span>
                  <div className="flex-1 h-3 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: config.color, opacity: isTop ? 1 : 0.7, transitionDelay: `${i * 70}ms` }}
                    />
                  </div>
                  <span className="text-xs font-bold w-12 text-right flex-shrink-0" style={{ color: isTop ? config.color : '#6b6b80' }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Insight cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-subtle space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#6b6b80] uppercase tracking-wider">
                <Zap className="w-3 h-3" /> Certeza
              </p>
              <p className="text-base font-bold" style={{ color: confColor }}>
                {result.confidenceLevel}
                <span className="text-xs font-normal text-[#6b6b80] ml-1.5">({(result.topScore * 100).toFixed(1)}%)</span>
              </p>
              <p className="text-[11px] text-[#6b6b80] leading-snug">
                {result.isUncertain
                  ? 'El texto no presenta señales claras de una sola emoción.'
                  : result.confidenceLevel === 'Alta'
                    ? `El modelo identifica ${result.topLabel} con alta seguridad.`
                    : `Predomina ${result.topLabel} pero con señales mixtas.`}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-subtle space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#6b6b80] uppercase tracking-wider">
                <Activity className="w-3 h-3" /> Espectro emocional
              </p>

              {/* Pattern label */}
              <p className="text-sm font-bold text-[#f0f0f5]">
                {{
                  dominante: 'Emoción única',
                  tension:   result.tension?.label || 'Tensión emocional',
                  mixto:     'Señal mixta',
                  disperso:  'Alta dispersión',
                  ambiguo:   'Señal ambigua',
                }[result.pattern]}
              </p>

              {/* Tension combo emojis */}
              {result.pattern === 'tension' && result.tension && (
                <div className="flex items-center gap-1 text-sm">
                  <span>{EMOTIONS[result.tension.emotions[0]]?.emoji}</span>
                  <span className="text-[#4a4a5e]">+</span>
                  <span>{EMOTIONS[result.tension.emotions[1]]?.emoji}</span>
                </div>
              )}

              {/* Description */}
              <p className="text-[11px] text-[#6b6b80] leading-snug">
                {result.pattern === 'dominante' && result.traces.length === 0 &&
                  `${result.topLabel} domina de forma clara. Sin señales secundarias relevantes.`}
                {result.pattern === 'dominante' && result.traces.length > 0 &&
                  `${result.topLabel} domina. Trazas menores de otras emociones.`}
                {result.pattern === 'tension' && result.tension?.desc}
                {result.pattern === 'mixto' &&
                  `Varias emociones presentes sin que ninguna domine claramente.`}
                {result.pattern === 'disperso' &&
                  `El texto no tiene una sola emoción central; la señal está repartida entre varias.`}
                {result.pattern === 'ambiguo' &&
                  `El modelo no puede determinar una emoción con suficiente certeza.`}
              </p>

              {/* Traces chips */}
              {result.traces.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {result.traces.map((t) => {
                    const cfg = EMOTIONS[t.label];
                    return (
                      <span key={t.label}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: `${cfg?.color}18`, color: cfg?.color }}>
                        {cfg?.emoji} {t.label} <span className="opacity-60">{(t.score * 100).toFixed(1)}%</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Entropy bar */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[9px] text-[#4a4a5e] w-16 flex-shrink-0">Dispersión</span>
                <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${result.normalizedEntropy * 100}%`, backgroundColor: result.normalizedEntropy > 0.6 ? '#f59e0b' : '#06b6d4' }} />
                </div>
                <span className="text-[9px] text-[#4a4a5e] w-8 text-right flex-shrink-0">
                  {Math.round(result.normalizedEntropy * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#4a4a5e] pt-2 border-t border-subtle">
            <span>
              Confianza: <strong style={{ color: confColor }}>{result.confidenceLevel}</strong>
              {' '}· Top emoción: <strong className="text-[#6b6b80]">{result.topLabel}</strong>
            </span>
            <span>💾 Guardado en BD</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
