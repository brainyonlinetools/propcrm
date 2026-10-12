import { describe, expect, it } from "vitest";
import {
  canonicalFromAppLead,
  canonicalFromSheetRow,
  formatCanonicalForSheet,
  isBlankCanon,
  isRangedBudget,
  looksLikeHeaderRow,
  mapConnectedInventoryRow,
  mapConnectedLeadRow,
  normalizeSheetText,
  parseBudgetCr,
  parseSheetDate,
  parseSheetPhone,
  readSnapshot,
  resolveField,
  seedSheetSnapshot,
  type LeadCanonical,
} from "@/lib/connectedSheetMapper";
import type { PipelineStage, Project } from "@/types";

const stages = [
  { id: "s-new", label: "New", color: "#888", sort_order: 0 },
  { id: "s-qual", label: "Qualified", color: "#0070f3", sort_order: 1 },
  { id: "s-visit", label: "Site Visit", color: "#7928ca", sort_order: 2 },
] as PipelineStage[];

const projects = [{ id: "p1", name: "Anand Prime Residences" }] as Project[];

describe("parseSheetDate", () => {
  it("parses ISO dates", () => {
    expect(parseSheetDate("2026-10-09")).toBe("2026-10-09");
  });

  it("parses day-first Indian dates", () => {
    expect(parseSheetDate("09/10/2026")).toBe("2026-10-09");
    expect(parseSheetDate("9-10-2026")).toBe("2026-10-09");
  });

  it("returns null for empty or invalid dates", () => {
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate(undefined)).toBeNull();
    expect(parseSheetDate("not a date")).toBeNull();
    expect(parseSheetDate("2026-13-45")).toBeNull();
  });

  it("parses two-digit-year day-first dates", () => {
    expect(parseSheetDate("24/11/24")).toBe("2024-11-24");
    expect(parseSheetDate("22/1/25")).toBe("2025-01-22");
    expect(parseSheetDate("26-5-26")).toBe("2026-05-26");
    expect(parseSheetDate("26.5.26")).toBe("2026-05-26");
    expect(parseSheetDate("09/10/68")).toBe("2068-10-09");
    expect(parseSheetDate("09/10/69")).toBe("1969-10-09");
    expect(parseSheetDate("32/13/24")).toBeNull();
  });
});

describe("parseSheetPhone", () => {
  it("normalizes Indian numbers", () => {
    expect(parseSheetPhone("9876543210")).toBe("9876543210");
    expect(parseSheetPhone("+91 98765 43210")).toBe("9876543210");
    expect(parseSheetPhone("919876543210")).toBe("9876543210");
  });

  it("returns null for empty values", () => {
    expect(parseSheetPhone("")).toBeNull();
    expect(parseSheetPhone(undefined)).toBeNull();
  });
});

describe("parseBudgetCr", () => {
  it("parses Cr values", () => {
    expect(parseBudgetCr("2.8")).toBe(2.8);
    expect(parseBudgetCr("2.5 Cr")).toBe(2.5);
    expect(parseBudgetCr("₹2.5cr")).toBe(2.5);
  });

  it("converts lakhs and full rupees", () => {
    expect(parseBudgetCr("50 L")).toBe(0.5);
    expect(parseBudgetCr("25000000")).toBe(2.5);
    expect(parseBudgetCr("2,85,00,000")).toBe(2.85);
    expect(parseBudgetCr("₹11,000")).toBeCloseTo(0.0011, 6);
  });

  it("parses ranges to the midpoint", () => {
    expect(parseBudgetCr("₹1.5 Cr - ₹2.0 Cr")).toBe(1.75);
    expect(parseBudgetCr("₹2.5 Cr - ₹3.5 Cr")).toBe(3);
    expect(parseBudgetCr("₹1.8 Cr - ₹2.0 Cr")).toBe(1.9);
    expect(parseBudgetCr("₹50 Lac - ₹1.0 Cr")).toBe(0.75);
    expect(parseBudgetCr("₹3.0 Cr - ₹4.0 Cr")).toBe(3.5);
    expect(parseBudgetCr("₹1.0 Cr - ₹2.0 Cr")).toBe(1.5);
    expect(parseBudgetCr("1.5 - 2.0 Cr")).toBe(1.75);
  });

  it("parses open bounds to the bound", () => {
    expect(parseBudgetCr("₹3.5 Cr+")).toBe(3.5);
    expect(parseBudgetCr("₹2.5 Cr+")).toBe(2.5);
    expect(parseBudgetCr("₹4.0 Cr+")).toBe(4);
    expect(parseBudgetCr("₹2.0 Cr+")).toBe(2);
    expect(parseBudgetCr("< ₹50 Lac")).toBe(0.5);
  });

  it("returns null for empty or unparsable values", () => {
    expect(parseBudgetCr("")).toBeNull();
    expect(parseBudgetCr(undefined)).toBeNull();
    expect(parseBudgetCr("lots")).toBeNull();
  });
});

