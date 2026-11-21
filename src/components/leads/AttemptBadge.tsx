import { attemptLabel } from "@/lib/leadFlow";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

/** "Untouched" or "Tried ×3 · 2d ago" for leads still in the entry stage. */
export function AttemptBadge({
  lead,
  className,
}: {
  lead: Pick<Lead, "call_attempts" | "last_contacted_at">;
  className?: string;
}) {
  const untouched = lead.call_attempts <= 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        untouched
          ? "bg-secondary text-muted-foreground"
          : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        className
      )}
    >
      {attemptLabel(lead)}
    </span>
  );
}
