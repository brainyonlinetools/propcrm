"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLOSE_REASONS,
  NEXT_STEP_PRESETS,
  dateInDays,
  stageRequirement,
} from "@/lib/leadFlow";
import { useMoveLeads } from "@/lib/queries/leadMoves";
import { cn } from "@/lib/utils";
import type { Lead, PipelineStage } from "@/types";

const OTHER_REASON = "Other";

interface StageMoveFormProps {
  leads: Lead[];
  stage: PipelineStage;
  /** Pre-selected close reason (e.g. from a call outcome). */
  initialReason?: string;
  submitLabel?: string;
  onDone: () => void;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Collects what a stage needs (next step, close reason, unit booking) and
 * moves the leads. Shared by the single-lead sheet, bulk change and the call queue.
 */
export function StageMoveForm({
  leads,
  stage,
  initialReason,
  submitLabel,
  onDone,
}: StageMoveFormProps) {
  const move = useMoveLeads();
  const requirement = stageRequirement(stage.kind);
  const bulk = leads.length > 1;

  const [title, setTitle] = useState("Follow up");
  const [dueDate, setDueDate] = useState(() => dateInDays(1));
  const [reason, setReason] = useState<string | null>(initialReason ?? null);
  const [otherText, setOtherText] = useState("");
  const [bookUnit, setBookUnit] = useState(true);

  const unitIds = leads
    .map((lead) => lead.linked_unit_id)
    .filter((id): id is string => Boolean(id));

  const finalReason =
    reason === OTHER_REASON && otherText.trim()
      ? `${OTHER_REASON}: ${otherText.trim()}`
      : reason;

  const valid =
    requirement === "next_step"
      ? title.trim().length > 0 && Boolean(dueDate)
      : requirement === "reason"
        ? Boolean(finalReason)
        : true;

  async function handleSubmit() {
    if (!valid || move.isPending) return;
    try {
      await move.mutateAsync({
        ids: leads.map((lead) => lead.id),
        stage_id: stage.id,
        close_reason: requirement === "reason" ? finalReason : null,
        next_step:
          requirement === "next_step"
            ? { title: title.trim(), due_date: dueDate, onlyIfNoOpenTask: bulk }
            : undefined,
        book_unit_ids:
          requirement === "won" && bookUnit && unitIds.length > 0 ? unitIds : undefined,
      });
      toast.success(
        `Moved ${leads.length} lead${leads.length === 1 ? "" : "s"} to ${stage.label}`
      );
      onDone();
    } catch {
      toast.error("Failed to update stage");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {requirement === "next_step" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="next-step-title">Next step</Label>
            <Input
              id="next-step-title"
              className="h-12"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow up"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="next-step-date">When</Label>
            <div className="flex flex-wrap gap-2">
              {NEXT_STEP_PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  active={dueDate === dateInDays(preset.days)}
                  onClick={() => setDueDate(dateInDays(preset.days))}
                >
                  {preset.label}
                </Chip>
              ))}
            </div>
            <Input
              id="next-step-date"
              type="date"
              className="h-12"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {bulk && (
              <p className="text-xs text-muted-foreground">
                Leads that already have an open task keep it and are not given another.
              </p>
            )}
          </div>
        </div>
      )}

      {requirement === "reason" && (
        <div className="flex flex-col gap-2">
          <Label>Reason</Label>
          <div className="flex flex-wrap gap-2">
            {CLOSE_REASONS.map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          {reason === OTHER_REASON && (
            <Input
              className="h-12"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Add details (optional)"
            />
          )}
        </div>
      )}

      {requirement === "won" &&
        (unitIds.length > 0 ? (
          <label className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <Checkbox
              checked={bookUnit}
              onCheckedChange={(checked) => setBookUnit(Boolean(checked))}
            />
            <span>
              Mark the linked unit{unitIds.length === 1 ? "" : "s"} as booked
              {unitIds.length > 1 && ` (${unitIds.length})`}
            </span>
          </label>
        ) : (
          <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            No unit is linked to {bulk ? "these leads" : "this lead"}. Link one on the lead to
            mark it booked.
          </p>
        ))}

      <Button className="h-12" disabled={!valid || move.isPending} onClick={handleSubmit}>
        {move.isPending ? "Saving…" : (submitLabel ?? `Move to ${stage.label}`)}
      </Button>
    </div>
  );
}
