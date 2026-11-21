import { describe, expect, it } from "vitest";
import {
  attemptLabel,
  contactStatus,
  findCallBackStage,
  findFirstActiveStage,
  isClosedLead,
  isEntryLead,
  leadStageKind,
  needsNextStep,
  stageRequirement,
  suggestAfterCall,
} from "./leadFlow";
import type { PipelineStage, StageKind } from "@/types";

function stage(label: string, kind: StageKind, sort_order: number): PipelineStage {
  return { id: label, label, color: "#000", sort_order, kind };
}

const stages = [
  stage("New", "entry", 0),
  stage("Qualified", "active", 1),
  stage("Call Back", "active", 2),
  stage("Closed (Won)", "won", 5),
  stage("Lost", "lost", 6),
];

describe("lead stage kinds", () => {
  it("treats a lead with no stage as entry", () => {
    expect(leadStageKind({ stage_id: null, pipeline_stages: null })).toBe("entry");
    expect(isEntryLead({ stage_id: null })).toBe(true);
  });

  it("reads the kind from the joined stage", () => {
    const lead = { stage_id: "Lost", pipeline_stages: stages[4] };
    expect(leadStageKind(lead)).toBe("lost");
    expect(isClosedLead(lead)).toBe(true);
  });

  it("maps stage kinds to what the user must provide", () => {
    expect(stageRequirement("active")).toBe("next_step");
    expect(stageRequirement("lost")).toBe("reason");
    expect(stageRequirement("disqualified")).toBe("reason");
    expect(stageRequirement("won")).toBe("won");
    expect(stageRequirement("entry")).toBe("none");
  });
});

describe("needsNextStep", () => {
  const lead = { id: "a", stage_id: "Qualified", pipeline_stages: stages[1] };
  it("flags active leads without an open task", () => {
    expect(needsNextStep(lead, new Set())).toBe(true);
    expect(needsNextStep(lead, new Set(["a"]))).toBe(false);
  });
  it("ignores entry and closed leads", () => {
    expect(needsNextStep({ id: "b", stage_id: null, pipeline_stages: null }, new Set())).toBe(false);
    expect(needsNextStep({ id: "c", stage_id: "Lost", pipeline_stages: stages[4] }, new Set())).toBe(false);
  });
});

describe("attempt tracking", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  it("labels untouched and attempted leads", () => {
    expect(contactStatus({ call_attempts: 0 })).toBe("untouched");
    expect(attemptLabel({ call_attempts: 0, last_contacted_at: null }, now)).toBe("Untouched");
    expect(
      attemptLabel({ call_attempts: 3, last_contacted_at: "2026-11-19T12:00:00Z" }, now)
    ).toBe("Tried ×3 · 2d ago");
    expect(
      attemptLabel({ call_attempts: 1, last_contacted_at: "2026-11-21T08:00:00Z" }, now)
    ).toBe("Tried ×1 · today");
  });
});

describe("suggestAfterCall", () => {
  it("suggests qualifying only for connected entry leads", () => {
    expect(suggestAfterCall("connected", "entry")).toEqual({ type: "qualify" });
    expect(suggestAfterCall("connected", "active")).toEqual({ type: "none" });
  });
  it("suggests disqualifying with a reason", () => {
    expect(suggestAfterCall("not_interested", "entry")).toEqual({
      type: "disqualify",
      reason: "Not interested",
    });
    expect(suggestAfterCall("wrong_number", "active")).toEqual({
      type: "disqualify",
      reason: "Wrong number",
    });
  });
  it("maps callback and no answer", () => {
    expect(suggestAfterCall("callback", "entry")).toEqual({ type: "call_back" });
    expect(suggestAfterCall("no_answer", "entry")).toEqual({ type: "retry_task" });
  });
  it("never suggests anything for closed leads", () => {
    expect(suggestAfterCall("not_interested", "lost")).toEqual({ type: "none" });
  });
});

describe("stage lookup", () => {
  it("finds the call back and first active stages", () => {
    expect(findCallBackStage(stages)?.label).toBe("Call Back");
    expect(findFirstActiveStage(stages)?.label).toBe("Qualified");
  });
});
