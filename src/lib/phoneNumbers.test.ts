import { describe, expect, it } from "vitest";
import {
  assignSplitPhones,
  mergeRemarksPhones,
  normalizeStoredPhone,
  splitPhoneCell,
} from "@/lib/phoneNumbers";

describe("normalizeStoredPhone", () => {
  it("keeps 10-digit mobiles as-is", () => {
    expect(normalizeStoredPhone("9876543210")).toBe("9876543210");
  });

  it("strips formatting and country/trunk prefixes", () => {
    expect(normalizeStoredPhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizeStoredPhone("91-9876543210")).toBe("9876543210");
    expect(normalizeStoredPhone("09876543210")).toBe("9876543210");
  });

  it("never mangles landlines or international numbers", () => {
    expect(normalizeStoredPhone("011 2345 6789")).toBe("01123456789");
    expect(normalizeStoredPhone("+91 11 2345 6789")).toBe("911123456789");
    expect(normalizeStoredPhone("+1 415 555 1234")).toBe("14155551234");
  });

  it("returns null for empty values", () => {
    expect(normalizeStoredPhone("")).toBeNull();
    expect(normalizeStoredPhone(null)).toBeNull();
    expect(normalizeStoredPhone("abc")).toBeNull();
  });
});

describe("splitPhoneCell", () => {
  it("splits on common separators", () => {
    expect(splitPhoneCell("9876543210, 9811111111").numbers).toEqual([
      "9876543210",
      "9811111111",
    ]);
    expect(splitPhoneCell("9876543210 / 9811111111; 9822222222").numbers).toEqual([
      "9876543210",
      "9811111111",
      "9822222222",
    ]);
    expect(splitPhoneCell("9876543210 and 9811111111").numbers).toEqual([
      "9876543210",
      "9811111111",
    ]);
  });

  it("normalizes each part and dedupes", () => {
    expect(
      splitPhoneCell("+91 98765 43210, 9876543210").numbers
    ).toEqual(["9876543210"]);
  });

  it("does not split spaces inside one number", () => {
    expect(splitPhoneCell("+91 98765 43210").numbers).toEqual(["9876543210"]);
  });

  it("reports short fragments as dropped", () => {
    const { numbers, dropped } = splitPhoneCell("9876543210, 1234");
    expect(numbers).toEqual(["9876543210"]);
    expect(dropped).toEqual(["1234"]);
  });

  it("returns empty for empty cells", () => {
    expect(splitPhoneCell("")).toEqual({ numbers: [], dropped: [] });
    expect(splitPhoneCell(null)).toEqual({ numbers: [], dropped: [] });
  });
});

describe("assignSplitPhones", () => {
  it("fills primary, alt, then extras across both cells", () => {
    expect(assignSplitPhones("9876543210, 9811111111", "9822222222")).toEqual({
      primary: "9876543210",
      alt: "9811111111",
      extras: ["9822222222"],
      dropped: [],
    });
  });

  it("falls back to the alt cell when primary is empty", () => {
    expect(assignSplitPhones("", "9811111111")).toEqual({
      primary: "9811111111",
      alt: null,
      extras: [],
      dropped: [],
    });
  });

  it("dedupes across cells with primary winning", () => {
    const result = assignSplitPhones("9876543210", "9876543210, 9811111111");
    expect(result.primary).toBe("9876543210");
    expect(result.alt).toBe("9811111111");
    expect(result.extras).toEqual([]);
  });
});

describe("mergeRemarksPhones", () => {
  it("appends extras to remarks", () => {
    expect(mergeRemarksPhones("Call evenings", ["9822222222"])).toBe(
      "Call evenings\nOther phones: 9822222222"
    );
    expect(mergeRemarksPhones(null, ["9822222222"])).toBe(
      "Other phones: 9822222222"
    );
  });

  it("replaces previous extras instead of duplicating", () => {
    expect(
      mergeRemarksPhones("Call evenings\nOther phones: 9800000000", ["9822222222"])
    ).toBe("Call evenings\nOther phones: 9822222222");
  });

  it("removes the extras line when none remain", () => {
    expect(mergeRemarksPhones("Call evenings\nOther phones: 9800000000", [])).toBe(
      "Call evenings"
    );
  });
});
