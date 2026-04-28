"use client";
import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedNumber — Counter that animates from 0 to target value.
 *
 * Props:
 *   value     — Target number
 *   duration  — Animation duration in ms (default 1200)
 *   prefix    — Text before number (e.g. '$')
 *   suffix    — Text after number (e.g. '%')
 *   decimals  — Decimal places (default 0)
 *   format    — Use locale formatting (default true)
 */
export default function AnimatedNumber({ value, duration = 1200, prefix = '', suffix = '', decimals = 0, format = true }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;

          const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(eased * numValue);
            if (progress < 1) requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  const formatted = format
    ? display.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : display.toFixed(decimals);

  return (
    <span ref={ref}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
