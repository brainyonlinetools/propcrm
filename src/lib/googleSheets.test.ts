import { describe, expect, it } from "vitest";
import {
  describeSheetsError,
  partitionInBoundsUpdates,
  sheetRowMatchesIdentity,
} from "./googleSheets";

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

  it("translates a grid-limits write into an actionable stale-row error", () => {
    const err = gaxiosLike(
      "Invalid data[404]: Range (Leads!E1578) exceeds grid limits. Max rows: 1577, max columns: 26",
      404,
      404
    );
    const message = describeSheetsError(err, { tab: "Leads" });
    expect(message).toContain('tab "Leads"');
    expect(message).toContain("no longer exists");
    expect(message).not.toContain("exceeds grid limits");
  });
});

describe("partitionInBoundsUpdates", () => {
  const limits = { rowCount: 1577, columnCount: 26 };

  it("keeps rows inside the grid", () => {
    const updates = [
      { row: 2, status: "New" },
      { row: 1577, status: "Contacted" },
    ];
    expect(partitionInBoundsUpdates(updates, 4, limits)).toEqual({
      inBounds: updates,
      skippedRows: [],
    });
  });

  it("skips rows past the grid so one deleted row cannot fail the batch", () => {
    const { inBounds, skippedRows } = partitionInBoundsUpdates(
      [
        { row: 2, status: "New" },
        { row: 1578, status: "Contacted" },
      ],
      4,
      limits
    );
    expect(inBounds).toEqual([{ row: 2, status: "New" }]);
    expect(skippedRows).toEqual([1578]);
  });

  it("skips the header row and invalid rows instead of corrupting them", () => {
    const { inBounds, skippedRows } = partitionInBoundsUpdates(
      [
        { row: 1, status: "New" },
        { row: 0, status: "New" },
        { row: 2.5, status: "New" },
        { row: 10, status: "New" },
      ],
      4,
      limits
    );
    expect(inBounds).toEqual([{ row: 10, status: "New" }]);
    expect(skippedRows).toEqual([1, 0, 2.5]);
  });

  it("skips everything when the status column itself is outside the grid", () => {
    const { inBounds, skippedRows } = partitionInBoundsUpdates(
      [{ row: 2, status: "New" }],
      26,
      limits
    );
    expect(inBounds).toEqual([]);
    expect(skippedRows).toEqual([2]);
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
