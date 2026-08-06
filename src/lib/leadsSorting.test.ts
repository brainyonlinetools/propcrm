import { describe, expect, it } from "vitest";
import { findLeadByPhone, sortLeadsByDateDesc } from "@/lib/queries/leads";
import { normalizePhoneKey } from "@/lib/utils";
import type { Lead } from "@/types";

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: "1",
    name: "Lead",
    phone: null,
    email: null,
    stage_id: null,
    source: null,
    project_interest: null,
    linked_unit_id: null,
    acquired_date: null,
    custom_data: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizePhoneKey", () => {
  it("matches 10-digit and +91 variants", () => {
    expect(normalizePhoneKey("9876543210")).toBe("9876543210");
    expect(normalizePhoneKey("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhoneKey("919876543210")).toBe("9876543210");
  });
});

describe("findLeadByPhone", () => {
  const leads = [
    makeLead({ id: "a", name: "Asha", phone: "9876543210" }),
    makeLead({ id: "b", name: "Bala", phone: "+91 91234 56789" }),
  ];

  it("finds duplicates across formats", () => {
    expect(findLeadByPhone(leads, "919876543210")?.id).toBe("a");
    expect(findLeadByPhone(leads, "9123456789")?.id).toBe("b");
  });

  it("excludes the current lead when editing", () => {
    expect(findLeadByPhone(leads, "9876543210", "a")).toBeNull();
  });
});

describe("sortLeadsByDateDesc", () => {
  it("sorts by acquired_date then created_at, newest first", () => {
    const sorted = sortLeadsByDateDesc([
      makeLead({ id: "old", acquired_date: "2026-01-01", created_at: "2026-06-01T00:00:00.000Z" }),
      makeLead({ id: "new", acquired_date: "2026-08-01", created_at: "2026-01-01T00:00:00.000Z" }),
      makeLead({ id: "no-acq", acquired_date: null, created_at: "2026-07-15T00:00:00.000Z" }),
    ]);
    expect(sorted.map((l) => l.id)).toEqual(["new", "no-acq", "old"]);
  });
});
