"use client";
import { useState, useMemo } from 'react';
import { EMOTION_KEYS, EMOTIONS } from '../../lib/emotionConfig';
import GlassCard from '../GlassCard';
import SectionHeader from '../SectionHeader';
import { Flower2 } from 'lucide-react';

/**
 * PlutchikWheel — Interactive Plutchik wheel mapped to 6 model classes.
 * Uses SVG for rendering with per-petal hover animations.
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

const SIZE = 380;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 150;
const MIN_R = 50;

/** Convert polar to cartesian */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Build an SVG arc path for a pie-slice petal */
function petalPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
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

  // Build petal data
  const petals = useMemo(() => {
    const petalSweep = 360 / EMOTION_KEYS.length; // 60°

    return EMOTION_KEYS.map((emotion) => {
      const config = EMOTIONS[emotion];
      const pct = data[emotion]?.porcentaje || 0;
      const total = data[emotion]?.total || 0;
      const normR = MIN_R + (pct / maxPct) * (MAX_R - MIN_R);
      const centerAngle = PETAL_ANGLES[emotion];
      const startAngle = centerAngle - petalSweep / 2;
      const endAngle = centerAngle + petalSweep / 2;
      const path = petalPath(CX, CY, normR, startAngle, endAngle);

      // Label position
      const labelR = normR + 20;
      const labelPos = polarToCartesian(CX, CY, labelR, centerAngle);

      return { emotion, config, pct, total, normR, centerAngle, startAngle, endAngle, path, labelPos };
    });
  }, [data, maxPct]);

  // Ring guides
  const rings = [0.33, 0.66, 1.0].map((pct) => MIN_R + (MAX_R - MIN_R) * pct);

  return (
    <GlassCard>
      <SectionHeader
        icon={Flower2}
        title="Rueda de Plutchik"
        subtitle="6 emociones del modelo mapeadas al modelo teórico"
      />
      <div className="flex justify-center mt-4 relative">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="plutchik-svg"
        >
          <defs>
            {petals.map(({ emotion, config }) => (
              <radialGradient
                key={`grad-${emotion}`}
                id={`grad-${emotion}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={config.color} stopOpacity="0.06" />
                <stop offset="100%" stopColor={config.color} stopOpacity="0.25" />
              </radialGradient>
            ))}
            {/* Hover gradients — brighter */}
            {petals.map(({ emotion, config }) => (
              <radialGradient
                key={`grad-hover-${emotion}`}
                id={`grad-hover-${emotion}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={config.color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={config.color} stopOpacity="0.50" />
              </radialGradient>
            ))}
            {/* Glow filter */}
            <filter id="petal-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Guide rings */}
          {rings.map((r, i) => (
            <circle
              key={i}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          ))}

          {/* Petals */}
          {petals.map(({ emotion, config, path }) => {
            const isHovered = hovered === emotion;
            return (
              <g
                key={emotion}
                className="plutchik-petal"
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  filter: isHovered ? 'url(#petal-glow)' : 'none',
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease',
                }}
                onMouseEnter={() => setHovered(emotion)}
                onMouseLeave={() => setHovered(null)}
              >
                <path
                  d={path}
                  fill={isHovered ? `url(#grad-hover-${emotion})` : `url(#grad-${emotion})`}
                  stroke={config.color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  strokeOpacity={isHovered ? 0.9 : 0.4}
                  style={{
                    transition: 'fill 0.3s ease, stroke-width 0.3s ease, stroke-opacity 0.3s ease',
                  }}
                />
              </g>
            );
          })}

          {/* Labels */}
          {petals.map(({ emotion, config, pct, labelPos }) => (
            <text
              key={`label-${emotion}`}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={config.color}
              fontSize="12"
              fontWeight="700"
              fontFamily="Inter, sans-serif"
              className="plutchik-label"
              style={{
                opacity: hovered === null || hovered === emotion ? 1 : 0.35,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              }}
            >
              {config.emoji} {pct}%
            </text>
          ))}

          {/* Center label */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f0f0f5"
            fontSize="13"
            fontWeight="700"
            fontFamily="Inter, sans-serif"
          >
            6 Emociones
          </text>
          <text
            x={CX}
            y={CY + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#6b6b80"
            fontSize="10"
            fontFamily="Inter, sans-serif"
          >
            Modelo v3_pseudo
          </text>
        </svg>

        {/* Tooltip */}
        {hovered && (() => {
          const petal = petals.find((p) => p.emotion === hovered);
          if (!petal) return null;
          const config = petal.config;
          // Position tooltip near the hovered petal
          const tipPos = polarToCartesian(CX, CY, petal.normR * 0.6, petal.centerAngle);
          return (
            <div
              className="plutchik-tooltip"
              style={{
                position: 'absolute',
                left: tipPos.x,
                top: tipPos.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="plutchik-tooltip-inner" style={{ borderColor: config.color + '40' }}>
                <span className="plutchik-tooltip-emoji">{config.emoji}</span>
                <span className="plutchik-tooltip-name" style={{ color: config.color }}>{petal.emotion}</span>
                <span className="plutchik-tooltip-value">{petal.pct}%</span>
                <span className="plutchik-tooltip-count">{petal.total} comentarios</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {EMOTION_KEYS.map((emotion) => {
          const config = EMOTIONS[emotion];
          const d = data[emotion] || {};
          const isActive = hovered === emotion;
          return (
            <div
              key={emotion}
              className="plutchik-legend-item"
              style={{
                opacity: hovered === null || isActive ? 1 : 0.4,
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={() => setHovered(emotion)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="plutchik-legend-dot"
                style={{
                  backgroundColor: config.color,
                  boxShadow: isActive ? `0 0 8px ${config.color}80` : 'none',
                }}
              />
              <span className="text-[#a1a1b5] text-xs">{emotion}</span>
              <span className="ml-auto font-bold text-[#f0f0f5] text-xs">{d.total || 0}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
