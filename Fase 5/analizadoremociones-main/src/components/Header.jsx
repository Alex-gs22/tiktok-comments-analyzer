"use client";
import { Menu, X } from 'lucide-react';
import { useSidebarState } from './SidebarStateContext';

export default function Header({ title, subtitle, children }) {
  const { isPinned, setIsPinned } = useSidebarState();

  return (
    <div className="sticky top-0 z-50 w-full">
      <header className="border-gradient bg-surface/80 backdrop-blur-xl h-[60px] px-8 flex items-center justify-between flex-shrink-0">
        
        {/* Left section */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-subtle bg-card text-[#6b6b80] hover:text-[#f0f0f5] hover:bg-elevated transition-colors"
            aria-label={isPinned ? 'Cerrar sidebar' : 'Abrir sidebar'}
            aria-pressed={isPinned}
          >
            {isPinned ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#f0f0f5] leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-[#6b6b80] font-medium">{subtitle}</p>}
          </div>
        </div>

        {/* Right section — slot for page-specific actions */}
        <div className="flex items-center gap-4">
          {children}
        </div>
      </header>
    </div>
  );
}