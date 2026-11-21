import { addDays, format } from "date-fns";
import type { CallOutcome, Lead, PipelineStage, StageKind } from "@/types";

/** Reasons offered when a lead is marked Lost or Disqualified. */
export const CLOSE_REASONS = [
  "Not interested",
  "Wrong number",
  "Budget mismatch",
  "Not a buyer",
  "Duplicate",
  "Bought elsewhere",
  "Other",
] as const;

/** Next-step date presets, offered when a lead enters an active stage. */
export const NEXT_STEP_PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In a week", days: 7 },
] as const;

export function dateInDays(days: number, from: Date = new Date()): string {
  return format(addDays(from, days), "yyyy-MM-dd");
}

/** A lead with no stage is treated as sitting in the entry (raw) stage. */
export function leadStageKind(lead: Pick<Lead, "stage_id" | "pipeline_stages">): StageKind {
  if (lead.stage_id == null) return "entry";
  return lead.pipeline_stages?.kind ?? "active";
}

export function isEntryLead(lead: Pick<Lead, "stage_id" | "pipeline_stages">): boolean {
  return leadStageKind(lead) === "entry";
}

export function isClosedKind(kind: StageKind): boolean {
  return kind === "won" || kind === "lost" || kind === "disqualified";
}

export function isClosedLead(lead: Pick<Lead, "stage_id" | "pipeline_stages">): boolean {
  return isClosedKind(leadStageKind(lead));
}

export function isActiveLead(lead: Pick<Lead, "stage_id" | "pipeline_stages">): boolean {
  return leadStageKind(lead) === "active";
}

export type StageRequirement = "next_step" | "reason" | "won" | "none";

/** What the user must provide when moving a lead into a stage of this kind. */
export function stageRequirement(kind: StageKind): StageRequirement {
  switch (kind) {
    case "active":
      return "next_step";
    case "lost":
    case "disqualified":
      return "reason";
    case "won":
      return "won";
    default:
      return "none";
  }
}

/** Active-stage leads with no open task have no next step. */
export function needsNextStep(
  lead: Pick<Lead, "id" | "stage_id" | "pipeline_stages">,
  leadIdsWithOpenTask: ReadonlySet<string>
): boolean {
  return isActiveLead(lead) && !leadIdsWithOpenTask.has(lead.id);
}

export type ContactStatus = "untouched" | "attempted";

export function contactStatus(lead: Pick<Lead, "call_attempts">): ContactStatus {
  return lead.call_attempts > 0 ? "attempted" : "untouched";
}

/** "Untouched" or "Tried ×3 · 2d ago". */
export function attemptLabel(
  lead: Pick<Lead, "call_attempts" | "last_contacted_at">,
  now: Date = new Date()
): string {
  if (lead.call_attempts <= 0) return "Untouched";
  let label = `Tried ×${lead.call_attempts}`;
  if (lead.last_contacted_at) {
    const last = new Date(lead.last_contacted_at);
    const days = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
    if (!Number.isNaN(days)) {
      label += days <= 0 ? " · today" : ` · ${days}d ago`;
    }
  }
  return label;
}

export type OutcomeSuggestion =
  | { type: "qualify" }
  | { type: "disqualify"; reason: string }
  | { type: "call_back" }
  | { type: "retry_task" }
  | { type: "none" };

/**
 * What the app should offer after a call outcome. Only applies to leads that
 * are still in the entry stage or active stages (never to closed leads).
 */
export function suggestAfterCall(outcome: CallOutcome, kind: StageKind): OutcomeSuggestion {
  if (isClosedKind(kind)) return { type: "none" };
  switch (outcome) {
    case "connected":
      return kind === "entry" ? { type: "qualify" } : { type: "none" };
    case "not_interested":
      return { type: "disqualify", reason: "Not interested" };
    case "wrong_number":
      return { type: "disqualify", reason: "Wrong number" };
    case "callback":
      return { type: "call_back" };
    case "no_answer":
      return { type: "retry_task" };
  }
}

/** Find the stage of a given kind (first by sort order). */
export function findStageByKind(
  stages: PipelineStage[],
  kind: StageKind
): PipelineStage | undefined {
  return [...stages].sort((a, b) => a.sort_order - b.sort_order).find((s) => s.kind === kind);
}

/** Find the "Call Back" style active stage by label, falling back to nothing. */
export function findCallBackStage(stages: PipelineStage[]): PipelineStage | undefined {
  return stages.find((s) => s.kind === "active" && s.label.toLowerCase() === "call back");
}

/** First active stage — where a connected lead is qualified into. */
export function findFirstActiveStage(stages: PipelineStage[]): PipelineStage | undefined {
  return findStageByKind(stages, "active");
}
