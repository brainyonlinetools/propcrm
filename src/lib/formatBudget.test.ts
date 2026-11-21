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
