/**
 * dataCache.js
 * ─────────────────────────────────────────────────────────
 * Client-side in-memory cache for data service calls.
 * Reduces redundant Supabase queries when navigating
 * between pages.
 *
 * Features:
 *   - TTL-based expiration (default 5 min)
 *   - Manual invalidation (per-key or all)
 *   - Event emitter for data-change notifications
 *     (pages subscribe to auto-refresh after inserts)
 * ─────────────────────────────────────────────────────────
 */

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// ── Cache store ─────────────────────────────────────────

const store = new Map(); // key → { data, timestamp }

/**
 * Get cached data or execute fetchFn and cache the result.
 * @param {string} key    Unique cache key
 * @param {Function} fetchFn  Async function that returns data
 * @param {number} ttl    Time-to-live in ms (default 5 min)
 */
export async function cached(key, fetchFn, ttl = DEFAULT_TTL) {
  const entry = store.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }

  const data = await fetchFn();
  store.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * Invalidate a specific cache key.
 */
export function invalidateKey(key) {
  store.delete(key);
}

/**
 * Invalidate all cached data.
 */
export function invalidateAll() {
  store.clear();
}

// ── Event emitter for data changes ──────────────────────

const listeners = new Set();

/**
 * Subscribe to data-change events.
 * Returns an unsubscribe function.
 */
export function onDataChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Notify all listeners that data has changed.
 * Call this after successful inserts.
 */
export function notifyDataChange() {
  invalidateAll();
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error('[dataCache] listener error:', e); }
  });
}
