"use client";
import { useEffect, useState, useCallback, useMemo } from 'react';
import Header from '../../src/components/Header';
import KpiCard from '../../src/components/KpiCard';
import StackedAreaTimeline from '../../src/components/charts/StackedAreaTimeline';
import TopicSelector from '../../src/components/features/TopicSelector';
import { TrendingUp, TrendingDown, Calendar, Clock, ChevronLeft, ChevronRight, CalendarDays, CalendarRange } from 'lucide-react';
import { getTimelineFiltered, getTopics } from '../../src/lib/dataService';
import { EMOTION_KEYS, EMOTIONS } from '../../src/lib/emotionConfig';
import { TimelineSkeleton, EmptyState } from '../../src/components/StateScreens';
import { useDataRefresh } from '../../src/lib/useDataRefresh';

// ── Helpers ─────────────────────────────────────────────

/** Get all unique periods from data, sorted */
function extractPeriods(data) {
  if (!data?.length) return [];
  const periods = [...new Set(data.map((d) => d.periodo))].sort();
  return periods;
}

/** Safely parse a date string (YYYY-MM or YYYY-MM-DD) */
function safeDate(str) {
  if (str && str.length === 7) return new Date(str + '-01');
  return new Date(str);
}

/** Format a period string for display */
function formatPeriod(period, granularity) {
  if (granularity === 'month') {
    const d = safeDate(period);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
  }
  // Week: show range "3 Mar – 9 Mar 2026"
  const start = safeDate(period);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sDay = start.getDate();
  const sMonth = start.toLocaleDateString('es-MX', { month: 'short' });
  const eDay = end.getDate();
  const eMonth = end.toLocaleDateString('es-MX', { month: 'short' });
  const year = start.getFullYear();
  if (sMonth === eMonth) {
    return `${sDay} – ${eDay} ${sMonth} ${year}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${year}`;
}

/** Filter data to a single period window (±context periods) */
function filterDataToWindow(allData, periods, currentIndex, windowSize) {
  const start = Math.max(0, currentIndex - windowSize);
  const end = Math.min(periods.length - 1, currentIndex + windowSize);
  const visiblePeriods = new Set(periods.slice(start, end + 1));
  return allData.filter((d) => visiblePeriods.has(d.periodo));
}

export default function TimelinePage() {
  const [allData, setAllData] = useState(null); // full dataset
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [granularity, setGranularity] = useState('month');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [periodIndex, setPeriodIndex] = useState(-1); // -1 = show all

  const loadTopics = useCallback(async () => {
    const t = await getTopics();
    setTopics(t);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [d] = await Promise.all([
      getTimelineFiltered(granularity, selectedTopic),
      topics.length === 0 ? loadTopics() : Promise.resolve(),
    ]);
    setAllData(d);
    setPeriodIndex(-1); // reset to "all" when filters change
    setLoading(false);
  }, [granularity, selectedTopic, loadTopics, topics.length]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadData(); }, [loadData]);
  useDataRefresh(loadData);

  // All unique periods
  const periods = useMemo(() => extractPeriods(allData, granularity), [allData, granularity]);

  // Window size: how many periods to show around the selected one
  const windowSize = granularity === 'month' ? 2 : 4;

  // Visible data based on period selection
  const visibleData = useMemo(() => {
    if (!allData?.length) return [];
    if (periodIndex === -1) return allData; // show all
    return filterDataToWindow(allData, periods, periodIndex, windowSize);
  }, [allData, periods, periodIndex, windowSize]);

  // Navigation
  const canGoPrev = periodIndex > 0;
  const canGoNext = periodIndex < periods.length - 1;
  const isShowingAll = periodIndex === -1;

  const goPrev = () => {
    if (periodIndex === -1) {
      setPeriodIndex(periods.length - 1); // start from end
    } else if (canGoPrev) {
      setPeriodIndex(periodIndex - 1);
    }
  };
  const goNext = () => {
    if (canGoNext) setPeriodIndex(periodIndex + 1);
  };
  const showAll = () => setPeriodIndex(-1);

  // Current period label
  const periodLabel = isShowingAll
    ? 'Todos los periodos'
    : formatPeriod(periods[periodIndex], granularity);

  // Dynamic KPIs
  const kpis = useMemo(() => {
    const d = visibleData;
    if (!d || d.length === 0) return null;

    const totals = {};
    EMOTION_KEYS.forEach((e) => { totals[e] = 0; });
    d.forEach((row) => { EMOTION_KEYS.forEach((e) => { totals[e] += row[e] || 0; }); });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    if (d.length >= 2) {
      const last = d[d.length - 1];
      const prev = d[d.length - 2];
      let maxGrowth = { emotion: sorted[0]?.[0] || '—', delta: 0 };
      let maxDecline = { emotion: '—', delta: 0 };
      EMOTION_KEYS.forEach((e) => {
        const delta = (last[e] || 0) - (prev[e] || 0);
        if (delta > maxGrowth.delta) maxGrowth = { emotion: e, delta };
        if (delta < maxDecline.delta) maxDecline = { emotion: e, delta };
      });
      return { rising: maxGrowth.emotion, falling: maxDecline.emotion, periods: d.length };
    }
    return { rising: sorted[0]?.[0] || '—', falling: '—', periods: d.length };
  }, [visibleData]);

  if (loading || !allData) {
    return (
      <div className="w-full">
        <Header title="Evolución Temporal" subtitle="Tendencias emocionales en el tiempo" />
        <TimelineSkeleton />
      </div>
    );
  }

  if (allData.length === 0 && topics.length === 0) {
    return (
      <div className="w-full">
        <Header title="Evolución Temporal" subtitle="Tendencias emocionales en el tiempo" />
        <EmptyState
          icon={Clock}
          title="Sin datos temporales"
          message="Los datos de evolución temporal aparecerán cuando haya predicciones a lo largo del tiempo."
        />
      </div>
    );
  }

  const granLabel = granularity === 'month' ? 'Periodos' : 'Semanas';

  return (
    <div className="w-full">
      <Header title="Evolución Temporal" subtitle="Tendencias emocionales en el tiempo" />
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">

        {/* ── Filter bar ──────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4">

          {/* Granularity toggle */}
          <div className="flex items-center rounded-xl border border-subtle overflow-hidden">
            <button
              onClick={() => setGranularity('week')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all ${
                granularity === 'week'
                  ? 'bg-accent-cyan/15 text-accent-cyan'
                  : 'text-[#6b6b80] hover:text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Semanal
            </button>
            <div className="w-px h-5 bg-subtle" />
            <button
              onClick={() => setGranularity('month')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all ${
                granularity === 'month'
                  ? 'bg-accent-cyan/15 text-accent-cyan'
                  : 'text-[#6b6b80] hover:text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Mensual
            </button>
          </div>

          {/* Apple-style period navigator */}
          <div className="flex items-center gap-1 rounded-xl border border-subtle overflow-hidden">
            <button
              onClick={goPrev}
              disabled={isShowingAll && periods.length === 0}
              className="p-2 text-[#6b6b80] hover:text-[#f0f0f5] hover:bg-[rgba(255,255,255,0.04)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={showAll}
              className={`px-4 py-2 text-xs font-semibold min-w-[180px] text-center transition-all ${
                isShowingAll ? 'text-accent-cyan' : 'text-[#f0f0f5] hover:text-accent-cyan'
              }`}
            >
              {periodLabel}
            </button>
            <button
              onClick={goNext}
              disabled={isShowingAll || !canGoNext}
              className="p-2 text-[#6b6b80] hover:text-[#f0f0f5] hover:bg-[rgba(255,255,255,0.04)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Topic filter — searchable with random */}
          <div className="ml-auto">
            <TopicSelector
              topics={topics}
              selected={selectedTopic || ''}
              onSelect={(nombre) => setSelectedTopic(nombre)}
            />
          </div>
        </div>

        {/* Active filter badge */}
        {selectedTopic && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4a4a5e] font-medium">Tema:</span>
            <button
              onClick={() => setSelectedTopic(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 transition-all"
            >
              {EMOTIONS[topics.find((t) => t.nombre === selectedTopic)?.emocionDominante]?.emoji} {selectedTopic}
              <span className="ml-1 text-[10px]">✕</span>
            </button>
          </div>
        )}

        {/* ── KPIs ────────────────────────────────────── */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Emoción en Alza"
              value={kpis.rising}
              subtext="Mayor crecimiento reciente"
              icon={TrendingUp}
              color={EMOTIONS[kpis.rising]?.color || '#34D399'}
              animate={false}
            />
            <KpiCard
              title="Emoción en Baja"
              value={kpis.falling}
              subtext="Mayor caída reciente"
              icon={TrendingDown}
              color={EMOTIONS[kpis.falling]?.color || '#F87171'}
              animate={false}
              delay={0.1}
            />
            <KpiCard
              title={`${granLabel} Visibles`}
              value={kpis.periods}
              subtext={isShowingAll ? 'Mostrando todo el rango' : `Ventana alrededor de ${periodLabel}`}
              icon={Calendar}
              color="#06b6d4"
              delay={0.2}
            />
          </div>
        )}

        {/* ── Chart ───────────────────────────────────── */}
        {visibleData.length > 0 ? (
          <StackedAreaTimeline
            data={visibleData}
            granularity={granularity}
            subtitle={
              selectedTopic
                ? `Tema: ${selectedTopic}${!isShowingAll ? ` · ${periodLabel}` : ''}`
                : !isShowingAll ? periodLabel : undefined
            }
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="Sin datos para este filtro"
            message="No hay predicciones que coincidan con el tema y periodo seleccionado."
          />
        )}
      </div>
    </div>
  );
}
