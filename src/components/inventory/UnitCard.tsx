"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { Inventory } from "@/types";

interface UnitCardProps {
  unit: Inventory;
}

export function UnitCard({ unit }: UnitCardProps) {
  const floor = unit.custom_data.floor;
  const facing = unit.custom_data.facing;
  const projectName = (unit.custom_data?.project_name as string) ?? unit.projects?.name;

  return (
    <Link
      href={`/inventory/${unit.id}`}
      className="block rounded-lg border border-border bg-card p-3 shadow-card transition-colors active:bg-muted/50"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{unit.unit_number}</h3>
            {projectName && (
              <p className="truncate text-xs text-muted-foreground">{projectName}</p>
            )}
          </div>
          <StatusBadge status={unit.status} className="shrink-0" />
        </div>

        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {unit.unit_type && <span>{unit.unit_type}</span>}
          {floor != null && <span>Floor {String(floor)}</span>}
          {facing != null && <span>{String(facing)} facing</span>}
          {unit.area_sqft != null && <span>{unit.area_sqft.toLocaleString("en-IN")} sq.ft.</span>}
        </div>

        {unit.price != null && (
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(unit.price)}
          </p>
        )}
      </div>
    </Link>
  );
}
