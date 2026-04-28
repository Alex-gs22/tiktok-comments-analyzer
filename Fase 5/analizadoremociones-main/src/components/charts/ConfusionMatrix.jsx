"use client";
import { EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Table } from 'lucide-react';

/**
 * ConfusionMatrix — 6×6 confusion matrix heatmap for model evaluation.
 *
 * Props:
 *   labels — Array of class names (6)
 *   data   — 2D array [6][6] of counts (rows = true, cols = predicted)
 */

function getCellColor(value, maxVal) {
  const norm = value / maxVal;
  if (norm > 0.7) return { bg: 'rgba(6,182,212,0.4)', text: '#f0f0f5' };
  if (norm > 0.4) return { bg: 'rgba(6,182,212,0.2)', text: '#f0f0f5' };
  if (norm > 0.15) return { bg: 'rgba(6,182,212,0.08)', text: '#a1a1b5' };
  if (value > 0) return { bg: 'rgba(255,255,255,0.03)', text: '#6b6b80' };
  return { bg: 'transparent', text: '#4a4a5e' };
}

export default function ConfusionMatrix({ labels, data }) {
  const maxVal = Math.max(...data.flat());

  return (
    <GlassCard>
      <SectionHeader
        icon={Table}
        title="Matriz de Confusión"
        subtitle="Filas = emoción real · Columnas = predicción del modelo"
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-2 text-[10px] text-[#4a4a5e] font-medium text-right">
                Real ↓ · Pred →
              </th>
              {labels.map((l) => (
                <th key={l} className="px-2 py-2 text-[10px] text-[#6b6b80] font-semibold text-center">
                  {EMOTIONS[l]?.emoji}<br/>{l.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, ri) => (
              <tr key={rowLabel}>
                <td className="px-2 py-1 text-xs text-[#a1a1b5] font-medium text-right whitespace-nowrap">
                  {EMOTIONS[rowLabel]?.emoji} {rowLabel}
                </td>
                {data[ri].map((val, ci) => {
                  const isDiagonal = ri === ci;
                  const { bg, text } = getCellColor(val, maxVal);
                  return (
                    <td key={ci} className="px-1 py-1">
                      <div
                        className={`w-full h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-transform hover:scale-105 ${isDiagonal ? 'ring-1 ring-accent-cyan/30' : ''}`}
                        style={{ backgroundColor: isDiagonal ? `${EMOTIONS[rowLabel]?.color}25` : bg, color: isDiagonal ? EMOTIONS[rowLabel]?.color : text }}
                      >
                        {val}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[10px] text-[#4a4a5e] mt-3 text-right">
          Diagonal resaltada = predicciones correctas · Modelo v3_pseudo
        </p>
      </div>
    </GlassCard>
  );
}
