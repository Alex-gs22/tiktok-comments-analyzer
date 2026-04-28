"use client";
import { useState } from 'react';
import Header from '../../src/components/Header';
import EmotionRadar from '../../src/components/charts/EmotionRadar';
import ConfidenceHeatmap from '../../src/components/charts/ConfidenceHeatmap';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import EmotionBadge from '../../src/components/EmotionBadge';
import { EMOTIONS } from '../../src/lib/emotionConfig';
import { topics, topicEmotionProfiles, confidenceHeatmap } from '../../src/lib/mockData';
import { Table } from 'lucide-react';

export default function ComparativaPage() {
  const allNames = topics.map((t) => t.nombre);
  const [selected, setSelected] = useState(allNames.slice(0, 3));

  const toggle = (name) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length < 3
          ? [...prev, name]
          : prev
    );
  };

  const selectedProfiles = {};
  selected.forEach((name) => {
    if (topicEmotionProfiles[name]) selectedProfiles[name] = topicEmotionProfiles[name];
  });

  return (
    <div className="w-full">
      <Header title="Comparativa" subtitle="Contraste de perfiles emocionales entre temas" />

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* Topic multi-select */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#4a4a5e] font-medium uppercase tracking-wider mr-2">Selecciona hasta 3 temas:</span>
          {allNames.map((name) => {
            const isActive = selected.includes(name);
            const topic = topics.find((t) => t.nombre === name);
            return (
              <button
                key={name}
                onClick={() => toggle(name)}
                disabled={!isActive && selected.length >= 3}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 ${
                  isActive
                    ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan'
                    : 'bg-transparent border-subtle text-[#6b6b80] hover:border-default'
                }`}
              >
                {EMOTIONS[topic?.emocionDominante]?.emoji} {name}
              </button>
            );
          })}
        </div>

        {selected.length >= 2 ? (
          <>
            {/* Radar */}
            <EmotionRadar profiles={selectedProfiles} />

            {/* Heatmap */}
            <ConfidenceHeatmap labels={confidenceHeatmap.labels} data={confidenceHeatmap.data} />

            {/* Summary table */}
            <GlassCard>
              <SectionHeader icon={Table} title="Resumen Comparativo" subtitle="Métricas clave por tema" />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-[#4a4a5e] uppercase tracking-wider border-b border-subtle">
                      <th className="px-4 py-3">Tema</th>
                      <th className="px-4 py-3 text-center">Emoción Dominante</th>
                      <th className="px-4 py-3 text-center">Comentarios</th>
                      <th className="px-4 py-3 text-center">% Inciertos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {selected.map((name) => {
                      const t = topics.find((tp) => tp.nombre === name);
                      return (
                        <tr key={name} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-4 py-3 text-sm text-[#a1a1b5] font-medium">{name}</td>
                          <td className="px-4 py-3 text-center">
                            <EmotionBadge emotion={t?.emocionDominante || 'Incierto'} size="sm" />
                          </td>
                          <td className="px-4 py-3 text-sm text-[#6b6b80] text-center">{t?.totalComentarios?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-[#6b6b80] text-center">{t?.pctInciertos}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </>
        ) : (
          <GlassCard className="text-center py-16">
            <p className="text-[#4a4a5e] text-sm">Selecciona al menos <strong className="text-[#a1a1b5]">2 temas</strong> para ver la comparativa</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
