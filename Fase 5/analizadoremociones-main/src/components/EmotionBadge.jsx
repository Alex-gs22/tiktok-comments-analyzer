"use client";
import { EMOTIONS } from '../lib/emotionConfig';

/**
 * EmotionBadge — Styled badge for emotion labels.
 *
 * Props:
 *   emotion  — Emotion key (e.g. 'Alegría', 'Rechazo', 'Incierto')
 *   size     — 'sm' | 'md' | 'lg' (default 'md')
 *   showEmoji — Show emoji (default true)
 */
export default function EmotionBadge({ emotion, size = 'md', showEmoji = true }) {
  const config = EMOTIONS[emotion] || EMOTIONS.Incierto;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${sizeClasses[size]}`}
      style={{
        backgroundColor: config.colorLight,
        color: config.color,
        border: `1px solid ${config.color}30`,
      }}
    >
      {showEmoji && <span>{config.emoji}</span>}
      {config.label}
    </span>
  );
}
