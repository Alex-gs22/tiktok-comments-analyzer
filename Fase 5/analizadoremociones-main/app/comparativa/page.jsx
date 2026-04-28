"use client";
import { useState, useEffect, useCallback } from 'react';
import Header from '../../src/components/Header';
import EmotionRadar, { PROFILE_COLORS } from '../../src/components/charts/EmotionRadar';
import ConfidenceHeatmap from '../../src/components/charts/ConfidenceHeatmap';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import EmotionBadge from '../../src/components/EmotionBadge';
import TopicSelector from '../../src/components/features/TopicSelector';
import { ComparativaSkeleton, EmptyState } from '../../src/components/StateScreens';
import { getTopics, getTopicEmotionProfile, getConfidenceHeatmap } from '../../src/lib/dataService';
import { Table, GitCompareArrows, X } from 'lucide-react';
import { useDataRefresh } from '../../src/lib/useDataRefresh';

export default function ComparativaPage() {
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const [tData, hData] = await Promise.all([getTopics(), getConfidenceHeatmap()]);
    setTopics(tData);
    setHeatmap(hData);
    const defaultSelected = tData.slice(0, Math.min(3, tData.length)).map((tp) => tp.nombre);
    setSelected(defaultSelected);
    setLoading(false);
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Auto-refresh when new data is inserted
  useDataRefresh(loadInitial);

  useEffect(() => {
    if (selected.length === 0) { setProfiles({}); return; }
    (async () => {
      const p = {};
      for (const name of selected) {
        p[name] = await getTopicEmotionProfile(name);
      }
      setProfiles(p);
    })();
  }, [selected]);

  const addTopic = (nombre) => {
    if (selected.length >= 3 || selected.includes(nombre)) return;
    setSelected((prev) => [...prev, nombre]);
  };

  const removeTopic = (nombre) => {
    setSelected((prev) => prev.filter((n) => n !== nombre));
  };

  if (loading) {
    return (
      <div className="w-full">
        <Header title="Comparativa" subtitle="Contraste de perfiles emocionales entre temas" />
        <ComparativaSkeleton />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="w-full">
        <Header title="Comparativa" subtitle="Contraste de perfiles emocionales entre temas" />
        <EmptyState
          icon={GitCompareArrows}
          title="Sin temas para comparar"
          message="Analiza comentarios de un video de TikTok desde la sección 'Analizar Video' para generar datos de temas."
        />
      </div>
    );
  }

  // Available topics to add (not already selected)
  const availableTopics = topics.filter((t) => !selected.includes(t.nombre));

  return (
    <div className="w-full">
      <Header title="Comparativa" subtitle="Contraste de perfiles emocionales entre temas">
        {/* Topic search in header — same as Temas page */}
        {selected.length < 3 && (
          <TopicSelector
            topics={availableTopics}
            selected=""
            onSelect={addTopic}
          />
        )}
      </Header>

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* Selected topics chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#4a4a5e] font-medium uppercase tracking-wider mr-1">Comparando:</span>

          {selected.map((name, i) => {
            const color = PROFILE_COLORS[i] || PROFILE_COLORS[0];
            return (
              <span
                key={name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                style={{
                  backgroundColor: `${color}15`,
                  borderColor: `${color}50`,
                  color: color,
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {name}
                <button onClick={() => removeTopic(name)} className="hover:text-white transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          <span className="text-[10px] text-[#4a4a5e] ml-auto">{selected.length}/3</span>
        </div>

        {selected.length >= 2 && Object.keys(profiles).length >= 2 ? (
          <>
            <EmotionRadar profiles={profiles} />
            {heatmap && heatmap.data?.length > 0 && <ConfidenceHeatmap labels={heatmap.labels} data={heatmap.data} />}
            <GlassCard>
              <SectionHeader icon={Table} title="Resumen Comparativo" subtitle="Métricas clave por tema" />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-[#4a4a5e] uppercase tracking-wider border-b border-subtle">
                      <th className="px-4 py-3">Tema</th>
                      <th className="px-4 py-3 text-center">Emoción Dominante</th>
                      <th className="px-4 py-3 text-center">Comentarios</th>
                      <th className="px-4 py-3 text-center">Confianza Prom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {selected.map((name, i) => {
                      const t = topics.find((tp) => tp.nombre === name);
                      const color = PROFILE_COLORS[i] || PROFILE_COLORS[0];
                      return (
                        <tr key={name} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-4 py-3 text-sm text-[#a1a1b5] font-medium">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              {name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center"><EmotionBadge emotion={t?.emocionDominante || 'Incierto'} size="sm" /></td>
                          <td className="px-4 py-3 text-sm text-[#6b6b80] text-center">{t?.totalComentarios?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-[#6b6b80] text-center">{t?.confianzaPromedio ? `${(t.confianzaPromedio * 100).toFixed(1)}%` : '—'}</td>
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
            <p className="text-[#4a4a5e] text-sm">
              {selected.length === 0
                ? 'Usa el buscador del header para agregar temas'
                : <>Selecciona al menos <strong className="text-[#a1a1b5]">2 temas</strong> para ver la comparativa</>
              }
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
