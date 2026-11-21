import { describe, expect, it } from "vitest";
import { formatBudget } from "./utils";

describe("formatBudget", () => {
  it("treats plain numbers as crores", () => {
    expect(formatBudget(2.8)).toBe("₹2.8 Cr");
    expect(formatBudget("2.8")).toBe("₹2.8 Cr");
  });

  it("shows free text exactly as entered", () => {
    expect(formatBudget("2-3 Cr")).toBe("2-3 Cr");
    expect(formatBudget("Flexible")).toBe("Flexible");
    expect(formatBudget(" 50 L ")).toBe("50 L");
  });

  it("returns empty for blank values", () => {
    expect(formatBudget(null)).toBe("");
    expect(formatBudget("  ")).toBe("");
  });
});

import { formatCurrency, parsePrice } from "./utils";

describe("formatCurrency", () => {
  it("uses crore and lakh correctly", () => {
    expect(formatCurrency(2_85_00_000)).toBe("₹2.85 Cr");
    expect(formatCurrency(10_00_00_000)).toBe("₹10 Cr");
    expect(formatCurrency(85_00_000)).toBe("₹85 L");
    expect(formatCurrency(1_25_000)).toBe("₹1.25 L");
    expect(formatCurrency(10_800)).toBe("₹10,800");
    expect(formatCurrency(null)).toBe("—");
  });
});

describe("parsePrice", () => {
  it("parses plain and Indian-formatted amounts", () => {
    expect(parsePrice("28500000")).toBe(28_500_000);
    expect(parsePrice("₹2,85,00,000")).toBe(28_500_000);
  });

  it("parses crore and lakh shorthand", () => {
    expect(parsePrice("2.85 Cr")).toBe(28_500_000);
    expect(parsePrice("1 crore")).toBe(10_000_000);
    expect(parsePrice("85 L")).toBe(8_500_000);
    expect(parsePrice("85 lakh")).toBe(8_500_000);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice("lots")).toBeNull();
    expect(parsePrice("2-3 Cr")).toBeNull();
  });
});
