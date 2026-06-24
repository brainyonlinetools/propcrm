import { describe, expect, it } from "vitest";
import {
  mapMetaRowToLead,
  parseMetaBudget,
  parseMetaConfiguration,
  parseMetaCreatedTime,
  parseMetaPhone,
} from "./metaLeadMapper";

describe("parseMetaPhone", () => {
  it("strips p: prefix and country code", () => {
    expect(parseMetaPhone("p:+918791051926")).toBe("8791051926");
    expect(parseMetaPhone("p:+916209590793")).toBe("6209590793");
  });
});

describe("parseMetaCreatedTime", () => {
  it("parses ISO datetime to date", () => {
    expect(parseMetaCreatedTime("2026-06-23T10:05:35+05:30")).toBe("2026-06-23");
    expect(parseMetaCreatedTime("2026-06-22T21:28:44+05:30")).toBe("2026-06-22");
  });
});

describe("parseMetaBudget", () => {
  it("parses budget slugs from sample rows", () => {
    expect(parseMetaBudget("2.5_cr_-_3.0_cr")).toBe(2.75);
    expect(parseMetaBudget("3.0_-_3.5_cr")).toBe(3.25);
    expect(parseMetaBudget("2.0_cr_-_2.5_cr")).toBe(2.25);
    expect(parseMetaBudget("more_than_3.5_cr")).toBe(3.5);
  });
});

describe("parseMetaConfiguration", () => {
  it("maps bhk slugs to CRM select values", () => {
    expect(parseMetaConfiguration("4bhk")).toBe("4BHK");
    expect(parseMetaConfiguration("3bhk")).toBe("3BHK");
  });
});

describe("mapMetaRowToLead", () => {
  it("maps Mukesh Thakur sample row", () => {
    const result = mapMetaRowToLead(
      {
        id: "l:1180939454183866",
        created_time: "2026-06-22T21:28:44+05:30",
        form_name: "Fresh 2026 (Emaar & SS)",
        campaign_name: "SS Camasa",
        "what_is_your_budget_for_investment?": "2.0_cr_-_2.5_cr",
        what_is_your_preferred_size: "4bhk",
        full_name: "Mukesh Thakur",
        phone_number: "p:+916209590793",
        email: "mukeshthakor6209590793@gmail.com",
        lead_status: "CREATED",
        platform: "ig",
      },
      { sheetRow: 42, sheetId: "sheet-123", defaultStageId: "stage-new" }
    );

    expect(result.lead).toMatchObject({
      name: "Mukesh Thakur",
      phone: "6209590793",
      email: "mukeshthakor6209590793@gmail.com",
      source: "Meta",
      project_interest: "SS Camasa",
      acquired_date: "2026-06-22",
      stage_id: "stage-new",
    });
    expect(result.lead?.custom_data).toMatchObject({
      budget: 2.25,
      configuration: "4BHK",
      meta_lead_id: "l:1180939454183866",
      meta_budget_raw: "2.0_cr_-_2.5_cr",
      imported_from_sheet: true,
      sheet_row: 42,
      platform: "ig",
      campaign_name: "SS Camasa",
      form_name: "Fresh 2026 (Emaar & SS)",
    });
  });

  it("falls back to form_name when campaign_name is empty", () => {
    const result = mapMetaRowToLead(
      {
        full_name: "Test Lead",
        form_name: "Fresh 2026 (Emaar & SS)",
        campaign_name: "",
      },
      { sheetRow: 1, defaultStageId: "stage-new" }
    );

    expect(result.lead?.project_interest).toBe("Fresh 2026 (Emaar & SS)");
  });
});
