import AppShell from '../src/components/AppShell';
import './globals.css';

export const metadata = {
  title: 'TikTok Emotion Analyzer — Dashboard',
  description: 'Plataforma de análisis de emociones en comentarios de TikTok usando RoBERTuito fine-tuned',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark">
      <body className="flex h-screen bg-base text-[#f0f0f5] font-sans overflow-hidden">
        <div className="bg-grid-animated" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}