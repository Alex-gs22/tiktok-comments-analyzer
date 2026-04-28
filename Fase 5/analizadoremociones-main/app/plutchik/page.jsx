"use client";
import { useEffect, useState, useCallback } from 'react';
import Header from '../../src/components/Header';
import PlutchikWheel from '../../src/components/charts/PlutchikWheel';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import EmotionBadge from '../../src/components/EmotionBadge';
import { EMOTIONS, EMOTION_KEYS, PLUTCHIK_MAP } from '../../src/lib/emotionConfig';
import { getEmotionDistribution } from '../../src/lib/dataService';
import { Combine, Info, Flower2 } from 'lucide-react';
import { PlutchikSkeleton, EmptyState } from '../../src/components/StateScreens';
import { useDataRefresh } from '../../src/lib/useDataRefresh';

const DYADS = [
  { combo: ['Alegría', 'Confianza'], result: 'Amor', emoji: '❤️' },
  { combo: ['Confianza', 'Miedo'], result: 'Sumisión', emoji: '🫠' },
  { combo: ['Miedo', 'Tristeza'], result: 'Desesperación', emoji: '😩' },
  { combo: ['Tristeza', 'Rechazo'], result: 'Desprecio', emoji: '😒' },
  { combo: ['Expectación', 'Alegría'], result: 'Optimismo', emoji: '🌟' },
];

export default function PlutchikPage() {
  const [wheelData, setWheelData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const dist = await getEmotionDistribution();
    const wd = {};
    dist.forEach((d) => { wd[d.emotion] = { porcentaje: d.porcentaje, total: d.total }; });
    setWheelData(wd);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh when new data is inserted
  useDataRefresh(loadData);

  if (loading || !wheelData) {
    return (
      <div className="w-full">
        <Header title="Rueda de Plutchik" subtitle="6 emociones del modelo mapeadas al marco teórico" />
        <PlutchikSkeleton />
      </div>
    );
  }

  const hasData = Object.values(wheelData).some((d) => d.total > 0);
  if (!hasData) {
    return (
      <div className="w-full">
        <Header title="Rueda de Plutchik" subtitle="6 emociones del modelo mapeadas al marco teórico" />
        <EmptyState
          icon={Flower2}
          title="Sin datos de emociones"
          message="Analiza comentarios para visualizar la distribución en la Rueda de Plutchik."
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <Header title="Rueda de Plutchik" subtitle="6 emociones del modelo mapeadas al marco teórico" />
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        <GlassCard padding="p-4" className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#a1a1b5]">
            El modelo predice <strong className="text-[#f0f0f5]">6 emociones</strong> basadas en la Rueda de Plutchik.
            Fusiones: Disgusto + Ira → <strong>Rechazo</strong>, Sorpresa + Anticipación → <strong>Expectación</strong>.
          </p>
        </GlassCard>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlutchikWheel data={wheelData} />
          <div className="space-y-6">
            <GlassCard>
              <SectionHeader icon={Combine} title="Mapeo de Fusiones" subtitle="8 emociones teóricas → 6 predictivas" />
              <div className="mt-4 space-y-3">
                {EMOTION_KEYS.map((emotion) => {
                  const map = PLUTCHIK_MAP[emotion];
                  const config = EMOTIONS[emotion];
                  return (
                    <div key={emotion} className="flex items-center gap-3 p-2.5 rounded-xl bg-[rgba(255,255,255,0.02)]">
                      <EmotionBadge emotion={emotion} size="sm" />
                      <span className="text-[10px] text-[#6b6b80]">{map?.merged ? `← ${map.original.join(' + ')}` : '← Original Plutchik'}</span>
                      <span className="ml-auto text-xs font-bold" style={{ color: config.color }}>{wheelData[emotion]?.porcentaje || 0}%</span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
            <GlassCard>
              <SectionHeader icon={Combine} title="Díadas de Plutchik" subtitle="Emociones compuestas teóricas" />
              <div className="mt-4 space-y-2">
                {DYADS.map((d) => (
                  <div key={d.result} className="flex items-center gap-2 p-2 rounded-lg bg-[rgba(255,255,255,0.02)]">
                    <span>{d.emoji}</span>
                    <span className="text-xs text-[#a1a1b5] font-medium">{d.result}</span>
                    <span className="text-[10px] text-[#4a4a5e] ml-auto">{d.combo.join(' + ')}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
