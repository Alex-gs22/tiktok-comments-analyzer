"use client"; 

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Sparkles,
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
  { name: 'Analizador en Vivo', href: '/analizador',   icon: Sparkles,        badge: 'LIVE' },
  { name: 'Análisis por Tema',  href: '/temas',        icon: Hash },
  { name: 'Comparativa',        href: '/comparativa',  icon: GitCompareArrows },
  { name: 'Rueda de Plutchik',  href: '/plutchik',     icon: Flower2 },
  { name: 'Evolución Temporal', href: '/timeline',     icon: Clock },
  { name: 'Rendimiento',       href: '/modelo',       icon: Brain },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { setIsHovered, isOpen } = useSidebarState();

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${isOpen ? 'w-64' : 'w-20'} z-[60] transition-[width] duration-300 ease-in-out overflow-hidden h-screen border-r border-subtle bg-surface flex flex-col p-4 relative`}
    >      

      {/* Logo */}
      <div className={`flex items-center mb-8 mt-2 transition-[padding,gap] duration-300 ease-in-out ${isOpen ? 'px-2 gap-3' : 'px-0 gap-0 justify-center'}`}>
        <div className="bg-accent-gradient p-2 rounded-xl shadow-sm min-w-max">
          <BarChart2 className="text-white w-5 h-5" />
        </div>

        <div className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-in-out ${
          isOpen ? 'opacity-100 translate-x-0 max-w-[220px]' : 'opacity-0 -translate-x-2 max-w-0'
        }`}>
          <h1 className="font-bold text-[#f0f0f5] text-[15px] leading-tight">
            Emotion Analyzer
          </h1>
          <p className="text-xs text-[#6b6b80] font-medium">
            TikTok · RoBERTuito
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[rgba(255,255,255,0.06)] mb-4 mx-2" />

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 py-2.5 rounded-lg text-[14px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40 ${
                isOpen ? 'px-3' : 'justify-center px-2'
              } ${
                isActive
                  ? 'bg-[rgba(255,255,255,0.06)] text-[#f0f0f5]'
                  : `text-[#6b6b80] hover:text-[#a1a1b5] ${
                      isOpen 
                        ? 'hover:bg-[rgba(255,255,255,0.03)]' 
                        : 'hover:bg-[rgba(255,255,255,0.04)]'
                    }`
              }`}
            >
              <Icon className={`w-5 h-5 min-w-max transition-colors ${isActive ? 'text-accent-cyan' : 'text-[#4a4a5e] group-hover:text-[#6b6b80]'}`} />
              
              <span className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-in-out ${
                isOpen ? 'opacity-100 translate-x-0 max-w-[180px]' : 'opacity-0 -translate-x-2 max-w-0'
              }`}>
                {item.name}
              </span>

              {/* LIVE badge */}
              {item.badge && isOpen && (
                <span className="badge-live ml-auto">{item.badge}</span>
              )}

              {/* Tooltip (collapsed) */}
              {!isOpen && (
                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-elevated text-[#f0f0f5] text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-subtle shadow-lg">
                  {item.name}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-elevated"></div>
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
      <div className={`mt-auto pt-4 border-t border-[rgba(255,255,255,0.06)] transition-[opacity] duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        <div className="px-2">
          <p className="text-[10px] text-[#4a4a5e] font-medium uppercase tracking-wider">Modelo</p>
          <p className="text-[11px] text-[#6b6b80] font-mono mt-0.5 truncate">RoBERTuito v3_pseudo</p>
          <p className="text-[10px] text-[#4a4a5e] mt-0.5">Macro F1: <span className="text-accent-cyan font-semibold">0.628</span></p>
        </div>
      </div>
    </aside>
  );
}