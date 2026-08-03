"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { StageBadge } from "@/components/shared/StatusBadge";
import { useFieldDefinitions } from "@/lib/queries/fieldDefinitions";
import { cn, formatDisplayDate, formatPhone, formatRelativeDate } from "@/lib/utils";
import type { Lead } from "@/types";

interface LeadCardProps {
  lead: Lead;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (leadId: string) => void;
  showLastActivity?: boolean;
}

export function LeadCard({
  lead,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  showLastActivity = false,
}: LeadCardProps) {
  const { data: fieldDefs = [] } = useFieldDefinitions("lead");
  const cardFields = fieldDefs.filter((f) => f.show_in_card);

  const content = (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {selectionMode && (
            <Checkbox
              checked={selected}
              className="mt-1"
              aria-label={`Select ${lead.name}`}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => onToggleSelect?.(lead.id)}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{lead.name}</h3>
              {selectionMode && !lead.phone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <AlertCircle className="size-3" />
                  No phone
                </span>
              )}
            </div>
          </div>
        </div>
        {lead.pipeline_stages && (
          <StageBadge
            label={lead.pipeline_stages.label}
            color={lead.pipeline_stages.color}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
        {lead.phone && <span>{formatPhone(lead.phone)}</span>}
        {showLastActivity ? (
          <span className="text-xs">Active {formatRelativeDate(lead.updated_at)}</span>
        ) : (
          (lead.acquired_date || lead.created_at) && (
            <span className="text-xs">
              {formatDisplayDate(lead.acquired_date ?? lead.created_at)}
            </span>
          )
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {lead.source && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {lead.source}
          </span>
        )}
        {lead.project_interest && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {lead.project_interest}
          </span>
        )}
      </div>

      {cardFields.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          {cardFields.map((field) => {
            const val = lead.custom_data[field.field_key];
            if (val == null || val === "") return null;
            const display =
              field.field_key === "budget" ? `₹${val} Cr` : String(val);
            return (
              <div key={field.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{field.label}</span>
                <span className="font-medium">{display}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const className = cn(
    "block rounded-lg border border-border bg-card p-4 shadow-card transition-colors",
    selectionMode
      ? selected
        ? "border-primary bg-primary/5"
        : "active:bg-muted/50"
      : "active:bg-muted/50"
  );

  if (selectionMode) {
    return (
      <button
        type="button"
        className={cn(className, "w-full text-left")}
        onClick={() => onToggleSelect?.(lead.id)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={`/leads/${lead.id}`} className={className}>
      {content}
    </Link>
  );
}
