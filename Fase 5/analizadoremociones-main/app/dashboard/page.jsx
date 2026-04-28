"use client";
import Header from '../../src/components/Header';
import KpiCard from '../../src/components/KpiCard';
import EmotionTreemap from '../../src/components/charts/EmotionTreemap';
import SentimentGauge from '../../src/components/charts/SentimentGauge';

import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import EmotionBadge from '../../src/components/EmotionBadge';
import { MessageCircle, Flame, AlertTriangle, Video, Trophy } from 'lucide-react';
import { dashboardKpis, emotionDistribution, sentimentAggregated, topConfidentComments } from '../../src/lib/mockData';
import { EMOTIONS } from '../../src/lib/emotionConfig';

export default function DashboardPage() {
  return (
    <div className="w-full">
      <Header title="Overview" subtitle="Panorama general de predicciones" />

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Analizados"
            value={dashboardKpis.totalPredicciones}
            subtext="Comentarios procesados por el modelo"
            icon={MessageCircle}
            color="#06b6d4"
            delay={0}
          />
          <KpiCard
            title="Emoción Dominante"
            value={dashboardKpis.emocionDominante}
            subtext="Emoción más frecuente en predicciones"
            icon={Flame}
            color={EMOTIONS[dashboardKpis.emocionDominante]?.color || '#F87171'}
            animate={false}
            delay={0.1}
          />
          <KpiCard
            title="% Inciertos"
            value={dashboardKpis.pctInciertos}
            suffix="%"
            subtext="Confianza < 40% del modelo"
            icon={AlertTriangle}
            color="#A1A1AA"
            decimals={1}
            delay={0.2}
          />
          <KpiCard
            title="Videos Analizados"
            value={dashboardKpis.totalVideos}
            subtext="Videos de TikTok procesados"
            icon={Video}
            color="#8b5cf6"
            delay={0.3}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EmotionTreemap data={emotionDistribution} />
          <SentimentGauge data={sentimentAggregated} />
        </div>

        {/* Top confident comments */}
        <GlassCard>
          <SectionHeader
            icon={Trophy}
            title="Top 5 — Predicciones Más Confiables"
            subtitle="Comentarios donde el modelo tiene mayor certeza"
          />
          <div className="mt-4 space-y-3">
            {topConfidentComments.map((c, i) => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                <span className="text-lg font-bold text-[#4a4a5e] w-6 text-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#a1a1b5]">{c.texto}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <EmotionBadge emotion={c.emocion} size="sm" />
                    <span className="text-[10px] text-[#4a4a5e]">
                      Confianza: <strong className="text-em-confianza">{(c.confianza * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="text-[10px] text-[#4a4a5e]">
                      ❤️ {c.likes.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}