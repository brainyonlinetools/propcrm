"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { stageRequirement } from "@/lib/leadFlow";
import { useMoveLeads } from "@/lib/queries/leadMoves";
import type { Lead, PipelineStage } from "@/types";
import { StageMoveForm } from "./StageMoveForm";

interface PendingMove {
  leads: Lead[];
  stage: PipelineStage;
}

/**
 * Single entry point for changing a lead's stage from the detail screen or the
 * kanban. Stages that need nothing move immediately; the others open a sheet
 * asking for the next step, close reason or unit booking.
 */
export function useStageChangeFlow() {
  const move = useMoveLeads();
  const [pending, setPending] = useState<PendingMove | null>(null);

  async function requestMove(leads: Lead[], stage: PipelineStage) {
    if (leads.length === 0) return;
    if (stageRequirement(stage.kind) !== "none") {
      setPending({ leads, stage });
      return;
    }
    try {
      await move.mutateAsync({ ids: leads.map((l) => l.id), stage_id: stage.id });
      toast.success("Stage updated");
    } catch {
      toast.error("Failed to update stage");
    }
  }

  const stageDialog = (
    <Sheet open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
      <SheetContent side="bottom" className="max-h-[90dvh] rounded-t-xl">
        {pending && (
          <>
            <SheetHeader>
              <SheetTitle>Move to {pending.stage.label}</SheetTitle>
              <SheetDescription>
                {pending.leads.length === 1
                  ? pending.leads[0].name
                  : `${pending.leads.length} leads`}
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <StageMoveForm
                key={pending.stage.id}
                leads={pending.leads}
                stage={pending.stage}
                onDone={() => setPending(null)}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );

  return { requestMove, stageDialog };
}
