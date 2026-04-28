/**
 * useSupabaseData — Custom hook for fetching data from the data service.
 * Handles loading state, error state, and provides a refresh function.
 */

import { useState, useEffect, useCallback } from 'react';

export function useSupabaseData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
