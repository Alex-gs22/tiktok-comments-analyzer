"use client";
import Header from '../../src/components/Header';
import LiveAnalyzer from '../../src/components/features/LiveAnalyzer';
import VideoAnalyzer from '../../src/components/features/VideoAnalyzer';
import { useState } from 'react';

export default function AnalizadorPage() {
  const [mode, setMode] = useState('individual');

  return (
    <div className="w-full">
      <Header title="Analizador en Vivo" subtitle="Clasifica emociones con el modelo en tiempo real" />

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={() => setMode('individual')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === 'individual'
                ? 'bg-accent-gradient text-white shadow-lg shadow-accent-cyan/10'
                : 'bg-card border border-subtle text-[#6b6b80] hover:text-[#a1a1b5]'
            }`}
          >
            💬 Comentario Individual
          </button>
          <button
            onClick={() => setMode('video')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === 'video'
                ? 'bg-accent-gradient text-white shadow-lg shadow-accent-cyan/10'
                : 'bg-card border border-subtle text-[#6b6b80] hover:text-[#a1a1b5]'
            }`}
          >
            🎬 Video de TikTok
          </button>
        </div>

        {/* Content */}
        {mode === 'individual' ? <LiveAnalyzer /> : <VideoAnalyzer />}

        {/* Info footer */}
        <div className="text-center text-[10px] text-[#4a4a5e] space-y-1">
          <p>Modelo: <span className="text-[#6b6b80] font-mono">FalexOne/robertuito-emociones-tiktok</span> · Base: RoBERTuito · Macro F1: <span className="text-accent-cyan font-semibold">0.628</span></p>
          <p>Umbral de incertidumbre: &lt; 40% confianza → Incierto</p>
        </div>
      </div>
    </div>
  );
}
