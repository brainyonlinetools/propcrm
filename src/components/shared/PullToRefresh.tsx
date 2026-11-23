"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  /** When set, scroll position is saved and restored across navigation. */
  restoreKey?: string;
  /** Restore once content has rendered (e.g. data loaded). */
  restoreReady?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  restoreKey,
  restoreReady = true,
}: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useRef(0);
  const pullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const storageKey = restoreKey ? `scroll:${restoreKey}` : null;

  useEffect(() => {
    if (!storageKey || !restoreReady || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as
        | { c: number; w: number }
        | null;
      if (saved?.c && containerRef.current) containerRef.current.scrollTop = saved.c;
      if (saved?.w) window.scrollTo(0, saved.w);
    } catch {
      /* ignore */
    }
  }, [storageKey, restoreReady]);

  // On phones the page itself scrolls, so track window scroll too.
  useEffect(() => {
    if (!storageKey) return;
    const save = () => {
      if (!restoredRef.current) return;
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ c: containerRef.current?.scrollTop ?? 0, w: window.scrollY })
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [storageKey]);

  const handleScroll = useCallback(() => {
    if (!storageKey || !restoredRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ c: containerRef.current?.scrollTop ?? 0, w: window.scrollY })
        );
      } catch {
        /* ignore */
      }
    });
  }, [storageKey]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0 && window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === 0 || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0 && (containerRef.current?.scrollTop ?? 0) <= 0 && window.scrollY <= 0) {
        pullDistance.current = Math.min(diff, 80);
        const isPulling = pullDistance.current > 40;
        pullingRef.current = isPulling;
        setPulling(isPulling);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    // Use the ref so a quick pull is not lost to a stale state value.
    if (pullingRef.current && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    startY.current = 0;
    pullDistance.current = 0;
    pullingRef.current = false;
    setPulling(false);
  }, [onRefresh, refreshing]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pulling || refreshing) && (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center py-2 text-xs text-muted-foreground">
          {refreshing ? "Refreshing…" : "Release to refresh"}
        </div>
      )}
      {children}
    </div>
  );
}
