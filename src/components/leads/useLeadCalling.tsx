"use client";

import { toast } from "sonner";
import { StageMoveForm } from "@/components/leads/StageMoveForm";
import type { CallQueueContact, FollowUpPrompt } from "@/components/shared/CallQueueSheet";
import { useLeads } from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { fetchOpenTaskLeadIds, useMoveLeads } from "@/lib/queries/leadMoves";
import { useCreateLeadNote, useCreateTask } from "@/lib/queries/tasks";
import {
  dateInDays,
  findCallBackStage,
  findFirstActiveStage,
  findStageByKind,
  isClosedLead,
  leadStageKind,
  suggestAfterCall,
} from "@/lib/leadFlow";
import { CALL_OUTCOME_LABELS, type CallOutcome, type Lead } from "@/types";

/** One queue entry per phone number of each lead (primary, alt, additional). */
export function buildCallContacts(leads: Lead[]): CallQueueContact[] {
  return leads.flatMap((lead) => {
        const base =
          [lead.pipeline_stages?.label, lead.project_interest]
            .filter(Boolean)
            .join(" · ") || null;
        const additional: string[] = Array.isArray(lead.custom_data?.additional_phones)
          ? (lead.custom_data.additional_phones as unknown[]).filter(
              (p): p is string => typeof p === "string" && Boolean(p)
            )
          : [];
        const numbers: { phone: string; tag: string | null }[] = [];
        if (lead.phone) numbers.push({ phone: lead.phone, tag: null });
        if (lead.alt_phone) numbers.push({ phone: lead.alt_phone, tag: "Alt" });
        additional.forEach((phone, i) =>
          numbers.push({ phone, tag: `Phone ${i + 3}` })
        );
        const seen = new Set<string>();
        return numbers
          .filter(({ phone }) => {
            if (seen.has(phone)) return false;
            seen.add(phone);
            return true;
          })
          .map(({ phone, tag }, i) => ({
            id: `${lead.id}:${i}`,
            recordId: lead.id,
            name: lead.name,
            phone,
            subtitle: [base, tag].filter(Boolean).join(" · ") || null,
          }));
      });
}

/** Shared call-outcome logging + follow-through, used by the Leads, Today and call-return flows. */
export function useLeadCalling() {
  const { data: leads = [] } = useLeads();
  const { data: stages = [] } = usePipelineStages();
  const moveLeads = useMoveLeads();
  const createLeadNote = useCreateLeadNote();
  const createTask = useCreateTask();

  async function logOutcome(
    contact: CallQueueContact,
    outcome: CallOutcome,
    opts?: { note?: string; followUpDate?: string }
  ) {
    const label = CALL_OUTCOME_LABELS[outcome];
    try {
      await createLeadNote.mutateAsync({
        lead_id: contact.recordId,
        content: opts?.note
          ? `Call (${label}) ${contact.phone}: ${opts.note}`
          : `Call (${label}) ${contact.phone}`,
        note_type: "call",
      });
      if (outcome === "callback" && opts?.followUpDate) {
        await createTask.mutateAsync({
          lead_id: contact.recordId,
          title: `Call back ${contact.name}`,
          due_date: opts.followUpDate,
          due_time: null,
        });
      }
      toast.success(`${contact.name} — ${label}`);
    } catch {
      toast.error(`Failed to log call for ${contact.name}`);
      throw new Error("call-log-failed");
    }

    // Outcome-driven follow-through. The call itself is already logged, so a
    // failure here only affects the extra step and never blocks the queue.
    const lead = leads.find((l) => l.id === contact.recordId);
    if (!lead || isClosedLead(lead)) return;
    try {
      if (outcome === "callback") {
        const callBack = findCallBackStage(stages);
        if (callBack && lead.stage_id !== callBack.id) {
          await moveLeads.mutateAsync({ ids: [lead.id], stage_id: callBack.id });
        }
      } else if (outcome === "no_answer") {
        const hasTask = (await fetchOpenTaskLeadIds([lead.id])).has(lead.id);
        if (!hasTask) {
          await createTask.mutateAsync({
            lead_id: lead.id,
            title: `Call ${contact.name} again`,
            due_date: dateInDays(1),
            due_time: null,
          });
          toast.info(`Follow-up set for tomorrow`);
        }
      }
    } catch {
      toast.warning(`Call logged, but the follow-up for ${contact.name} could not be set`);
    }
  }

  function followUpForOutcome(
    contact: CallQueueContact,
    outcome: CallOutcome
  ): FollowUpPrompt | null {
    const lead = leads.find((l) => l.id === contact.recordId);
    if (!lead) return null;
    const suggestion = suggestAfterCall(outcome, leadStageKind(lead));

    if (suggestion.type === "qualify") {
      const stage = findFirstActiveStage(stages);
      if (!stage) return null;
      return {
        title: `Qualify ${lead.name}?`,
        description: `Move to ${stage.label} and set a next step.`,
        skipLabel: "Not yet",
        render: (done) => (
          <StageMoveForm leads={[lead]} stage={stage} submitLabel="Qualify" onDone={done} />
        ),
      };
    }
    if (suggestion.type === "disqualify") {
      const stage = findStageByKind(stages, "disqualified");
      if (!stage) return null;
      return {
        title: `Disqualify ${lead.name}?`,
        description: "Moves the lead out of your working lists.",
        skipLabel: "Keep as is",
        render: (done) => (
          <StageMoveForm
            leads={[lead]}
            stage={stage}
            initialReason={suggestion.reason}
            submitLabel="Disqualify"
            onDone={done}
          />
        ),
      };
    }
    return null;
  }
  return { logOutcome, followUpForOutcome };
}
