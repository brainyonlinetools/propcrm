import { cn } from "@/lib/utils";
import type { InventoryStatus } from "@/types";
import { INVENTORY_STATUS_CONFIG } from "@/types";

interface StatusBadgeProps {
  status: InventoryStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = INVENTORY_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

interface StageBadgeProps {
  label: string;
  color: string;
  className?: string;
}

export function StageBadge({ label, color, className }: StageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: `${color}18`,
        color,
        borderColor: `${color}40`,
      }}
    >
      {label}
    </span>
  );
}
