"use client";
import { EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Grid3X3 } from 'lucide-react';

/**
 * ConfidenceHeatmap — Heatmap showing model confidence per topic × emotion.
 *
 * Props:
 *   labels — { rows: string[], cols: string[] }
 *   data   — number[][] (rows × cols, values 0.0 - 1.0)
 */

function getHeatColor(value) {
  // 0.0 → dark, 1.0 → bright cyan
  const intensity = Math.max(0, Math.min(1, value));
  const r = Math.round(10 + intensity * 0);
  const g = Math.round(10 + intensity * 180);
  const b = Math.round(15 + intensity * 210);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ConfidenceHeatmap({ labels, data }) {
  return (
    <GlassCard>
      <SectionHeader
        icon={Grid3X3}
        title="Mapa de Confianza"
        subtitle="Confianza promedio del modelo por tema × emoción"
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs text-[#4a4a5e] font-medium" />
              {labels.cols.map((col) => (
                <th key={col} className="px-3 py-2 text-center text-[10px] text-[#6b6b80] font-semibold uppercase tracking-wider">
                  <span className="mr-1">{EMOTIONS[col]?.emoji}</span>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.rows.map((row, ri) => (
              <tr key={row}>
                <td className="px-3 py-2 text-xs text-[#a1a1b5] font-medium whitespace-nowrap">
                  {row}
                </td>
                {data[ri].map((val, ci) => (
                  <td key={ci} className="px-1 py-1">
                    <div
                      className="rounded-lg h-10 flex items-center justify-center text-xs font-bold transition-transform hover:scale-105"
                      style={{
                        backgroundColor: getHeatColor(val),
                        color: '#f0f0f5',
                        textShadow: val < 0.5 ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                      }}
                    >
                      {(val * 100).toFixed(0)}%
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 justify-end">
          <span className="text-[10px] text-[#4a4a5e]">Baja confianza</span>
          <div className="flex h-2 rounded-full overflow-hidden w-24">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div key={v} className="flex-1" style={{ backgroundColor: getHeatColor(v) }} />
            ))}
          </div>
          <span className="text-[10px] text-[#4a4a5e]">Alta confianza</span>
        </div>
      </div>
    </GlassCard>
  );
}
