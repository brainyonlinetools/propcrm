"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";
import { StageMoveForm } from "./StageMoveForm";

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
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setSelectedStageId(null);
    onOpenChange(nextOpen);
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

          {selectedStage && leads.length > 0 && (
            <StageMoveForm
              key={selectedStage.id}
              leads={leads}
              stage={selectedStage}
              submitLabel={`Update ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
              onDone={() => {
                handleOpenChange(false);
                onComplete?.();
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
