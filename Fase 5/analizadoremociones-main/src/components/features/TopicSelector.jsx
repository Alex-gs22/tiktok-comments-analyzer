"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Shuffle } from 'lucide-react';
import { EMOTIONS } from '../../lib/emotionConfig';

/**
 * TopicSelector — Searchable dropdown with random topic button.
 *
 * Props:
 *   topics      — Array of { id, nombre, categoria, totalComentarios, emocionDominante }
 *   selected    — Currently selected topic name
 *   onSelect    — Callback(topicName)
 */
export default function TopicSelector({ topics, selected, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return topics;
    const q = query.toLowerCase();
    return topics.filter(
      (t) => t.nombre.toLowerCase().includes(q) || t.categoria?.toLowerCase().includes(q)
    );
  }, [topics, query]);

  const handleRandom = () => {
    const others = topics.filter((t) => t.nombre !== selected);
    if (others.length === 0) return;
    const random = others[Math.floor(Math.random() * others.length)];
    onSelect(random.nombre);
    setIsOpen(false);
    setQuery('');
  };

  const handleSelect = (nombre) => {
    onSelect(nombre);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search dropdown */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle bg-card hover:bg-elevated text-sm font-medium text-[#f0f0f5] transition-all min-w-[200px]"
        >
          <Search className="w-3.5 h-3.5 text-[#4a4a5e] flex-shrink-0" />
          <span className="truncate text-left flex-1">{selected || 'Seleccionar tema...'}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#4a4a5e] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-[340px] rounded-2xl bg-card border border-subtle shadow-2xl overflow-hidden z-50">
            {/* Search input */}
            <div className="p-3 border-b border-subtle">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a4a5e]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tema..."
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-[#f0f0f5] placeholder-[#4a4a5e] focus:outline-none focus:border-accent-cyan/40 transition-all"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[240px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-5 py-4 text-xs text-[#4a4a5e] text-center">Sin resultados</p>
              ) : (
                filtered.map((topic) => {
                  const isSelected = selected === topic.nombre;
                  const emConfig = EMOTIONS[topic.emocionDominante] || EMOTIONS.Incierto;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => handleSelect(topic.nombre)}
                      className={`w-full text-left px-5 py-3 transition-colors flex items-start gap-3 ${
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
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Random button */}
      <button
        onClick={handleRandom}
        className="flex items-center justify-center w-10 h-10 rounded-xl border border-subtle bg-card hover:bg-elevated text-[#6b6b80] hover:text-accent-cyan transition-all"
        title="Tema aleatorio"
      >
        <Shuffle className="w-4 h-4" />
      </button>
    </div>
  );
}
