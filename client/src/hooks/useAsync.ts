import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export function messageFor(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Loads data on mount and whenever `deps` change, with a `reload()` for use after a
 * mutation.
 *
 * A monotonic run token, rather than a per-effect cancelled flag, decides which
 * response is allowed to reach state. That covers both cases at once: a fast filter
 * change and a reload triggered while an earlier request is still in flight can never
 * leave the page showing a stale answer.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  errorMessage?: string,
): AsyncState<T> & { reload: () => void; refresh: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  // The caller passes a fresh closure every render. Holding the latest one in a ref
  // keeps the effect keyed on `deps` alone rather than re-firing on every render.
  const latest = useRef({ loader, errorMessage });
  latest.current = { loader, errorMessage };

  const runId = useRef(0);

  const load = useCallback((mode: 'full' | 'silent' = 'full') => {
    const token = ++runId.current;
    const { loader: run, errorMessage: fallback } = latest.current;
    if (mode === 'full') setState({ status: 'loading' });

    run()
      .then((data) => {
        if (token === runId.current) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (token !== runId.current) return;
        // A background refresh must not wipe a page the user is looking at.
        if (mode === 'silent') return;
        setState({ status: 'error', message: messageFor(error, fallback) });
      });
  }, []);

  useEffect(() => {
    load();
    // Discards any in-flight response when the dependencies change or the component
    // unmounts.
    return () => {
      runId.current += 1;
    };
  }, [...deps, load]);

  return { ...state, reload: () => load('full'), refresh: () => load('silent') };
}
