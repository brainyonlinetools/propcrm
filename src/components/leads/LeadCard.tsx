"use client";

import Link from "next/link";
import { StageBadge } from "@/components/shared/StatusBadge";
import { useFieldDefinitions } from "@/lib/queries/fieldDefinitions";
import { formatPhone } from "@/lib/utils";
import type { Lead } from "@/types";

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
  const { data: fieldDefs = [] } = useFieldDefinitions("lead");
  const cardFields = fieldDefs.filter((f) => f.show_in_card);

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-lg border border-border bg-card p-4 shadow-card transition-colors active:bg-muted/50"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">{lead.name}</h3>
          {lead.pipeline_stages && (
            <StageBadge
              label={lead.pipeline_stages.label}
              color={lead.pipeline_stages.color}
            />
          )}
        </div>

        {lead.phone && (
          <p className="text-sm text-muted-foreground">{formatPhone(lead.phone)}</p>
        )}

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
    </Link>
  );
}
