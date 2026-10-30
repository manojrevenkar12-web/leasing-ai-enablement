'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Remote<T> =
  | { status: 'loading'; data: T | null }
  | { status: 'error'; error: Error; data: T | null }
  | { status: 'ready'; data: T };

/**
 * Load something from the API whenever `key` changes, cancel the previous request, and offer a
 * retry. Keeps the last good data while a new request runs, so lists do not flash empty.
 */
export function useRemote<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, debounceMs = 0): Remote<T> & { retry: () => void } {
  const [state, setState] = useState<Remote<T>>({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and attempt are the triggers
  useEffect(() => {
    if (key === null) return;
    const ctrl = new AbortController();
    setState((s) => ({ status: 'loading', data: s.data }));
    const timer = setTimeout(() => {
      loadRef
        .current(ctrl.signal)
        .then((data) => setState({ status: 'ready', data }))
        .catch((error: unknown) => {
          if (ctrl.signal.aborted) return;
          setState((s) => ({ status: 'error', error: error instanceof Error ? error : new Error(String(error)), data: s.data }));
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key, attempt, debounceMs]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
