/**
 * useDataRefresh — Auto-refresh hook.
 * ─────────────────────────────────────────────────────────
 * Subscribes to data-change events from the cache layer.
 * When data changes (e.g. after insertPrediction), the
 * provided refreshFn is called automatically.
 * ─────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';
import { onDataChange } from './dataCache';

/**
 * @param {Function} refreshFn — Function to call when data changes
 */
export function useDataRefresh(refreshFn) {
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  useEffect(() => {
    const unsub = onDataChange(() => fnRef.current());
    return unsub;
  }, []);
}
