"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0 || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0 && (containerRef.current?.scrollTop ?? 0) <= 0) {
      pullDistance.current = Math.min(diff, 80);
      setPulling(pullDistance.current > 40);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pulling && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    startY.current = 0;
    pullDistance.current = 0;
    setPulling(false);
  }, [onRefresh, pulling, refreshing]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
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
