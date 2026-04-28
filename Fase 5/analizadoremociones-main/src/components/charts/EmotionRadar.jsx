"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { EMOTION_KEYS, EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Target } from 'lucide-react';

/**
 * EmotionRadar — Radar chart comparing 2-3 topic emotion profiles.
 *
 * Props:
 *   profiles — { "Topic Name": { Alegría: 34.2, ... }, ... }
 */

const PROFILE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b'];

export default function EmotionRadar({ profiles }) {
  const profileNames = Object.keys(profiles);

  const data = EMOTION_KEYS.map((emotion) => {
    const entry = { emotion: `${EMOTIONS[emotion].emoji} ${emotion}` };
    profileNames.forEach((name) => {
      entry[name] = profiles[name][emotion] || 0;
    });
    return entry;
  });

  return (
    <GlassCard>
      <SectionHeader
        icon={Target}
        title="Perfil Emocional Comparado"
        subtitle="Radar superpuesto — forma del perfil por tema"
      />
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis
              dataKey="emotion"
              tick={{ fontSize: 11, fill: '#a1a1b5' }}
            />
            <PolarRadiusAxis
              angle={30}
              tick={{ fontSize: 10, fill: '#4a4a5e' }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
            />
            {profileNames.map((name, i) => (
              <Radar
                key={name}
                name={name}
                dataKey={name}
                stroke={PROFILE_COLORS[i]}
                fill={PROFILE_COLORS[i]}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#a1a1b5', paddingTop: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#22223a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#f0f0f5',
              }}
              itemStyle={{ color: '#a1a1b5', fontSize: 12 }}
              labelStyle={{ color: '#f0f0f5', fontWeight: 600, fontSize: 13 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
