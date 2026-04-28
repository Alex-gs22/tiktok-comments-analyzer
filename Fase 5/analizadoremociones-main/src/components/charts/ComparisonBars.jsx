"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { BarChart3 } from 'lucide-react';

/**
 * ComparisonBars — Horizontal bars comparing topic vs global profiles.
 *
 * Props:
 *   topicProfile  — { Alegría: 34.2, Confianza: 28.1, ... }
 *   globalProfile — { Alegría: 9.7, Confianza: 21.2, ... }
 *   topicName     — Name of the selected topic
 */

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const topic = payload.find(p => p.dataKey === 'topic');
  const global = payload.find(p => p.dataKey === 'global');
  const delta = (topic?.value || 0) - (global?.value || 0);

  return (
    <div className="bg-elevated border border-subtle rounded-xl px-4 py-3 shadow-lg">
      <p className="font-bold text-[#f0f0f5] mb-1">{label}</p>
      <p className="text-sm text-[#a1a1b5]">Tema: {topic?.value}%</p>
      <p className="text-sm text-[#a1a1b5]">Global: {global?.value}%</p>
      <p className={`text-sm font-semibold mt-1 ${delta > 0 ? 'text-em-rechazo' : 'text-em-confianza'}`}>
        Δ {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
      </p>
    </div>
  );
};

export default function ComparisonBars({ topicProfile, globalProfile, topicName }) {
  const data = Object.keys(topicProfile).map((emotion) => ({
    emotion,
    topic: topicProfile[emotion],
    global: globalProfile[emotion],
    delta: (topicProfile[emotion] - globalProfile[emotion]).toFixed(1),
  })).sort((a, b) => b.topic - a.topic);

  return (
    <GlassCard>
      <SectionHeader
        icon={BarChart3}
        title={`${topicName} vs Promedio Global`}
        subtitle="Distribución emocional comparada (% de comentarios)"
      />

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} layout="vertical" margin={{ left: 10 }} barCategoryGap="18%">
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#6b6b80' }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="emotion"
              tick={{ fontSize: 12, fill: '#a1a1b5' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#6b6b80' }}
              formatter={(value) => (value === 'topic' ? topicName : 'Promedio Global')}
            />
            <Bar dataKey="global" fill="rgba(255,255,255,0.08)" radius={[0, 6, 6, 0]} maxBarSize={16} name="global" />
            <Bar dataKey="topic" radius={[0, 6, 6, 0]} maxBarSize={16} name="topic">
              {data.map((entry) => (
                <Cell key={entry.emotion} fill={EMOTIONS[entry.emotion]?.color || '#888'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Delta table */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.map((d) => {
          const isPositive = parseFloat(d.delta) > 0;
          return (
            <div key={d.emotion} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EMOTIONS[d.emotion]?.color }} />
              <span className="text-[#a1a1b5]">{d.emotion}</span>
              <span className={`font-bold ${isPositive ? 'text-em-rechazo' : 'text-em-confianza'}`}>
                {isPositive ? '+' : ''}{d.delta}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