describe("isRangedBudget", () => {
  it("detects range and bound markers", () => {
    expect(isRangedBudget("₹1.5 Cr - ₹2.0 Cr")).toBe(true);
    expect(isRangedBudget("₹3.5 Cr+")).toBe(true);
    expect(isRangedBudget("< ₹50 Lac")).toBe(true);
    expect(isRangedBudget("2.5 Cr")).toBe(false);
    expect(isRangedBudget("50 L")).toBe(false);
  });
});

describe("normalizeSheetText", () => {
  it("blanks placeholder fillers and keeps real values", () => {
    expect(normalizeSheetText("-")).toBe("");
    expect(normalizeSheetText("  NA ")).toBe("");
    expect(normalizeSheetText("n/a")).toBe("");
    expect(normalizeSheetText("Emaar Palm Hills")).toBe("Emaar Palm Hills");
    expect(normalizeSheetText("SS Cendana")).toBe("SS Cendana");
  });
});

describe("looksLikeHeaderRow", () => {
  it("flags rows reusing export header names", () => {
    expect(
      looksLikeHeaderRow({ Name: "full_name", Email: "email", Source: "Meta" })
    ).toBe(true);
    expect(
      looksLikeHeaderRow({ Name: "campaign_name", "Project Interest": "adset_name" })
    ).toBe(true);
  });

  it("passes real leads, even with one header-like cell", () => {
    expect(looksLikeHeaderRow({ Name: "Rahul", Email: "r@example.com" })).toBe(false);
    expect(looksLikeHeaderRow({ Name: "full_name", Phone: "9876543210" })).toBe(false);
  });
});

