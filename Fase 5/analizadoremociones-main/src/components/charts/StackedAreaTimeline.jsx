"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { EMOTION_KEYS, EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { TrendingUp } from 'lucide-react';

/**
 * StackedAreaTimeline — Stacked area chart showing emotion evolution over time.
 *
 * Props:
 *   data   — Array of { semana: '2026-03-02', Alegría: 18, ... }
 *   events — Array of { semana: string, label: string }
 */

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-elevated border border-subtle rounded-xl px-4 py-3 shadow-lg min-w-[180px]">
      <p className="font-bold text-[#f0f0f5] mb-2 text-sm">{label}</p>
      {payload.reverse().map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1.5 text-[#a1a1b5]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.stroke }} />
            {p.dataKey}
          </span>
          <span className="font-semibold text-[#f0f0f5]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function StackedAreaTimeline({ data, events = [] }) {
  return (
    <GlassCard>
      <SectionHeader
        icon={TrendingUp}
        title="Evolución Temporal de Emociones"
        subtitle="Predicciones acumuladas por semana"
      />

      {/* Event markers */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 mb-2 ml-7">
          {events.map((ev) => (
            <span key={ev.semana} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.04)] text-[#6b6b80] border border-subtle">
              📍 {ev.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="semana"
              tick={{ fontSize: 10, fill: '#4a4a5e' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.slice(5)} // MM-DD
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#4a4a5e' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {EMOTION_KEYS.map((emotion) => (
              <Area
                key={emotion}
                type="monotone"
                dataKey={emotion}
                stackId="1"
                stroke={EMOTIONS[emotion].color}
                fill={EMOTIONS[emotion].color}
                fillOpacity={0.3}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
