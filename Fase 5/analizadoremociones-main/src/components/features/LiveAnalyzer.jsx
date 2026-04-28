"use client";
import { useState } from 'react';
import { EMOTIONS } from '../../lib/emotionConfig';
import { classifySingle } from '../../lib/inferenceService';
import { insertPrediction } from '../../lib/dataService';
import GlassCard from '../GlassCard';
import EmotionBadge from '../EmotionBadge';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

const EXAMPLE_CHIPS = [
  { text: 'Que bonito video, me encantó! 😍', emotion: 'Alegría' },
  { text: 'Eres el mejor creador, siempre confío en ti', emotion: 'Confianza' },
  { text: 'Me da miedo que esto pase en mi ciudad 😰', emotion: 'Miedo' },
  { text: 'No puedo creer lo que vi, no me lo esperaba!!', emotion: 'Expectación' },
  { text: 'Esto me pone muy triste, ojalá mejore 😢', emotion: 'Tristeza' },
  { text: 'Que asco de contenido, da mucho coraje 😤', emotion: 'Rechazo' },
];

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

      setResult({
        preds: res.preds,
        topLabel: res.label,
        topScore: res.score,
        isUncertain: res.isUncertain,
      });

      // Persist to Supabase
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
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</> : <><Sparkles className="w-4 h-4" /> Analizar emoción</>}
        </button>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-em-rechazo/10 border border-em-rechazo/20 text-sm text-em-rechazo flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#a1a1b5]">Resultado del análisis</h4>
            <EmotionBadge emotion={result.topLabel} size="lg" />
          </div>
          <div className="space-y-2.5">
            {result.preds.map((pred, i) => {
              const config = EMOTIONS[pred.label] || EMOTIONS.Incierto;
              const pct = (pred.score * 100).toFixed(1);
              return (
                <div key={pred.label} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-[#a1a1b5] flex items-center gap-1.5">
                    <span>{config.emoji}</span> {pred.label}
                  </span>
                  <div className="flex-1 h-3 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: config.color, transitionDelay: `${i * 80}ms` }} />
                  </div>
                  <span className="text-xs font-bold w-12 text-right" style={{ color: config.color }}>{pct}%</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#4a4a5e] pt-2 border-t border-subtle">
            <span>Confianza: <strong className={result.isUncertain ? 'text-em-incierto' : 'text-em-confianza'}>{result.isUncertain ? 'Baja' : result.topScore >= 0.6 ? 'Alta' : 'Media'}</strong> ({(result.topScore * 100).toFixed(1)}%)</span>
            <span>💾 Guardado en BD</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
