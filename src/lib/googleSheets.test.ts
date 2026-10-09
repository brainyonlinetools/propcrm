import { describe, expect, it } from "vitest";
import { describeSheetsError } from "./googleSheets";

function gaxiosLike(message: string, code: unknown, status: unknown): Error {
  return Object.assign(new Error(message), { code, status });
}

describe("describeSheetsError", () => {
  it("translates the Google 404 into an actionable spreadsheet-access error", () => {
    const err = gaxiosLike("Requested entity was not found.", 404, 404);
    const message = describeSheetsError(err, { tab: "Leads" });
    expect(message).toContain('tab "Leads"');
    expect(message).toContain("GOOGLE_SHEET_ID");
    expect(message).toContain("bare spreadsheet ID");
  });

  it("detects the 404 from the message even without a status code", () => {
    const message = describeSheetsError(new Error("Requested entity was not found."), {
      tab: "Inventory",
    });
    expect(message).toContain("GOOGLE_SHEET_ID");
  });

  it("translates an unknown tab into an actionable tab-name error", () => {
    const err = gaxiosLike("Unable to parse range: Nope!A:ZZ", 400, 400);
    const message = describeSheetsError(err, { tab: "Nope" });
    expect(message).toContain('Tab "Nope"');
    expect(message).toContain("GOOGLE_SHEET_LEADS_TAB");
  });

  it("passes unrelated errors through untouched", () => {
    expect(describeSheetsError(new Error("boom"), { tab: "Leads" })).toBe("boom");
  });
});
