"use client";

/**
 * SectionHeader — Consistent header for dashboard sections.
 * 
 * Props:
 *   icon     — Lucide icon component
 *   title    — Section title
 *   subtitle — Optional description
 */
export default function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-0.5">
        {Icon && <Icon className="w-5 h-5 text-[#4a4a5e]" />}
        <h3 className="text-base font-bold text-[#f0f0f5]">{title}</h3>
      </div>
      {subtitle && (
        <p className="text-sm text-[#6b6b80] ml-7">{subtitle}</p>
      )}
    </div>
  );
}
