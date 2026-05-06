"use client";
import { useState, useMemo } from 'react';
import { EMOTIONS, EMOTION_KEYS } from '../lib/emotionConfig';
import EmotionBadge from './EmotionBadge';
import { MessageSquare, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const PAGE_SIZE = 5;
 
// Confidence gradient helper
function getConfidenceGradient(confidence) {
  if (confidence < 0.55) return 'linear-gradient(90deg, #ef4444, #f87171)';
  if (confidence < 0.70) return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
  return 'linear-gradient(90deg, #10b981, #34d399)';
}

function ConfidenceBar({ value = 0 }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value * 100}%`, background: getConfidenceGradient(value) }}
        />
      </div>
      <span className="text-[10px] font-bold text-[#6b6b80]">{pct}%</span>
    </div>
  );
}
/**
 * CommentTable — Dark themed table of analyzed comments with filtering.
 *
 * Props:
 *   comments  — Array of { id, texto, emocion, confianza, likes }
 *   showFilters — Show emotion filter pills (default true)
 */
export default function CommentTable({ comments, showFilters = true }) {
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [page, setPage] = useState(0);

  const toggleEmotion = (emotion) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
    setPage(0);
  };

  const filtered = useMemo(() => {
    if (selectedEmotions.length === 0) return comments;
    return comments.filter((c) => selectedEmotions.includes(c.emocion));
  }, [comments, selectedEmotions]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-subtle">
        <div className="flex items-center gap-2 mb-0.5">
          <MessageSquare className="w-4 h-4 text-[#4a4a5e]" />
          <h3 className="font-bold text-[#f0f0f5] text-sm">Comentarios Analizados</h3>
        </div>
        <p className="text-xs text-[#4a4a5e] ml-6">Predicciones del modelo con nivel de confianza</p>

        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-3 items-center ml-6">
            <Filter className="w-3.5 h-3.5 text-[#4a4a5e]" />
            {EMOTION_KEYS.map((em) => {
              const isActive = selectedEmotions.includes(em);
              const config = EMOTIONS[em];
              return (
                <button
                  key={em}
                  onClick={() => toggleEmotion(em)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all"
                  style={isActive ? {
                    backgroundColor: config.colorLight,
                    borderColor: config.color + '40',
                    color: config.color,
                  } : {
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255,255,255,0.06)',
                    color: '#6b6b80',
                  }}
                >
                  {config.emoji} {em}
                </button>
              );
            })}
            {selectedEmotions.length > 0 && (
              <button
                onClick={() => { setSelectedEmotions([]); setPage(0); }}
                className="text-[10px] text-accent-cyan hover:underline ml-1"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-[#4a4a5e] uppercase tracking-wider border-b border-subtle">
              <th className="px-5 py-3">Comentario</th>
              <th className="px-5 py-3 text-center">Emoción</th>
              <th className="px-5 py-3 text-center">Confianza</th>
              <th className="px-5 py-3 text-center">Likes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {paginated.map((item) => {
              const config = EMOTIONS[item.emocion] || EMOTIONS.Incierto;
              return (
                <tr key={item.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-5 py-4 text-sm text-[#a1a1b5] max-w-md">{item.texto}</td>
                  <td className="px-5 py-4 text-center">
                    <EmotionBadge emotion={item.emocion} size="sm" />
                  </td>
                  <td className="px-5 py-4">
                    <ConfidenceBar value={item.confianza} />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#6b6b80] text-center">
                    {item.likes?.toLocaleString() || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-3 flex justify-between items-center text-[10px] text-[#4a4a5e] font-medium border-t border-subtle">
        <span>{filtered.length} comentarios {selectedEmotions.length > 0 ? '(filtrados)' : ''}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="hover:text-[#f0f0f5] disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[#a1a1b5]">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="hover:text-[#f0f0f5] disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}