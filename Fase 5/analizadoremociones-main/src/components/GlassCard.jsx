"use client";

/**
 * GlassCard — Reusable glassmorphism card component.
 * 
 * Props:
 *   className  — additional classes
 *   children   — content
 *   hover      — enable hover glow (default true)
 *   padding    — Tailwind padding class (default 'p-6')
 */
export default function GlassCard({ children, className = '', hover = true, padding = 'p-6' }) {
  return (
    <div className={`glass-card ${padding} ${hover ? '' : '!shadow-none hover:!border-subtle'} ${className}`}>
      {children}
    </div>
  );
}
