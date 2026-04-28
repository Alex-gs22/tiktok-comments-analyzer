"use client"; 

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Sparkles,
  Video,
  Hash, 
  GitCompareArrows, 
  Clock, 
  Flower2,
  Brain,
  BarChart2
} from 'lucide-react';
import { useSidebarState } from './SidebarStateContext';

const navItems = [
  { name: 'Overview',           href: '/dashboard',    icon: LayoutDashboard },
  { name: 'Analizador',        href: '/analizador',   icon: Sparkles,        badge: 'LIVE' },
  { name: 'Analizar Video',    href: '/video',        icon: Video },
  { name: 'Temas Analizados',  href: '/temas',        icon: Hash },
  { name: 'Comparativa',       href: '/comparativa',  icon: GitCompareArrows },
  { name: 'Rueda de Plutchik', href: '/plutchik',     icon: Flower2 },
  { name: 'Evolución Temporal',href: '/timeline',     icon: Clock },
  { name: 'Rendimiento',       href: '/modelo',       icon: Brain },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { setIsHovered, isOpen } = useSidebarState();

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: isOpen ? '16rem' : '4.5rem' }}
      className="z-[60] transition-[width] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] overflow-hidden h-screen border-r border-subtle bg-surface flex flex-col relative flex-shrink-0"
    >      
      {/* Logo */}
      <div className="flex items-center h-14 mt-2 mb-6" style={{ padding: '0 0.75rem' }}>
        <div className={`flex items-center w-full transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isOpen ? 'gap-3 px-1' : 'gap-0 justify-center'}`}>
          <div className="bg-accent-gradient p-2 rounded-xl shadow-sm flex-shrink-0">
            <BarChart2 className="text-white w-5 h-5" />
          </div>
          <div 
            className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            style={{ 
              width: isOpen ? '180px' : '0px', 
              opacity: isOpen ? 1 : 0,
            }}
          >
            <h1 className="font-bold text-[#f0f0f5] text-[15px] leading-tight whitespace-nowrap">
              Emotion Analyzer
            </h1>
            <p className="text-xs text-[#6b6b80] font-medium whitespace-nowrap">
              TikTok · RoBERTuito
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[rgba(255,255,255,0.06)] mb-4 mx-3" />

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40 ${
                isOpen ? 'px-3' : 'justify-center px-0'
              } ${
                isActive
                  ? 'bg-[rgba(255,255,255,0.06)] text-[#f0f0f5]'
                  : 'text-[#6b6b80] hover:text-[#a1a1b5] hover:bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-accent-cyan' : 'text-[#4a4a5e] group-hover:text-[#6b6b80]'}`} />
              
              {/* Text + badge container — animates as one unit */}
              <div 
                className="flex items-center gap-2 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                style={{ 
                  width: isOpen ? '180px' : '0px', 
                  opacity: isOpen ? 1 : 0,
                  marginLeft: isOpen ? '0.75rem' : '0',
                }}
              >
                <span className="whitespace-nowrap flex-1">{item.name}</span>
                {item.badge && (
                  <span className="badge-live flex-shrink-0">{item.badge}</span>
                )}
              </div>

              {/* Tooltip (collapsed) */}
              {!isOpen && (
                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-elevated text-[#f0f0f5] text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-subtle shadow-lg pointer-events-none">
                  {item.name}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-elevated" />
                </div>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-gradient" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div 
        className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.06)] px-4 pb-4 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ opacity: isOpen ? 1 : 0, height: isOpen ? 'auto' : 0, padding: isOpen ? undefined : 0 }}
      >
        <p className="text-[10px] text-[#4a4a5e] font-medium uppercase tracking-wider whitespace-nowrap">Modelo</p>
        <a
          href="https://huggingface.co/FalexOne/robertuito-emociones-tiktok"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-accent-cyan font-mono mt-0.5 truncate block hover:underline whitespace-nowrap"
        >
          RoBERTuito v3_pseudo ↗
        </a>
        <p className="text-[10px] text-[#4a4a5e] mt-0.5 whitespace-nowrap">Macro F1: <span className="text-accent-cyan font-semibold">0.628</span></p>
      </div>
    </aside>
  );
}