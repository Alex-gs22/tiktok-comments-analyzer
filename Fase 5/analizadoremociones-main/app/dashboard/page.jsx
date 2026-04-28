"use client";
import { useEffect, useState, useCallback } from 'react';
import Header from '../../src/components/Header';
import KpiCard from '../../src/components/KpiCard';
import EmotionTreemap from '../../src/components/charts/EmotionTreemap';
import SentimentGauge from '../../src/components/charts/SentimentGauge';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import EmotionBadge from '../../src/components/EmotionBadge';
import { MessageCircle, Flame, AlertTriangle, Video, Trophy, RefreshCw, BarChart3 } from 'lucide-react';
import { getDashboardKpis, getEmotionDistribution, getSentimentAggregated, getTopConfidentComments } from '../../src/lib/dataService';
import { EMOTIONS } from '../../src/lib/emotionConfig';
import { DashboardSkeleton, EmptyState } from '../../src/components/StateScreens';
import { useDataRefresh } from '../../src/lib/useDataRefresh';

export default function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [topComments, setTopComments] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [k, d, s, t] = await Promise.all([
      getDashboardKpis(),
      getEmotionDistribution(),
      getSentimentAggregated(),
      getTopConfidentComments(5),
    ]);
    setKpis(k);
    setDistribution(d);
    setSentiment(s);
    setTopComments(t);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh when new data is inserted (e.g. from Live Analyzer)
  useDataRefresh(loadData);

  if (loading || !kpis) {
    return (
      <div className="w-full">
        <Header title="Overview" subtitle="Panorama general de predicciones" />
        <DashboardSkeleton />
      </div>
    );
  }

  if (kpis.totalPredicciones === 0) {
    return (
      <div className="w-full">
        <Header title="Overview" subtitle="Panorama general de predicciones" />
        <EmptyState
          icon={BarChart3}
          title="Dashboard vacío"
          message="Aún no hay predicciones. Usa el Analizador en Vivo o Analiza un Video para generar datos."
          action={
            <a href="/analizador" className="px-4 py-2 rounded-xl bg-accent-gradient text-white text-sm font-medium hover:shadow-lg hover:shadow-accent-cyan/10 transition-all">
              Ir al Analizador
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <Header title="Overview" subtitle="Panorama general de predicciones">
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-subtle text-xs text-[#6b6b80] hover:text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)] transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </Header>

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Analizados" value={kpis.totalPredicciones} subtext="Comentarios procesados por el modelo" icon={MessageCircle} color="#06b6d4" delay={0} />
          <KpiCard title="Emoción Dominante" value={kpis.emocionDominante} subtext="Emoción más frecuente" icon={Flame} color={EMOTIONS[kpis.emocionDominante]?.color || '#F87171'} animate={false} delay={0.1} />
          <KpiCard title="% Inciertos" value={kpis.pctInciertos} suffix="%" subtext="Confianza < 40%" icon={AlertTriangle} color="#A1A1AA" decimals={1} delay={0.2} />
          <KpiCard title="Videos" value={kpis.totalVideos} subtext="Videos de TikTok procesados" icon={Video} color="#8b5cf6" delay={0.3} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {distribution && <EmotionTreemap data={distribution} />}
          {sentiment && <SentimentGauge data={sentiment} />}
        </div>

        {topComments?.length > 0 && (
          <GlassCard>
            <SectionHeader icon={Trophy} title="Top 5 — Predicciones Más Confiables" subtitle="Comentarios donde el modelo tiene mayor certeza" />
            <div className="mt-4 space-y-3">
              {topComments.map((c, i) => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                  <span className="text-lg font-bold text-[#4a4a5e] w-6 text-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#a1a1b5]">{c.texto}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <EmotionBadge emotion={c.emocion} size="sm" />
                      <span className="text-[10px] text-[#4a4a5e]">Confianza: <strong className="text-em-confianza">{(c.confianza * 100).toFixed(1)}%</strong></span>
                      {c.likes > 0 && <span className="text-[10px] text-[#4a4a5e]">❤️ {c.likes.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}