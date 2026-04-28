"use client";
import Header from '../../src/components/Header';
import KpiCard from '../../src/components/KpiCard';
import ConfusionMatrix from '../../src/components/charts/ConfusionMatrix';
import GlassCard from '../../src/components/GlassCard';
import SectionHeader from '../../src/components/SectionHeader';
import { MODEL_INFO, MODEL_METRICS_PER_CLASS, CONFUSION_MATRIX, EMOTIONS, EMOTION_KEYS } from '../../src/lib/emotionConfig';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Brain, Target, Database, Layers, ExternalLink, BarChart3 } from 'lucide-react';

const f1Data = EMOTION_KEYS.map((e) => ({
  emotion: e,
  f1: MODEL_METRICS_PER_CLASS[e]?.f1 || 0,
  precision: MODEL_METRICS_PER_CLASS[e]?.precision || 0,
  recall: MODEL_METRICS_PER_CLASS[e]?.recall || 0,
  color: EMOTIONS[e]?.color || '#888',
})).sort((a, b) => b.f1 - a.f1);

export default function ModeloPage() {
  return (
    <div className="w-full">
      <Header title="Rendimiento del Modelo" subtitle="Transparencia ML — métricas y evaluación" />
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Macro F1" value={MODEL_INFO.macroF1} decimals={3} icon={Target} color="#06b6d4" />
          <KpiCard title="Accuracy" value={MODEL_INFO.accuracy} decimals={3} icon={Brain} color="#8b5cf6" delay={0.1} />
          <KpiCard title="Datos Entrenamiento" value={MODEL_INFO.trainingData} icon={Database} color="#34D399" delay={0.2} />
          <KpiCard title="Clases" value={MODEL_INFO.classes} subtext="+ Incierto por umbral" icon={Layers} color="#FBBF24" delay={0.3} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Confusion Matrix */}
          <ConfusionMatrix labels={CONFUSION_MATRIX.labels} data={CONFUSION_MATRIX.data} />

          {/* F1 per class */}
          <GlassCard>
            <SectionHeader icon={BarChart3} title="F1 Score por Emoción" subtitle="Rendimiento individual del modelo por clase" />
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={f1Data} layout="vertical" margin={{ left: 5 }}>
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#4a4a5e' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="emotion" tick={{ fontSize: 11, fill: '#a1a1b5' }} axisLine={false} tickLine={false} width={85} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#22223a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f0f0f5' }}
                    formatter={(v) => [(v).toFixed(3)]}
                  />
                  <Bar dataKey="f1" radius={[0, 6, 6, 0]} maxBarSize={18}>
                    {f1Data.map((e) => <Cell key={e.emotion} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detail table */}
            <div className="mt-4 space-y-2">
              {f1Data.map((e) => (
                <div key={e.emotion} className="grid grid-cols-4 text-[10px] items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[#a1a1b5]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                    {e.emotion}
                  </span>
                  <span className="text-center text-[#6b6b80]">F1: <strong className="text-[#f0f0f5]">{e.f1.toFixed(3)}</strong></span>
                  <span className="text-center text-[#6b6b80]">P: {e.precision.toFixed(3)}</span>
                  <span className="text-center text-[#6b6b80]">R: {e.recall.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Model info card */}
        <GlassCard>
          <SectionHeader icon={Brain} title="Información del Modelo" subtitle="Arquitectura y enlaces" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 text-xs">
              {[
                ['Modelo', MODEL_INFO.name],
                ['Base', MODEL_INFO.base],
                ['Arquitectura', MODEL_INFO.architecture],
                ['Manual Labels', `${MODEL_INFO.manualLabels.toLocaleString()} comentarios`],
                ['Pseudo Labels', `${MODEL_INFO.pseudoLabels.toLocaleString()} comentarios`],
                ['Umbral Incertidumbre', `< ${MODEL_INFO.uncertaintyThreshold * 100}% confianza`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-subtle">
                  <span className="text-[#6b6b80]">{label}</span>
                  <span className="text-[#a1a1b5] font-mono text-[11px]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <a href={MODEL_INFO.hfModelUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-subtle hover:border-default text-sm text-[#a1a1b5] hover:text-[#f0f0f5] transition-all">
                🤗 Ver modelo en Hugging Face <ExternalLink className="w-3.5 h-3.5 ml-auto" />
              </a>
              <a href={MODEL_INFO.hfSpaceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl border border-subtle hover:border-default text-sm text-[#a1a1b5] hover:text-[#f0f0f5] transition-all">
                🚀 API en HF Spaces <ExternalLink className="w-3.5 h-3.5 ml-auto" />
              </a>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