describe("mapConnectedLeadRow", () => {
  const opts = { sheetRow: 2, sheetId: "sheet1", sheetTab: "Leads", stages };

  it("maps a full buyer row", () => {
    const { lead, note, warnings, error } = mapConnectedLeadRow(
      {
        Date: "09/10/2026",
        Name: "Rajesh Malhotra",
        Phone: "+91 98765 43210",
        Email: "Rajesh@Email.com",
        Stage: "Qualified",
        Source: "Walk-in",
        "Lead Type": "Buyer",
        "Project Interest": "Anand Prime Residences",
        Budget: "2.8 Cr",
        "Last Date of Call": "08/10/2026",
        Notes: "Wants east facing",
      },
      opts
    );
    expect(error).toBeUndefined();
    expect(warnings).toEqual([]);
    expect(note).toBe("Wants east facing");
    expect(lead).toMatchObject({
      name: "Rajesh Malhotra",
      phone: "9876543210",
      email: "rajesh@email.com",
      source: "Walk-in",
      stage_id: "s-qual",
      project_interest: "Anand Prime Residences",
      acquired_date: "2026-10-09",
    });
    expect(lead?.custom_data).toMatchObject({
      imported_from_sheet: true,
      sheet_id: "sheet1",
      sheet_tab: "Leads",
      sheet_row: 2,
      lead_type: "Buyer",
      budget: 2.8,
      last_call_date: "2026-10-08",
    });
  });

  it("assigns a placeholder name instead of skipping nameless rows", () => {
    const { lead, warnings, error } = mapConnectedLeadRow({ Phone: "9876543210" }, opts);
    expect(error).toBeUndefined();
    expect(lead?.name).toBe("Lead 2");
    expect(lead?.phone).toBe("9876543210");
    expect(warnings).toEqual(['Missing name, used "Lead 2"']);
  });

  it("falls back to the default stage with a warning", () => {
    const { lead, warnings } = mapConnectedLeadRow(
      { Name: "X", Stage: "Random" },
      opts
    );
    expect(lead?.stage_id).toBe("s-new");
    expect(warnings).toEqual(['Unknown stage "Random", used default']);
  });

  it("warns on unparsable budget but still maps", () => {
    const { lead, warnings } = mapConnectedLeadRow(
      { Name: "X", Budget: "lots" },
      opts
    );
    expect(lead).not.toBeNull();
    expect(warnings).toEqual(['Could not parse budget "lots"']);
  });

  it("maps a ranged budget to the midpoint and keeps the raw text", () => {
    const { lead, warnings, error } = mapConnectedLeadRow(
      { Name: "X", Budget: "₹1.5 Cr - ₹2.0 Cr" },
      opts
    );
    expect(error).toBeUndefined();
    expect(warnings).toEqual([]);
    expect(lead?.custom_data).toMatchObject({
      budget: 1.75,
      budget_raw: "₹1.5 Cr - ₹2.0 Cr",
    });
  });

  it("omits budget_raw for plain single values", () => {
    const { lead } = mapConnectedLeadRow({ Name: "X", Budget: "2.5 Cr" }, opts);
    expect(lead?.custom_data).toMatchObject({ budget: 2.5 });
    expect(lead?.custom_data).not.toHaveProperty("budget_raw");
  });

  it("skips pasted header rows instead of importing them as leads", () => {
    const result = mapConnectedLeadRow(
      {
        Name: "full_name",
        Email: "email",
        Source: "Meta",
        "Project Interest": "campaign_name",
      },
      opts
    );
    expect(result.lead).toBeNull();
    expect(result.skipped).toBe("looks like a header row");
  });

  it("skips rows with no name and no contact info", () => {
    const result = mapConnectedLeadRow({ Stage: "New" }, opts);
    expect(result.lead).toBeNull();
    expect(result.skipped).toBe("row has no name or contact info");
  });

  it("treats placeholder fillers as empty, not literal values", () => {
    const { lead } = mapConnectedLeadRow(
      { Name: "Himanshu", Phone: "9953240037", Email: "-", Source: "NA" },
      opts
    );
    expect(lead?.email).toBeNull();
    expect(lead?.source).toBeNull();
  });

  it("splits multi-number phone cells into phone, alt, and extras", () => {
    const { lead } = mapConnectedLeadRow(
      { Name: "X", Phone: "+91 98765 43210, 9811111111, 9822222222" },
      opts
    );
    expect(lead?.phone).toBe("9876543210");
    expect(lead?.alt_phone).toBe("9811111111");
    expect(lead?.custom_data).toMatchObject({
      additional_phones: ["9822222222"],
    });
  });

  it("normalizes short-year dates and warns on unparsable ones", () => {
    const { lead, warnings } = mapConnectedLeadRow(
      { Name: "X", Date: "24/11/24" },
      opts
    );
    expect(lead?.acquired_date).toBe("2024-11-24");
    expect(warnings).toEqual([]);

    const bad = mapConnectedLeadRow({ Name: "X", Date: "someday" }, opts);
    expect(bad.lead?.acquired_date).toBeNull();
    expect(bad.warnings).toEqual(['Could not parse date "someday"']);
  });
});

