"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBulkUpdateLeadStage } from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

interface BatchStageChangeSheetProps {
  leads: Lead[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function BatchStageChangeSheet({
  leads,
  open,
  onOpenChange,
  onComplete,
}: BatchStageChangeSheetProps) {
  const { data: stages = [] } = usePipelineStages();
  const bulkUpdate = useBulkUpdateLeadStage();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  function resetState() {
    setSelectedStageId(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleApply() {
    if (!selectedStageId || leads.length === 0) return;

    const stageLabel = stages.find((s) => s.id === selectedStageId)?.label ?? "stage";

    try {
      await bulkUpdate.mutateAsync({
        ids: leads.map((lead) => lead.id),
        stage_id: selectedStageId,
      });
      toast.success(
        `Updated ${leads.length} lead${leads.length === 1 ? "" : "s"} to ${stageLabel}`
      );
      handleOpenChange(false);
      onComplete?.();
    } catch {
      toast.error("Failed to update stages");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Change stage</SheetTitle>
          <SheetDescription>
            Move {leads.length} selected lead{leads.length === 1 ? "" : "s"} to a new stage.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          <ul className="rounded-lg border border-border bg-card p-3 text-sm">
            {leads.slice(0, 6).map((lead) => (
              <li key={lead.id} className="py-0.5">
                {lead.name}
              </li>
            ))}
            {leads.length > 6 && (
              <li className="pt-1 text-muted-foreground">+{leads.length - 6} more</li>
            )}
          </ul>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Select stage</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setSelectedStageId(stage.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                    selectedStageId === stage.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="h-12"
            disabled={!selectedStageId || bulkUpdate.isPending}
            onClick={handleApply}
          >
            {bulkUpdate.isPending
              ? "Updating…"
              : `Update ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
