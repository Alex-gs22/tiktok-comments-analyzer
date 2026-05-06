"use client";
import { useState, useMemo } from 'react';
import { EMOTION_KEYS, EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Flower2 } from 'lucide-react';

/**
 * PlutchikWheel — Interactive Plutchik wheel mapped to 6 model classes.
 * Responsive SVG, fixed-radius labels, center tooltip.
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

const SIZE    = 400;
const CX      = SIZE / 2;
const CY      = SIZE / 2;
const MAX_R   = 150;
const MIN_R   = 52;
const LABEL_R = 178; // fixed outer label radius

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function petalPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end   = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    `Z`,
  ].join(' ');
}

export default function PlutchikWheel({ data }) {
  const [hovered, setHovered] = useState(null);

  const maxPct = useMemo(
    () => Math.max(...EMOTION_KEYS.map((k) => data[k]?.porcentaje || 0), 1),
    [data]
  );

  const petals = useMemo(() => {
    const petalSweep = 360 / EMOTION_KEYS.length;
    return EMOTION_KEYS.map((emotion) => {
      const config      = EMOTIONS[emotion];
      const pct         = data[emotion]?.porcentaje || 0;
      const total       = data[emotion]?.total || 0;
      const normR       = MIN_R + (pct / maxPct) * (MAX_R - MIN_R);
      const centerAngle = PETAL_ANGLES[emotion];
      const startAngle  = centerAngle - petalSweep / 2;
      const endAngle    = centerAngle + petalSweep / 2;
      const path        = petalPath(CX, CY, normR, startAngle, endAngle);
      const labelPos    = polarToCartesian(CX, CY, LABEL_R, centerAngle);
      const dividerEnd  = polarToCartesian(CX, CY, MAX_R + 8, centerAngle - petalSweep / 2);
      return { emotion, config, pct, total, normR, centerAngle, startAngle, endAngle, path, labelPos, dividerEnd };
    });
  }, [data, maxPct]);

  const rings = [0.25, 0.5, 0.75, 1.0].map((f) => MIN_R + (MAX_R - MIN_R) * f);

  const hoveredPetal = hovered ? petals.find((p) => p.emotion === hovered) : null;

  return (
    <GlassCard>
      <SectionHeader
        icon={Flower2}
        title="Rueda de Plutchik"
        subtitle="6 emociones del modelo mapeadas al modelo teórico"
      />
      <div className="mt-4">
        <svg
          width="100%"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ display: 'block' }}
        >
          <defs>
            {petals.map(({ emotion, config }) => (
              <radialGradient key={`grad-${emotion}`} id={`grad-${emotion}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={config.color} stopOpacity="0.05" />
                <stop offset="100%" stopColor={config.color} stopOpacity="0.28" />
              </radialGradient>
            ))}
            {petals.map(({ emotion, config }) => (
              <radialGradient key={`grad-hover-${emotion}`} id={`grad-hover-${emotion}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={config.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={config.color} stopOpacity="0.55" />
              </radialGradient>
            ))}
            <filter id="petal-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Guide rings */}
          {rings.map((r, i) => (
            <circle key={i} cx={CX} cy={CY} r={r} fill="none"
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray={i < 3 ? '4 4' : 'none'} />
          ))}

          {/* Divider lines between petals */}
          {petals.map(({ emotion, dividerEnd }) => (
            <line key={`div-${emotion}`}
              x1={CX} y1={CY}
              x2={dividerEnd.x} y2={dividerEnd.y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          ))}

          {/* Petals */}
          {petals.map(({ emotion, config, path }) => {
            const isHovered = hovered === emotion;
            return (
              <g
                key={emotion}
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: isHovered ? 'scale(1.07)' : 'scale(1)',
                  filter: isHovered ? 'url(#petal-glow)' : 'none',
                  transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), filter 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(emotion)}
                onMouseLeave={() => setHovered(null)}
              >
                <path
                  d={path}
                  fill={isHovered ? `url(#grad-hover-${emotion})` : `url(#grad-${emotion})`}
                  stroke={config.color}
                  strokeWidth={isHovered ? 2 : 1.5}
                  strokeOpacity={isHovered ? 0.9 : 0.35}
                  style={{ transition: 'all 0.3s ease' }}
                />
              </g>
            );
          })}

          {/* Fixed-radius labels */}
          {petals.map(({ emotion, config, pct, labelPos }) => {
            const isActive = hovered === null || hovered === emotion;
            return (
              <g key={`label-${emotion}`}
                style={{ opacity: isActive ? 1 : 0.25, transition: 'opacity 0.3s ease', pointerEvents: 'none' }}>
                <text
                  x={labelPos.x} y={labelPos.y - 7}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={config.color} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif"
                >
                  {config.emoji}
                </text>
                <text
                  x={labelPos.x} y={labelPos.y + 8}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={config.color} fontSize="9.5" fontWeight="600" fontFamily="Inter, sans-serif"
                >
                  {emotion}
                </text>
                <text
                  x={labelPos.x} y={labelPos.y + 20}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#a1a1b5" fontSize="9" fontFamily="Inter, sans-serif"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Center — default info or hovered emotion detail */}
          {hoveredPetal ? (
            <g style={{ pointerEvents: 'none' }}>
              <circle cx={CX} cy={CY} r={MIN_R - 4} fill="rgba(10,10,20,0.7)" />
              <text x={CX} y={CY - 18} textAnchor="middle" dominantBaseline="middle"
                fill={hoveredPetal.config.color} fontSize="18" fontFamily="Inter, sans-serif">
                {hoveredPetal.config.emoji}
              </text>
              <text x={CX} y={CY - 2} textAnchor="middle" dominantBaseline="middle"
                fill={hoveredPetal.config.color} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">
                {hoveredPetal.emotion}
              </text>
              <text x={CX} y={CY + 14} textAnchor="middle" dominantBaseline="middle"
                fill="#f0f0f5" fontSize="13" fontWeight="800" fontFamily="Inter, sans-serif">
                {hoveredPetal.pct}%
              </text>
              <text x={CX} y={CY + 27} textAnchor="middle" dominantBaseline="middle"
                fill="#6b6b80" fontSize="8.5" fontFamily="Inter, sans-serif">
                {hoveredPetal.total} coment.
              </text>
            </g>
          ) : (
            <g style={{ pointerEvents: 'none' }}>
              <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="middle"
                fill="#f0f0f5" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">
                6 Emociones
              </text>
              <text x={CX} y={CY + 9} textAnchor="middle" dominantBaseline="middle"
                fill="#4a4a5e" fontSize="9" fontFamily="Inter, sans-serif">
                Modelo v3_pseudo
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {EMOTION_KEYS.map((emotion) => {
          const config  = EMOTIONS[emotion];
          const d       = data[emotion] || {};
          const isActive = hovered === emotion;
          return (
            <div
              key={emotion}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
              style={{
                opacity: hovered === null || isActive ? 1 : 0.35,
                backgroundColor: isActive ? `${config.color}12` : 'transparent',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={() => setHovered(emotion)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: config.color, boxShadow: isActive ? `0 0 6px ${config.color}` : 'none' }} />
              <span className="text-[#a1a1b5] text-xs truncate">{emotion}</span>
              <span className="ml-auto font-bold text-[#f0f0f5] text-xs flex-shrink-0">{d.total || 0}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
