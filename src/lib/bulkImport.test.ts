import { describe, expect, it } from "vitest";
import { parseLeadRows } from "@/lib/bulkImport";
import type { PipelineStage } from "@/types";

const stages = [
  { id: "s-new", label: "New", color: "#888", sort_order: 0 },
] as PipelineStage[];

describe("parseLeadRows phone handling", () => {
  it("normalizes a single phone number", () => {
    const { valid } = parseLeadRows(
      [{ name: "X", phone: "+91 98765 43210" }],
      stages,
      []
    );
    expect(valid[0].phone).toBe("9876543210");
    expect(valid[0].alt_phone).toBeNull();
  });

  it("splits multi-number cells into phone and alt_phone", () => {
    const { valid } = parseLeadRows(
      [{ name: "X", phone: "9876543210 / 9811111111" }],
      stages,
      []
    );
    expect(valid[0].phone).toBe("9876543210");
    expect(valid[0].alt_phone).toBe("9811111111");
  });

  it("stores further numbers in additional_phones", () => {
    const { valid } = parseLeadRows(
      [{ name: "X", phone: "9876543210, 9811111111, 9822222222" }],
      stages,
      []
    );
    expect(valid[0].phone).toBe("9876543210");
    expect(valid[0].alt_phone).toBe("9811111111");
    expect(valid[0].custom_data).toMatchObject({
      additional_phones: ["9822222222"],
    });
  });

  it("warns on dropped fragments without failing the row", () => {
    const { valid, warnings, errors } = parseLeadRows(
      [{ name: "X", phone: "9876543210, ext 12" }],
      stages,
      []
    );
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(warnings).toEqual([
      { row: 2, message: 'Dropped "ext 12" (not a phone number)' },
    ]);
  });
});
