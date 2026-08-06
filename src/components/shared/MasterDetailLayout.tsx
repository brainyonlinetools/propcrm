"use client";

import type { ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface MasterDetailLayoutProps {
  /** Left pane: search header + contact list (always visible on mobile). */
  list: ReactNode;
  /** Right pane: selected item detail (desktop only). */
  detail: ReactNode;
  /** When false, renders list full-width (e.g. kanban mode). */
  split?: boolean;
  className?: string;
  listClassName?: string;
  detailClassName?: string;
}

/**
 * WhatsApp Web–style master/detail shell.
 * Mobile: list only. Desktop (md+): fixed-height split with scrollable panes.
 */
export function MasterDetailLayout({
  list,
  detail,
  split = true,
  className,
  listClassName,
  detailClassName,
}: MasterDetailLayoutProps) {
  if (!split) {
    return <div className={cn("flex min-h-dvh flex-col", className)}>{list}</div>;
  }

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col md:h-dvh md:min-h-0 md:flex-row md:overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col md:h-full md:w-[380px] md:flex-none md:shrink-0 md:border-r md:border-border lg:w-[400px]",
          listClassName
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/30 md:flex md:h-full",
          detailClassName
        )}
      >
        {detail}
      </div>
    </div>
  );
}

interface DetailEmptyStateProps {
  title: string;
  description: string;
}

export function DetailEmptyState({ title, description }: DetailEmptyStateProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MessageSquare className="size-7" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
