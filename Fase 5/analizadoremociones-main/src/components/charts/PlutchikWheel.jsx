"use client";
import { useEffect, useRef } from 'react';
import { EMOTION_KEYS, EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Flower2 } from 'lucide-react';

/**
 * PlutchikWheel — Interactive Plutchik wheel mapped to 6 model classes.
 * Uses Canvas for rendering. Hover to see details.
 *
 * Props:
 *   data — { Alegría: { porcentaje, total }, ... }
 */

const PETAL_ANGLES = {
  Alegría:     0,
  Confianza:   60,
  Miedo:       120,
  Expectación: 180,
  Tristeza:    240,
  Rechazo:     300,
};

export default function PlutchikWheel({ data }) {
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 380;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxR = 150;
    const minR = 50;

    // Find max for normalization
    const maxPct = Math.max(...EMOTION_KEYS.map(k => data[k]?.porcentaje || 0), 1);

    ctx.clearRect(0, 0, size, size);

    // Draw subtle rings
    [0.33, 0.66, 1.0].forEach((ringPct) => {
      ctx.beginPath();
      ctx.arc(cx, cy, minR + (maxR - minR) * ringPct, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw petals
    const petalSweep = (2 * Math.PI) / EMOTION_KEYS.length;
    
    EMOTION_KEYS.forEach((emotion) => {
      const config = EMOTIONS[emotion];
      const angle = (PETAL_ANGLES[emotion] * Math.PI) / 180 - Math.PI / 2;
      const pct = data[emotion]?.porcentaje || 0;
      const normR = minR + ((pct / maxPct) * (maxR - minR));

      // Petal shape (pie segment)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, normR, angle - petalSweep / 2, angle + petalSweep / 2);
      ctx.closePath();

      // Gradient fill
      const grad = ctx.createRadialGradient(cx, cy, minR * 0.3, cx, cy, normR);
      grad.addColorStop(0, config.color + '10');
      grad.addColorStop(1, config.color + '40');
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = config.color + '60';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      const labelR = normR + 18;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = config.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${config.emoji} ${pct}%`, lx, ly);
    });

    // Center label
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillStyle = '#f0f0f5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('6 Emociones', cx, cy - 6);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#6b6b80';
    ctx.fillText('Modelo v3_pseudo', cx, cy + 10);

  }, [data]);

  return (
    <GlassCard>
      <SectionHeader
        icon={Flower2}
        title="Rueda de Plutchik"
        subtitle="6 emociones del modelo mapeadas al modelo teórico"
      />
      <div className="flex justify-center mt-4 relative">
        <canvas ref={canvasRef} />
        <div ref={tooltipRef} />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {EMOTION_KEYS.map((emotion) => {
          const config = EMOTIONS[emotion];
          const d = data[emotion] || {};
          return (
            <div key={emotion} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
              <span className="text-[#a1a1b5]">{emotion}</span>
              <span className="ml-auto font-bold text-[#f0f0f5]">{d.total || 0}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
