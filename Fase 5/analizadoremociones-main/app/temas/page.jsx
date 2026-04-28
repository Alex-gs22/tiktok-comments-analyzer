"use client";
import { useState } from 'react';
import Header from '../../src/components/Header';
import KpiCard from '../../src/components/KpiCard';
import ComparisonBars from '../../src/components/charts/ComparisonBars';
import CommentTable from '../../src/components/CommentTable';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import TopicSelector from '../../src/components/features/TopicSelector';
import { EMOTIONS } from '../../src/lib/emotionConfig';
import { Hash, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  topics,
  topicEmotionProfiles,
  globalEmotionProfile,
  topicKeywords,
  topicComments,
} from '../../src/lib/mockData';

export default function TemasPage() {
  const [selectedTopic, setSelectedTopic] = useState(topics[0].nombre);
  const topicData = topics.find((t) => t.nombre === selectedTopic) || topics[0];
  const profile = topicEmotionProfiles[selectedTopic] || {};
  const keywords = topicKeywords[selectedTopic] || [];
  const comments = topicComments[selectedTopic] || [];
  const maxKw = Math.max(...keywords.map((k) => k.value), 1);

  // Delta vs global
  const dominantEmotion = topicData.emocionDominante;
  const dominantPct = profile[dominantEmotion] || 0;
  const globalPct = globalEmotionProfile[dominantEmotion] || 0;
  const delta = (dominantPct - globalPct).toFixed(1);

  return (
    <div className="w-full">
      <Header title="Análisis por Tema" subtitle="Drill-down emocional por tema">
        <TopicSelector topics={topics} selected={selectedTopic} onSelect={setSelectedTopic} />
      </Header>

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* Topic header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-[#4a4a5e] mb-1">
            <span>Análisis por Tema</span>
            <span className="text-[#2a2a3e]">/</span>
            <span className="text-accent-cyan font-semibold">{topicData.categoria}</span>
          </div>
          <h2 className="text-3xl font-bold text-[#f0f0f5] mb-2">{selectedTopic}</h2>
          <div className="flex items-center gap-3 text-sm text-[#6b6b80]">
            <span>{topicData.totalComentarios} comentarios</span>
            <span className="text-[#2a2a3e]">·</span>
            <span className="flex items-center gap-1.5" style={{ color: EMOTIONS[dominantEmotion]?.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EMOTIONS[dominantEmotion]?.color }} />
              {dominantEmotion} dominante ({dominantPct}%)
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            title="Emoción Dominante"
            value={dominantEmotion}
            subtext={`${dominantPct}% de los comentarios`}
            icon={Hash}
            color={EMOTIONS[dominantEmotion]?.color || '#888'}
            animate={false}
          />
          <KpiCard
            title="Δ vs Global"
            value={parseFloat(delta)}
            suffix="pp"
            prefix={parseFloat(delta) > 0 ? '+' : ''}
            subtext={`Diferencia con promedio global (${globalPct}%)`}
            icon={TrendingUp}
            color={parseFloat(delta) > 0 ? '#F87171' : '#34D399'}
            decimals={1}
            delay={0.1}
          />
          <KpiCard
            title="% Inciertos"
            value={topicData.pctInciertos}
            suffix="%"
            subtext="Comentarios con baja confianza"
            icon={AlertTriangle}
            color="#A1A1AA"
            decimals={1}
            delay={0.2}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <ComparisonBars
              topicProfile={profile}
              globalProfile={globalEmotionProfile}
              topicName={selectedTopic}
            />
          </div>

          {/* Keywords */}
          <GlassCard>
            <SectionHeader icon={Hash} title="Palabras Clave" subtitle="Top keywords del tema" />
            <div className="space-y-4 mt-4">
              {keywords.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#a1a1b5] font-medium">{item.label}</span>
                    <span className="text-[#6b6b80]">{item.value}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-cyan/50"
                      style={{ width: `${(item.value / maxKw) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Comments table */}
        <CommentTable comments={comments} />
      </div>
    </div>
  );
}
