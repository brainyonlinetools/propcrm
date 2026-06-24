"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleFilterSectionProps {
  title: string;
  summary?: string;
  hasActiveFilter?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleFilterSection({
  title,
  summary,
  hasActiveFilter = false,
  defaultOpen = false,
  children,
}: CollapsibleFilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
        <span className="text-xs font-medium">{title}</span>
        {summary && (
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              hasActiveFilter ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {summary}
          </span>
        )}
      </button>
      {open && <div className="flex gap-2 overflow-x-auto pb-2">{children}</div>}
    </div>
  );
}
