import { describe, expect, it } from "vitest";
import { describeSheetsError, sheetRowMatchesIdentity } from "./googleSheets";

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

describe("sheetRowMatchesIdentity", () => {
  it("matches phones across formatting variants", () => {
    expect(
      sheetRowMatchesIdentity(["Name", "Phone"], ["X", "p:+91 98765 43210"], [
        { header: "Phone", expected: "919876543210", kind: "phone" },
      ])
    ).toBe(true);
  });

  it("rejects phone mismatches", () => {
    expect(
      sheetRowMatchesIdentity(["Name", "Phone"], ["X", "9811111111"], [
        { header: "Phone", expected: "9876543210", kind: "phone" },
      ])
    ).toBe(false);
  });

  it("matches emails case-insensitively with case-insensitive headers", () => {
    expect(
      sheetRowMatchesIdentity(["name", "email"], ["X", "User@Example.com"], [
        { header: "Email", expected: "user@example.com", kind: "text" },
      ])
    ).toBe(true);
  });

  it("requires every check to pass", () => {
    const headers = ["Phone", "Email"];
    const values = ["9876543210", "other@example.com"];
    expect(
      sheetRowMatchesIdentity(headers, values, [
        { header: "Phone", expected: "9876543210", kind: "phone" },
        { header: "Email", expected: "user@example.com", kind: "text" },
      ])
    ).toBe(false);
  });

  it("fails on missing columns or empty cells, passes with no checks", () => {
    expect(
      sheetRowMatchesIdentity(["Name"], ["X"], [
        { header: "Phone", expected: "9876543210", kind: "phone" },
      ])
    ).toBe(false);
    expect(
      sheetRowMatchesIdentity(["Phone"], [""], [
        { header: "Phone", expected: "9876543210", kind: "phone" },
      ])
    ).toBe(false);
    expect(sheetRowMatchesIdentity(["Phone"], [""], [])).toBe(true);
  });
});
