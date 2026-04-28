"use client";
import { useMemo } from 'react';
import { EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { LayoutGrid } from 'lucide-react';

/**
 * EmotionTreemap — Proportional distribution of predicted emotions.
 * Uses a pure CSS grid approach instead of Recharts Treemap to avoid
 * re-render flicker when sidebar opens/closes.
 *
 * Props:
 *   data — Array of { emotion, total, porcentaje, confianzaPromedio }
 */
export default function EmotionTreemap({ data }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.total - a.total), [data]);
  const maxTotal = useMemo(() => Math.max(...sorted.map((d) => d.total), 1), [sorted]);

  return (
    <GlassCard>
      <SectionHeader
        icon={LayoutGrid}
        title="Distribución de Predicciones"
        subtitle="Proporción de cada emoción en las predicciones acumuladas"
      />
      <div className="mt-4 grid grid-cols-3 gap-2" style={{ gridAutoRows: 'minmax(100px, auto)' }}>
        {sorted.map((d, i) => {
          const config = EMOTIONS[d.emotion] || EMOTIONS.Incierto;
          // First 2 items are larger
          const isLarge = i < 2;
          return (
            <div
              key={d.emotion}
              className={`group relative rounded-xl overflow-hidden flex flex-col items-center justify-center p-3 cursor-default transition-transform duration-200 hover:scale-[1.02] ${isLarge ? 'row-span-1' : ''}`}
              style={{
                backgroundColor: `${config.color}18`,
                border: `1px solid ${config.color}30`,
                gridColumn: isLarge ? 'span 1' : undefined,
                minHeight: isLarge ? '130px' : '100px',
              }}
            >
              {/* Glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at center, ${config.color}12 0%, transparent 70%)` }}
              />

              <span className="text-2xl mb-1 relative z-10">{config.emoji}</span>
              <span
                className="text-sm font-bold relative z-10"
                style={{ color: config.color }}
              >
                {d.emotion}
              </span>
              <span className="text-xs text-[rgba(255,255,255,0.5)] relative z-10 mt-0.5">
                {d.porcentaje}%
              </span>
              <span className="text-[10px] text-[rgba(255,255,255,0.3)] relative z-10">
                {d.total.toLocaleString()}
              </span>

              {/* Proportion bar at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(d.total / maxTotal) * 100}%`,
                    backgroundColor: config.color,
                    opacity: 0.5,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
