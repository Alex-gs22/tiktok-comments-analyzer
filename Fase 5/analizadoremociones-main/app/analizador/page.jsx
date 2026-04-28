"use client";
import Header from '../../src/components/Header';
import LiveAnalyzer from '../../src/components/features/LiveAnalyzer';

export default function AnalizadorPage() {
  return (
    <div className="w-full">
      <Header title="Analizador en Vivo" subtitle="Clasifica emociones en tiempo real con el modelo" />
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        <LiveAnalyzer />
        <div className="text-center text-[10px] text-[#4a4a5e] space-y-1">
          <p>Modelo: <span className="text-[#6b6b80] font-mono">FalexOne/robertuito-emociones-tiktok</span> · Macro F1: <span className="text-accent-cyan font-semibold">0.628</span></p>
          <p>Umbral de incertidumbre: &lt; 40% confianza → Incierto · Los resultados se guardan en la base de datos</p>
        </div>
      </div>
    </div>
  );
}
