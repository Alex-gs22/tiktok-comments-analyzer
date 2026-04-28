"use client";
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { LayoutGrid } from 'lucide-react';

/**
 * EmotionTreemap — Proportional distribution of predicted emotions.
 *
 * Props:
 *   data — Array of { emotion, total, porcentaje, confianzaPromedio }
 */

const CustomContent = ({ x, y, width, height, emotion, porcentaje }) => {
  const config = EMOTIONS[emotion] || EMOTIONS.Incierto;
  if (width < 40 || height < 40) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={config.color}
        fillOpacity={0.2}
        stroke={config.color}
        strokeWidth={1}
        strokeOpacity={0.3}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 12}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xl"
        fill={config.color}
      >
        {config.emoji}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 8}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={width > 80 ? 13 : 11}
        fontWeight={600}
        fill={config.color}
      >
        {emotion}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 24}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fill="rgba(255,255,255,0.5)"
      >
        {porcentaje}%
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const config = EMOTIONS[d.emotion] || EMOTIONS.Incierto;

  return (
    <div className="bg-elevated border border-subtle rounded-xl px-4 py-3 shadow-lg">
      <p className="font-bold text-[#f0f0f5] flex items-center gap-2">
        <span>{config.emoji}</span> {d.emotion}
      </p>
      <p className="text-sm text-[#a1a1b5]">{d.total.toLocaleString()} comentarios ({d.porcentaje}%)</p>
      <p className="text-xs text-[#6b6b80] mt-1">Confianza promedio: {(d.confianzaPromedio * 100).toFixed(1)}%</p>
    </div>
  );
};

export default function EmotionTreemap({ data }) {
  const treemapData = data.map((d) => ({
    ...d,
    name: d.emotion,
    size: d.total,
  }));

  return (
    <GlassCard>
      <SectionHeader
        icon={LayoutGrid}
        title="Distribución de Predicciones"
        subtitle="Proporción de cada emoción en las predicciones acumuladas"
      />
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          <Treemap
            data={treemapData}
            dataKey="size"
            content={<CustomContent />}
            animationDuration={800}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
