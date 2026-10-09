import { describe, expect, it } from "vitest";
import {
  getSellerImportTemplate,
  mapSellerToInventoryInput,
  mapSellerToInventorySync,
  parseSellerRows,
} from "@/lib/sellerImport";
import type { Project } from "@/types";

const projects = [
  { id: "p1", name: "Anand Prime Residences" },
  { id: "p2", name: "Anand Prime Heights" },
] as Project[];

describe("getSellerImportTemplate", () => {
  it("includes the required headers and an example row", () => {
    const [headers, example] = getSellerImportTemplate().split("\n");
    expect(headers).toContain("owner_name");
    expect(headers).toContain("contact_phone");
    expect(headers).toContain("project");
    expect(headers).toContain("unit_number");
    expect(headers).toContain("available_for_sale");
    expect(example).toContain("Ramesh Agarwal");
  });
});

describe("parseSellerRows", () => {
  it("parses a valid row with the default project", () => {
    const { valid, errors } = parseSellerRows(
      [
        {
          owner_name: "Ramesh Agarwal",
          contact_phone: "9876543210",
          tower: "A",
          unit_number: "A-1204",
          floor: "12",
          configuration: "3BHK",
          area_sqft: "1850",
          facing: "East",
          parking: "2",
          asking_price: "28500000",
          available_for_sale: "yes",
          remarks: "Call after 6pm",
        },
      ],
      projects,
      "p1"
    );
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({
      owner_name: "Ramesh Agarwal",
      contact_phone: "9876543210",
      project_id: "p1",
      tower: "A",
      unit_number: "A-1204",
      floor: 12,
      configuration: "3BHK",
      area_sqft: 1850,
      facing: "East",
      parking: 2,
      asking_price: 28500000,
      available_for_sale: true,
      remarks: "Call after 6pm",
    });
  });

  it("accepts header aliases from pasted spreadsheets", () => {
    const { valid, errors } = parseSellerRows(
      [
        {
          owner: "Meena Iyer",
          phone: "9812345678",
          project_name: "Anand Prime Heights",
          flat_no: "T1-1501",
          bhk: "3BHK",
          price: "1,95,00,000",
        },
      ],
      projects,
      "p1"
    );
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({
      owner_name: "Meena Iyer",
      contact_phone: "9812345678",
      project_id: "p2",
      unit_number: "T1-1501",
      configuration: "3BHK",
      asking_price: 19500000,
    });
  });

  it("requires owner name", () => {
    const { valid, errors } = parseSellerRows(
      [{ contact_phone: "9876543210", unit_number: "A-1" }],
      projects,
      "p1"
    );
    expect(valid).toHaveLength(0);
    expect(errors).toEqual([{ row: 2, message: "Owner name is required" }]);
  });

  it("rejects unknown project names", () => {
    const { valid, errors } = parseSellerRows(
      [{ owner_name: "X", project: "Unknown Towers" }],
      projects,
      "p1"
    );
    expect(valid).toHaveLength(0);
    expect(errors).toEqual([{ row: 2, message: 'Unknown project "Unknown Towers"' }]);
  });

  it("rejects non-numeric area and price", () => {
    const { valid, errors } = parseSellerRows(
      [{ owner_name: "X", area_sqft: "big", asking_price: "lots" }],
      projects,
      "p1"
    );
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("Area must be a number");
  });

  it("rejects invalid available_for_sale values", () => {
    const { valid, errors } = parseSellerRows(
      [{ owner_name: "X", available_for_sale: "maybe" }],
      projects,
      "p1"
    );
    expect(valid).toHaveLength(0);
    expect(errors).toEqual([
      { row: 2, message: "Available for sale must be yes or no" },
    ]);
  });

  it("defaults available_for_sale to false", () => {
    const { valid } = parseSellerRows([{ owner_name: "X" }], projects, null);
    expect(valid[0].available_for_sale).toBe(false);
    expect(valid[0].project_id).toBeNull();
  });

  it("splits multi-number cells across contact and alt phones", () => {
    const { valid, warnings } = parseSellerRows(
      [{ owner_name: "X", contact_phone: "+91 98765 43210, 9811111111" }],
      projects,
      "p1"
    );
    expect(valid[0].contact_phone).toBe("9876543210");
    expect(valid[0].alt_phone).toBe("9811111111");
    expect(warnings).toEqual([]);
  });

  it("moves third and further numbers into remarks", () => {
    const { valid } = parseSellerRows(
      [{ owner_name: "X", contact_phone: "9876543210, 9811111111, 9822222222", remarks: "Call evenings" }],
      projects,
      "p1"
    );
    expect(valid[0].contact_phone).toBe("9876543210");
    expect(valid[0].alt_phone).toBe("9811111111");
    expect(valid[0].remarks).toBe("Call evenings\nOther phones: 9822222222");
  });

  it("warns on dropped fragments without failing the row", () => {
    const { valid, warnings, errors } = parseSellerRows(
      [{ owner_name: "X", contact_phone: "9876543210, 12" }],
      projects,
      "p1"
    );
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(warnings).toEqual([{ row: 2, message: 'Dropped "12" (not a phone number)' }]);
  });
});

describe("mapSellerToInventoryInput", () => {
  const base = {
    project_id: "p1",
    unit_number: "A-1204",
    configuration: "3BHK",
    area_sqft: 1850,
    asking_price: 28500000,
    tower: "A",
    floor: 12,
    facing: "East",
    parking: 2,
  };

  it("maps seller fields onto an available inventory row", () => {
    const { inventory, error } = mapSellerToInventoryInput(base, "s1");
    expect(error).toBeUndefined();
    expect(inventory).toMatchObject({
      project_id: "p1",
      unit_number: "A-1204",
      unit_type: "3BHK",
      area_sqft: 1850,
      price: 28500000,
      status: "available",
      seller_id: "s1",
      custom_data: { tower: "A", floor: 12, facing: "East", car_parking: 2 },
    });
  });

  it("fails without a unit number", () => {
    const { inventory, error } = mapSellerToInventoryInput(
      { ...base, unit_number: null },
      "s1"
    );
    expect(inventory).toBeNull();
    expect(error).toBe("Unit number is required to list in inventory");
  });

  it("omits empty custom-data keys", () => {
    const { inventory } = mapSellerToInventoryInput(
      {
        ...base,
        tower: null,
        floor: null,
        facing: null,
        parking: null,
      },
      "s1"
    );
    expect(inventory?.custom_data).toEqual({});
  });
});

describe("mapSellerToInventorySync", () => {
  it("excludes status and seller_id from the synced fields", () => {
    const sync = mapSellerToInventorySync({
      project_id: "p1",
      unit_number: "A-1204",
      configuration: "4BHK",
      area_sqft: 2400,
      asking_price: 42000000,
      tower: null,
      floor: 8,
      facing: "Corner",
      parking: 3,
    });
    expect(sync).toEqual({
      project_id: "p1",
      unit_number: "A-1204",
      unit_type: "4BHK",
      area_sqft: 2400,
      price: 42000000,
      custom_data: { floor: 8, facing: "Corner", car_parking: 3 },
    });
  });

  it("throws when the seller has no unit number", () => {
    expect(() =>
      mapSellerToInventorySync({
        project_id: "p1",
        unit_number: null,
        configuration: null,
        area_sqft: null,
        asking_price: null,
        tower: null,
        floor: null,
        facing: null,
        parking: null,
      })
    ).toThrow("Unit number is required to list in inventory");
  });
});
