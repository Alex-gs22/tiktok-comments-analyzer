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
 *   data        — Array of { periodo: '2026-03-02', Alegría: 18, ... }
 *                 (also supports legacy { semana: ... })
 *   events      — Array of { semana: string, label: string }
 *   granularity — 'week' | 'month' (for label formatting)
 *   subtitle    — Custom subtitle text
 */

/** Safely parse a date string that may be YYYY-MM or YYYY-MM-DD */
function safeDate(str) {
  // If it's YYYY-MM (7 chars), append -01
  if (str && str.length === 7) return new Date(str + '-01');
  return new Date(str);
}

const CustomTooltip = ({ active, payload, label, granularity }) => {
  if (!active || !payload?.length) return null;

  const formatLabel = (l) => {
    if (granularity === 'month') {
      const d = safeDate(l);
      return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
    }
    const d = safeDate(l);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <div className="bg-elevated border border-subtle rounded-xl px-4 py-3 shadow-lg min-w-[200px]">
      <p className="font-bold text-[#f0f0f5] mb-1 text-sm">{formatLabel(label)}</p>
      <p className="text-[10px] text-[#4a4a5e] mb-2">{total} comentarios</p>
      {[...payload].reverse().map((p) => (
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

export default function StackedAreaTimeline({ data, events = [], granularity = 'week', subtitle }) {
  // Support both 'periodo' and legacy 'semana' key
  const dataKey = data?.[0]?.periodo !== undefined ? 'periodo' : 'semana';

  const formatTick = (v) => {
    if (granularity === 'month') {
      const d = safeDate(v);
      const month = d.toLocaleDateString('es-MX', { month: 'short' });
      const year = d.getFullYear().toString().slice(2);
      return `${month} '${year}`;
    }
    // YYYY-MM-DD → MM-DD
    return v.slice(5);
  };

  const defaultSubtitle = granularity === 'month'
    ? 'Predicciones acumuladas por mes'
    : 'Predicciones acumuladas por semana';

  return (
    <GlassCard>
      <SectionHeader
        icon={TrendingUp}
        title="Evolución Temporal de Emociones"
        subtitle={subtitle || defaultSubtitle}
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
              dataKey={dataKey}
              tick={{ fontSize: 10, fill: '#4a4a5e' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatTick}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#4a4a5e' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip granularity={granularity} />} />
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
