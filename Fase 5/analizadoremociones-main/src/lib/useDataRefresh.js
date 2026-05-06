/**
 * useDataRefresh — Auto-refresh hook.
 * ─────────────────────────────────────────────────────────
 * Subscribes to data-change events from the cache layer.
 * When data changes (e.g. after insertPrediction), the
 * provided refreshFn is called automatically.
 * ─────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';
import { onDataChange, invalidateAll } from './dataCache';

/**
 * @param {Function} refreshFn — Function to call when data changes
 */
export function useDataRefresh(refreshFn, pollInterval = null) {
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  useEffect(() => {
    const unsub = onDataChange(() => fnRef.current());
    return unsub;
  }, []);

  useEffect(() => {
    if (!pollInterval) return;
    const timer = setInterval(() => {
      invalidateAll();
      try { fnRef.current(); } catch (e) { console.error('[useDataRefresh] poll error', e); }
    }, pollInterval);
    return () => clearInterval(timer);
  }, [pollInterval]);
}
