"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the browser/OS back gesture close an open sheet or dialog instead of
 * navigating away. Pushes one history entry while `open`, closes on popstate,
 * and pops its own entry when closed programmatically. Nested overlays close
 * one at a time (topmost first).
 */
const stack: string[] = [];
let counter = 0;

export function useBackToClose(open: boolean | undefined, onOpenChange?: (open: boolean) => void) {
  const idRef = useRef<string>("");
  const onChangeRef = useRef(onOpenChange);
  onChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const id = `ov-${++counter}`;
    idRef.current = id;
    // Keep Next's internal history state so its popstate handler stays happy.
    window.history.pushState({ ...window.history.state, __overlay: id }, "", window.location.href);
    stack.push(id);
    let closedByBack = false;

    const onPop = () => {
      if (stack[stack.length - 1] !== id) return;
      closedByBack = true;
      stack.pop();
      onChangeRef.current?.(false);
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      const idx = stack.lastIndexOf(id);
      if (idx !== -1) stack.splice(idx, 1);
      // Closed some other way (button, overlay tap, save): drop our entry.
      if (!closedByBack && window.history.state?.__overlay === id) {
        window.history.back();
      }
    };
  }, [open]);
}
