import { describe, expect, it } from "vitest";
import {
  mapConnectedInventoryRow,
  mapConnectedLeadRow,
  parseBudgetCr,
  parseSheetDate,
  parseSheetPhone,
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
  });

  it("returns null for empty or unparsable values", () => {
    expect(parseBudgetCr("")).toBeNull();
    expect(parseBudgetCr(undefined)).toBeNull();
    expect(parseBudgetCr("lots")).toBeNull();
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

  it("requires a name", () => {
    const result = mapConnectedLeadRow({ Phone: "9876543210" }, opts);
    expect(result.lead).toBeNull();
    expect(result.error).toBe("Name is required");
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
