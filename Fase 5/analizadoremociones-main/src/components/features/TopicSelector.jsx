"use client";
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { EMOTIONS } from '../../lib/emotionConfig';

/**
 * TopicSelector — Premium dropdown for topic selection.
 *
 * Props:
 *   topics      — Array of { id, nombre, categoria, totalComentarios, emocionDominante }
 *   selected    — Currently selected topic name
 *   onSelect    — Callback(topicName)
 */
export default function TopicSelector({ topics, selected, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-subtle bg-card hover:bg-elevated text-sm font-medium text-[#f0f0f5] transition-all"
      >
        <span>Cambiar tema</span>
        <ChevronDown className={`w-4 h-4 text-[#4a4a5e] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[320px] rounded-2xl bg-card border border-subtle shadow-2xl overflow-hidden z-50">
          {topics.map((topic) => {
            const isSelected = selected === topic.nombre;
            const emConfig = EMOTIONS[topic.emocionDominante] || EMOTIONS.Incierto;
            return (
              <button
                key={topic.id}
                onClick={() => { onSelect(topic.nombre); setIsOpen(false); }}
                className={`w-full text-left px-5 py-3.5 transition-colors flex items-start gap-3 ${
                  isSelected ? 'bg-[rgba(255,255,255,0.06)]' : 'hover:bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                <span className="text-lg mt-0.5">{emConfig.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#f0f0f5] truncate">{topic.nombre}</p>
                  <p className="text-[10px] text-[#4a4a5e] mt-0.5">
                    {topic.categoria} · {topic.totalComentarios} comentarios
                  </p>
                </div>
                {isSelected && <span className="text-accent-cyan text-xs font-bold mt-1">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
