import { describe, expect, it } from "vitest";
import { mergeCustomData, normalizeExtraction } from "./voiceExtract";

describe("normalizeExtraction", () => {
  it("drops invalid enums, bad dates and blanks", () => {
    const r = normalizeExtraction({
      budget: " 2-3 Cr ",
      configuration: "5BHK",
      possession_preference: "2026",
      follow_up_date: "Saturday",
      requirement: "   ",
    });
    expect(r.budget).toBe("2-3 Cr");
    expect(r.configuration).toBeNull();
    expect(r.possession_preference).toBe("2026");
    expect(r.follow_up_date).toBeNull();
    expect(r.requirement).toBeNull();
  });

  it("tolerates garbage input", () => {
    expect(normalizeExtraction(null).budget).toBeNull();
  });
});

describe("mergeCustomData", () => {
  it("keeps existing values when nothing extracted", () => {
    const base = { budget: "1 Cr", foo: 1 };
    expect(
      mergeCustomData(base, {
        budget: null,
        configuration: null,
        possession_preference: null,
        requirement: null,
      })
    ).toEqual(base);
  });

  it("overwrites mentioned fields and appends requirement to remarks", () => {
    const out = mergeCustomData(
      { budget: "1 Cr", remarks: "old" },
      {
        budget: "2-3 Cr",
        configuration: "3BHK",
        possession_preference: null,
        requirement: "high floor",
      }
    );
    expect(out).toEqual({
      budget: "2-3 Cr",
      configuration: "3BHK",
      remarks: "old\nhigh floor",
    });
  });
});
