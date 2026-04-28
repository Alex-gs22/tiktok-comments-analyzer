"use client";
import Header from '../../src/components/Header';
import KpiCard from '../../src/components/KpiCard';
import StackedAreaTimeline from '../../src/components/charts/StackedAreaTimeline';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { timelineData, timelineEvents } from '../../src/lib/mockData';

export default function TimelinePage() {
  return (
    <div className="w-full">
      <Header title="Evolución Temporal" subtitle="Tendencias emocionales en el tiempo" />
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="Emoción en Alza" value="Confianza" subtext="Mayor crecimiento últimas 4 semanas" icon={TrendingUp} color="#34D399" animate={false} />
          <KpiCard title="Emoción en Baja" value="Rechazo" subtext="Mayor caída últimas 4 semanas" icon={TrendingDown} color="#F87171" animate={false} delay={0.1} />
          <KpiCard title="Semanas Analizadas" value={timelineData.length} subtext="Rango temporal del dataset" icon={Calendar} color="#06b6d4" delay={0.2} />
        </div>
        <StackedAreaTimeline data={timelineData} events={timelineEvents} />
      </div>
    </div>
  );
}