describe("mapConnectedInventoryRow", () => {
  const opts = { sheetRow: 3, sheetId: "sheet1", sheetTab: "Inventory", projects };

  it("maps a full inventory row", () => {
    const { unit, note, warnings, error } = mapConnectedInventoryRow(
      {
        Date: "2026-09-01",
        "Unit Number": "A-1204",
        Project: "Anand Prime Residences",
        Type: "3BHK",
        "Area (sq.ft.)": "1,850",
        Price: "28500000",
        Status: "available",
        Floor: "12",
        Facing: "East",
        Parking: "2",
        "Owner Name": "Ramesh Agarwal",
        "Owner Phone": "9811111111",
        Remarks: "Corner unit",
      },
      opts
    );
    expect(error).toBeUndefined();
    expect(warnings).toEqual([]);
    expect(note).toBe("Corner unit");
    expect(unit).toMatchObject({
      unit_number: "A-1204",
      project_id: "p1",
      unit_type: "3BHK",
      area_sqft: 1850,
      price: 28500000,
      status: "available",
      acquired_date: "2026-09-01",
    });
    expect(unit?.custom_data).toMatchObject({
      imported_from_sheet: true,
      sheet_id: "sheet1",
      sheet_tab: "Inventory",
      sheet_row: 3,
      floor: 12,
      facing: "East",
      car_parking: 2,
      owner_name: "Ramesh Agarwal",
      owner_phone: "9811111111",
    });
  });

  it("requires a unit number", () => {
    const result = mapConnectedInventoryRow({ Project: "Anand Prime Residences" }, opts);
    expect(result.unit).toBeNull();
    expect(result.error).toBe("Unit Number is required");
  });

  it("rejects unknown projects", () => {
    const result = mapConnectedInventoryRow(
      { "Unit Number": "A-1", Project: "Unknown Towers" },
      opts
    );
    expect(result.unit).toBeNull();
    expect(result.error).toBe('Unknown project "Unknown Towers"');
  });

  it("warns on unparsable dates but still maps", () => {
    const { unit, warnings } = mapConnectedInventoryRow(
      { "Unit Number": "A-1", Date: "someday" },
      opts
    );
    expect(unit?.acquired_date).toBeNull();
    expect(warnings).toEqual(['Could not parse date "someday"']);
  });

  it("defaults invalid status with a warning", () => {
    const { unit, warnings } = mapConnectedInventoryRow(
      { "Unit Number": "A-1", Status: "maybe" },
      opts
    );
    expect(unit?.status).toBe("available");
    expect(warnings).toEqual(['Unknown status "maybe", used available']);
  });

  it("keeps the first owner phone and moves extras to the note", () => {
    const { unit, note, warnings } = mapConnectedInventoryRow(
      { "Unit Number": "A-1", "Owner Phone": "9811111111, 9822222222" },
      opts
    );
    expect(unit?.custom_data).toMatchObject({ owner_phone: "9811111111" });
    expect(note).toBe("Other phones: 9822222222");
    expect(warnings).toEqual(["Extra owner phone kept in remarks: 9822222222"]);
  });
});

describe("resolveField", () => {
  it("detects which side changed against the snapshot", () => {
    expect(resolveField("a", "a", "a")).toBe("none");
    expect(resolveField("a", "b", "a")).toBe("toApp");
    expect(resolveField("a", "a", "b")).toBe("toSheet");
    expect(resolveField("a", "b", "c")).toBe("conflict");
    expect(resolveField(null, 1.75, null)).toBe("toApp");
    expect(resolveField(1.75, 1.75, 2)).toBe("toSheet");
  });
});

describe("isBlankCanon", () => {
  it("treats null and empty string as blank", () => {
    expect(isBlankCanon(null)).toBe(true);
    expect(isBlankCanon("")).toBe(true);
    expect(isBlankCanon("x")).toBe(false);
    expect(isBlankCanon(0)).toBe(false);
  });
});

