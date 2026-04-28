"use client";
import { Database, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * EmptyState — Shown when there's no data.
 * ErrorState — Shown on fetch errors.
 * LoadingState — Shown while loading (legacy, still available).
 * SkeletonKpiRow — Skeleton KPI cards row.
 * SkeletonChart — Skeleton chart placeholder.
 * SkeletonTable — Skeleton table placeholder.
 * SkeletonCard — Skeleton generic card.
 * PageSkeleton — Full-page skeleton composition.
 */

export function EmptyState({ icon: Icon = Database, title = 'Sin datos', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-subtle flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[#4a4a5e]" />
      </div>
      <h3 style={{ color: '#f0f0f5', fontFamily: 'Inter, sans-serif' }} className="text-lg font-bold mb-1">{title}</h3>
      {message && <p className="text-sm text-[#6b6b80] text-center max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Error al cargar datos', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl bg-em-rechazo/10 border border-em-rechazo/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-em-rechazo" />
      </div>
      <h3 style={{ color: '#f0f0f5', fontFamily: 'Inter, sans-serif' }} className="text-lg font-bold mb-1">Error</h3>
      <p className="text-sm text-[#6b6b80] text-center max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-gradient text-white text-sm font-medium hover:shadow-lg hover:shadow-accent-cyan/10 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

export function LoadingState({ message = 'Cargando datos...' }) {
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-subtle" />
          <div className="absolute inset-0 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
        </div>
        <span className="text-sm text-[#6b6b80]">{message}</span>
      </div>
    </div>
  );
}

// ── Skeleton Building Blocks ────────────────────────────

/** Single skeleton KPI card */
function SkeletonKpi() {
  return (
    <div className="glass-card p-5 flex flex-col gap-3 overflow-hidden skeleton-fade-in">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2 flex-1">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
        <div className="skeleton w-10 h-10 rounded-xl" />
      </div>
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  );
}

/**
 * SkeletonKpiRow — Row of skeleton KPI cards.
 * @param {{ count?: number }} props
 */
export function SkeletonKpiRow({ count = 4 }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpi key={i} />
      ))}
    </div>
  );
}

/**
 * SkeletonChart — Chart placeholder with configurable height.
 * @param {{ height?: number, title?: boolean }} props
 */
export function SkeletonChart({ height = 280, title = true }) {
  return (
    <div className="glass-card p-6 skeleton-fade-in">
      {title && (
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-3 w-52 rounded" />
          </div>
        </div>
      )}
      <div className="skeleton rounded-xl" style={{ height }} />
    </div>
  );
}

/**
 * SkeletonTable — Table rows skeleton.
 * @param {{ rows?: number, cols?: number }} props
 */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="glass-card p-6 skeleton-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton w-8 h-8 rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-3 w-56 rounded" />
        </div>
      </div>
      {/* Header */}
      <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-3 rounded" />
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid gap-4 py-2"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              animationDelay: `${i * 80}ms`,
            }}
          >
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="skeleton h-4 rounded" style={{ width: j === 0 ? '80%' : '60%' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonCard — Generic skeleton card.
 */
export function SkeletonCard({ height = 160 }) {
  return (
    <div className="glass-card p-6 skeleton-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton w-8 h-8 rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
      </div>
      <div className="skeleton rounded-xl" style={{ height: height - 80 }} />
    </div>
  );
}

// ── Full-page Skeleton Compositions ─────────────────────

/**
 * DashboardSkeleton — Mimics the Dashboard layout while loading.
 */
export function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 skeleton-stagger">
      <SkeletonKpiRow count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height={300} />
        <SkeletonChart height={300} />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}

/**
 * TemasSkeleton — Mimics the Temas page layout while loading.
 */
export function TemasSkeleton() {
  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 skeleton-stagger">
      <div className="space-y-2">
        <div className="skeleton h-3 w-32 rounded" />
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="skeleton h-4 w-48 rounded" />
      </div>
      <SkeletonKpiRow count={3} />
      <SkeletonChart height={320} />
    </div>
  );
}

/**
 * PlutchikSkeleton — Mimics the Plutchik page layout while loading.
 */
export function PlutchikSkeleton() {
  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 skeleton-stagger">
      <SkeletonCard height={60} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height={380} />
        <div className="space-y-6">
          <SkeletonCard height={240} />
          <SkeletonCard height={200} />
        </div>
      </div>
    </div>
  );
}

/**
 * TimelineSkeleton — Mimics the Timeline page layout while loading.
 */
export function TimelineSkeleton() {
  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 skeleton-stagger">
      <SkeletonKpiRow count={3} />
      <SkeletonChart height={360} />
    </div>
  );
}

/**
 * ComparativaSkeleton — Mimics the Comparativa page layout while loading.
 */
export function ComparativaSkeleton() {
  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 skeleton-stagger">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-8 w-40 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height={300} />
        <SkeletonChart height={300} />
      </div>
      <SkeletonTable rows={3} cols={4} />
    </div>
  );
}
