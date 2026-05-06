"use client";
import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';

/**
 * KpiCard — Dark glassmorphism KPI card with animated numbers.
 *
 * Props:
 *   title       — Label above the number
 *   value       — Numeric value or string
 *   subtext     — Small text below value
 *   icon        — Lucide icon component
 *   color       — Emotion/accent colour hex
 *   suffix      — Text after number (e.g. '%')
 *   prefix      — Text before number
 *   decimals    — Decimal places for animated number
 *   animate     — Animate the number (default true)
 *   delay       — Animation delay in seconds
 *   pulse       — Enable pulse animation (default false)
 *   pulseColor  — Color to pulse to (default: color param)
 */
export default function KpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = '#06b6d4',
  suffix = '',
  prefix = '',
  decimals = 0,
  animate = true,
  delay = 0,
  pulse = false,
  pulseColor = null,
}) {
  const isNumeric = typeof value === 'number';
  const finalPulseColor = pulseColor || color;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden group"
    >
      {/* Glow accent */}
      <div 
        className="absolute -top-12 -right-12 w-24 h-24 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ backgroundColor: pulse ? finalPulseColor : color }}
      />

      <div className="flex justify-between items-start relative z-10">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold">
            <motion.div
              animate={pulse ? { scale: [1, 1.06, 1], color: [color, finalPulseColor, color] } : {}}
              transition={pulse ? { duration: 2.2, ease: 'easeInOut' } : {}}
              style={{ color: pulse ? color : '#f0f0f5' }}
            >
              {isNumeric && animate ? (
                <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
              ) : (
                <>{prefix}{typeof value === 'number' ? value.toLocaleString('es-MX') : value}{suffix}</>
              )}
            </motion.div>
          </h3>
        </div>
        
        {Icon && (
          <div 
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {subtext && (
        <p className="text-[11px] text-[#4a4a5e] font-medium relative z-10">{subtext}</p>
      )}
    </motion.div>
  );
}