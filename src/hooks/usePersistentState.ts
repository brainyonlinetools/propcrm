"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState that survives navigating away and back (sessionStorage).
 * Starts with `initial` for SSR/hydration safety, then restores on mount.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* storage unavailable */
    }
    restored.current = true;
  }, [key]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  const set = useCallback((v: T | ((prev: T) => T)) => setValue(v), []);
  return [value, set] as const;
}
