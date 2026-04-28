"use client";
import { useState, useEffect, useCallback } from "react";
import Header from "../../src/components/Header";
import KpiCard from "../../src/components/KpiCard";
import ComparisonBars from "../../src/components/charts/ComparisonBars";
import CommentTable from "../../src/components/CommentTable";
import GlassCard from "../../src/components/GlassCard";
import SectionHeader from "../../src/components/SectionHeader";
import TopicSelector from "../../src/components/features/TopicSelector";
import { EMOTIONS } from "../../src/lib/emotionConfig";
import { Hash, TrendingUp, BarChart3 } from "lucide-react";
import { getTopics, getTopicEmotionProfile, getGlobalEmotionProfile, getTopicComments } from "../../src/lib/dataService";
import { topicKeywords } from "../../src/lib/mockData";
import { TemasSkeleton, EmptyState } from '../../src/components/StateScreens';
import { useDataRefresh } from '../../src/lib/useDataRefresh';

export default function TemasPage() {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topicProfile, setTopicProfile] = useState({});
  const [globalProfile, setGlobalProfile] = useState({});
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  const loadInitial = useCallback(async () => {
    setLoading(true);
    const [t, g] = await Promise.all([getTopics(), getGlobalEmotionProfile()]);
    setTopics(t);
    setGlobalProfile(g);
    if (t.length > 0 && !selectedTopic) setSelectedTopic(t[0].nombre);
    setLoading(false);
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Auto-refresh when new data is inserted
  useDataRefresh(loadInitial);

  // Load topic-specific data when selection changes
  useEffect(() => {
    if (!selectedTopic) return;
    (async () => {
      const [p, c] = await Promise.all([
        getTopicEmotionProfile(selectedTopic),
        getTopicComments(selectedTopic),
      ]);
      setTopicProfile(p);
      setComments(c);
    })();
  }, [selectedTopic]);

  if (loading) {
    return (
      <div className="w-full">
        <Header title="Temas Analizados" subtitle="Drill-down emocional por tema" />
        <TemasSkeleton />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="w-full">
        <Header title="Temas Analizados" subtitle="Drill-down emocional por tema" />
        <EmptyState
          icon={Hash}
          title="Sin temas"
          message="Analiza comentarios desde 'Analizar Video' o el 'Analizador en Vivo' para generar temas automáticamente."
          action={
            <a href="/video" className="px-4 py-2 rounded-xl bg-accent-gradient text-white text-sm font-medium hover:shadow-lg hover:shadow-accent-cyan/10 transition-all">
              Analizar Video
            </a>
          }
        />
      </div>
    );
  }

  const topicData = topics.find((t) => t.nombre === selectedTopic) || topics[0];
  const keywords = topicKeywords[selectedTopic] || [];
  const maxKw = Math.max(...keywords.map((k) => k.value), 1);
  const dominantEmotion = topicData.emocionDominante;
  const dominantPct = topicProfile[dominantEmotion] || 0;
  const globalPct = globalProfile[dominantEmotion] || 0;
  const delta = (dominantPct - globalPct).toFixed(1);
  const hasKeywords = keywords.length > 0;

  return (
    <div className="w-full">
      <Header title="Temas Analizados" subtitle="Drill-down emocional por tema">
        <TopicSelector topics={topics} selected={selectedTopic} onSelect={setSelectedTopic} />
      </Header>

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#4a4a5e] mb-1">
            <span>Temas Analizados</span>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="Emoción Dominante" value={dominantEmotion} subtext={`${dominantPct}% de los comentarios`} icon={Hash} color={EMOTIONS[dominantEmotion]?.color || "#888"} animate={false} />
          <KpiCard title="Δ vs Global" value={parseFloat(delta)} suffix="pp" prefix={parseFloat(delta) > 0 ? "+" : ""} subtext={`Diferencia con promedio global (${globalPct}%)`} icon={TrendingUp} color={parseFloat(delta) > 0 ? "#F87171" : "#34D399"} decimals={1} delay={0.1} />
          <KpiCard title="Confianza Promedio" value={topicData.confianzaPromedio ? (topicData.confianzaPromedio * 100) : 0} suffix="%" subtext="Certeza promedio del modelo" icon={BarChart3} color="#8b5cf6" decimals={1} delay={0.2} />
        </div>

        {/* Adaptive grid: full width if no keywords, 2/3 + 1/3 if keywords exist */}
        <div className={`grid grid-cols-1 ${hasKeywords ? 'xl:grid-cols-3' : ''} gap-6`}>
          <div className={hasKeywords ? 'xl:col-span-2' : ''}>
            <ComparisonBars topicProfile={topicProfile} globalProfile={globalProfile} topicName={selectedTopic} />
          </div>
          {hasKeywords && (
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
                      <div className="h-full rounded-full bg-accent-cyan/50" style={{ width: `${(item.value / maxKw) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        <CommentTable comments={comments} />
      </div>
    </div>
  );
}
