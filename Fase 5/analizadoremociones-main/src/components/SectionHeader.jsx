"use client";

/**
 * SectionHeader — Consistent header for dashboard sections.
 * Forces white text with inline style to prevent any CSS override.
 */
export default function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-0.5">
        {Icon && <Icon className="w-5 h-5 text-[#4a4a5e]" />}
        <h3 style={{ color: '#f0f0f5', fontFamily: 'Inter, sans-serif', fontStyle: 'normal' }} className="text-base font-bold">{title}</h3>
      </div>
      {subtitle && (
        <p className="text-sm text-[#6b6b80] ml-7">{subtitle}</p>
      )}
    </div>
  );
}
