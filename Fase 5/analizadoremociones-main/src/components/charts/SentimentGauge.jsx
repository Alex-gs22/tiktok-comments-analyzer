"use client";
import { useEffect, useRef } from 'react';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Gauge } from 'lucide-react';
import { SENTIMENT_COLORS } from '../../lib/emotionConfig';

/**
 * SentimentGauge — Semicircular gauge for aggregated sentiment.
 *
 * Props:
 *   data — { Positivo: { total, porcentaje }, Negativo: { ... }, Neutro: { ... } }
 */
export default function SentimentGauge({ data }) {
  const canvasRef = useRef(null);

  const positive = data.Positivo?.porcentaje || 0;
  const negative = data.Negativo?.porcentaje || 0;
  const neutral  = data.Neutro?.porcentaje || 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = 280;
    const h = 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h - 10;
    const r = 100;
    const lineWidth = 20;
    const startAngle = Math.PI;

    ctx.clearRect(0, 0, w, h);

    // Draw segments
    const segments = [
      { pct: negative, color: SENTIMENT_COLORS.Negativo },
      { pct: neutral,  color: SENTIMENT_COLORS.Neutro },
      { pct: positive, color: SENTIMENT_COLORS.Positivo },
    ];

    let angle = startAngle;
    segments.forEach((seg) => {
      const sweep = (seg.pct / 100) * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
      angle += sweep;
    });

    // Needle — points to the sentiment "score"
    // Score: 0 = full negative, 50 = neutral, 100 = full positive
    const score = positive + (neutral / 2);
    const needleAngle = startAngle + (score / 100) * Math.PI;
    const needleLen = r - 30;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(needleAngle) * needleLen,
      cy + Math.sin(needleAngle) * needleLen
    );
    ctx.strokeStyle = '#f0f0f5';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0f5';
    ctx.fill();
  }, [positive, negative, neutral]);

  return (
    <GlassCard>
      <SectionHeader
        icon={Gauge}
        title="Sentimiento Agregado"
        subtitle="Positivo · Neutro · Negativo"
      />
      <div className="flex flex-col items-center mt-4">
        <canvas ref={canvasRef} />
        <div className="flex items-center gap-6 mt-4">
          {[
            { label: 'Positivo', value: positive, color: SENTIMENT_COLORS.Positivo },
            { label: 'Neutro',   value: neutral,  color: SENTIMENT_COLORS.Neutro },
            { label: 'Negativo', value: negative,  color: SENTIMENT_COLORS.Negativo },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-[#6b6b80]">{s.label}</span>
              <span className="text-sm font-bold text-[#f0f0f5]">{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