describe("seedSheetSnapshot", () => {
  const sheet: LeadCanonical = {
    name: "Sheet Name",
    phone: "9811111111",
    email: "s@x.com",
    stage: "New",
    source: "Meta",
    leadType: "Buyer",
    project: "P",
    budget: 1.75,
    date: "2026-10-09",
    lastCall: null,
  };
  const app: LeadCanonical = {
    name: "App Name",
    phone: "9822222222",
    email: "a@x.com",
    stage: "Qualified",
    source: "Walk-in",
    leadType: "",
    project: "",
    budget: null,
    date: null,
    lastCall: null,
  };

  it("seeds stage from the sheet and everything else from the app", () => {
    expect(seedSheetSnapshot(sheet, app)).toEqual({ ...app, stage: "New" });
  });

  it("seeds a null stage from the app when uninitialized", () => {
    const noStage = { ...app, stage: null };
    expect(seedSheetSnapshot(sheet, noStage).stage).toBeNull();
    expect(seedSheetSnapshot({ ...sheet, stage: null }, noStage).stage).toBeNull();
  });
});

describe("readSnapshot", () => {
  it("returns null for missing or malformed snapshots", () => {
    expect(readSnapshot(null)).toBeNull();
    expect(readSnapshot({})).toBeNull();
    expect(readSnapshot({ sheet_snapshot: "nope" })).toBeNull();
  });

  it("reads a stored snapshot defensively", () => {
    const snap = readSnapshot({
      sheet_snapshot: { name: "X", budget: 2, stage: "New", extra: true },
    });
    expect(snap).toMatchObject({ name: "X", budget: 2, stage: "New" });
    expect(snap?.phone).toBe("");
    expect(snap?.date).toBeNull();
  });
});

describe("canonical merge round-trip", () => {
  const row = {
    Date: "09/10/2026",
    Name: "Rajesh Malhotra",
    Phone: "+91 98765 43210, 9811111111",
    Email: "Rajesh@Email.com",
    Stage: "Qualified",
    Source: "Walk-in",
    "Lead Type": "Buyer",
    "Project Interest": "Anand Prime Residences",
    Budget: "₹1.5 Cr - ₹2.0 Cr",
    "Last Date of Call": "08/10/2026",
  };

  it("reduces sheet and app sides to the same canonical form", () => {
    const sheetCanon = canonicalFromSheetRow(row, stages);
    expect(sheetCanon).toEqual({
      name: "Rajesh Malhotra",
      phone: "9876543210, 9811111111",
      email: "rajesh@email.com",
      stage: "Qualified",
      source: "Walk-in",
      leadType: "Buyer",
      project: "Anand Prime Residences",
      budget: 1.75,
      date: "2026-10-09",
      lastCall: "2026-10-08",
    });
    const appCanon = canonicalFromAppLead(
      {
        name: "Rajesh Malhotra",
        phone: "9876543210",
        alt_phone: "9811111111",
        email: "rajesh@email.com",
        source: "Walk-in",
        stage_id: "s-qual",
        project_interest: "Anand Prime Residences",
        acquired_date: "2026-10-09",
        custom_data: {
          lead_type: "Buyer",
          budget: 1.75,
          budget_raw: "₹1.5 Cr - ₹2.0 Cr",
          last_call_date: "2026-10-08",
          additional_phones: [],
        },
      },
      stages
    );
    expect(appCanon).toEqual(sheetCanon);
  });

  it("formats canonical values back to parse-stable sheet cells", () => {
    const canon = canonicalFromSheetRow(row, stages);
    const cells = formatCanonicalForSheet(canon);
    expect(cells).toMatchObject({
      Name: "Rajesh Malhotra",
      Phone: "9876543210, 9811111111",
      Email: "rajesh@email.com",
      Stage: "Qualified",
      Budget: "1.75 Cr",
      Date: "2026-10-09",
      "Last Date of Call": "2026-10-08",
    });
    // Formatting round-trips: re-parsing yields the same canonical form.
    expect(canonicalFromSheetRow(cells, stages)).toEqual(canon);
  });

  it("maps unknown sheet stages to null so merges skip them", () => {
    expect(canonicalFromSheetRow({ Stage: "Random" }, stages).stage).toBeNull();
    expect(canonicalFromSheetRow({}, stages).stage).toBeNull();
  });
});
