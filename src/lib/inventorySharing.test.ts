import { describe, expect, it } from "vitest";
import { buildInventoryShareText } from "@/lib/inventorySharing";
import type { Inventory } from "@/types";

function makeUnit(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: "unit-1",
    project_id: null,
    unit_number: "A-1201",
    unit_type: "3BHK",
    area_sqft: 1650,
    price: 2_50_00_000,
    status: "available",
    acquired_date: null,
    custom_data: {
      project_name: "Anand Prime Residences",
      property_type: "sale",
      floor: "12",
      owner_name: "Secret Owner",
      owner_phone: "9876543210",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    inventory_media: [],
    ...overrides,
  };
}

describe("buildInventoryShareText", () => {
  it("includes property details and excludes owner contact", () => {
    const text = buildInventoryShareText({ units: [makeUnit()] });

    expect(text).toContain("A-1201");
    expect(text).toContain("Anand Prime Residences");
    expect(text).toContain("3BHK");
    expect(text).toContain("Floor: 12");
    expect(text).not.toContain("Secret Owner");
    expect(text).not.toContain("9876543210");
    expect(text).not.toMatch(/owner/i);
  });
});
