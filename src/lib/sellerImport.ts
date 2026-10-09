import type { InventoryInsert, Project, SellerInsert } from "@/types";
import type { BulkImportResult, BulkRowError } from "@/lib/bulkImport";
import { assignSplitPhones, mergeRemarksPhones } from "@/lib/phoneNumbers";

export const SELLER_IMPORT_HEADERS = [
  "owner_name",
  "contact_phone",
  "alt_phone",
  "email",
  "project",
  "tower",
  "unit_number",
  "floor",
  "configuration",
  "area_sqft",
  "facing",
  "parking",
  "asking_price",
  "available_for_sale",
  "remarks",
] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  owner_name: ["owner_name", "owner", "name", "seller_name"],
  contact_phone: ["contact_phone", "phone", "contact", "mobile", "phone_number"],
  alt_phone: ["alt_phone", "alternate_phone", "phone2", "secondary_phone"],
  email: ["email"],
  project: ["project", "project_name"],
  tower: ["tower", "block", "building"],
  unit_number: ["unit_number", "unit", "unit_no", "flat_no", "flat_number"],
  floor: ["floor"],
  configuration: ["configuration", "config", "unit_type", "type", "bhk"],
  area_sqft: ["area_sqft", "area", "sqft", "size"],
  facing: ["facing", "face"],
  parking: ["parking", "car_parking", "parkings"],
  asking_price: ["asking_price", "price", "expected_price", "rate"],
  available_for_sale: ["available_for_sale", "for_sale", "available"],
  remarks: ["remarks", "remark", "notes", "note", "comments"],
};

export function getSellerImportTemplate(): string {
  const headers = [...SELLER_IMPORT_HEADERS];
  const example: Record<string, string> = {
    owner_name: "Ramesh Agarwal",
    contact_phone: "9876543210",
    alt_phone: "",
    email: "",
    project: "Anand Prime Residences",
    tower: "A",
    unit_number: "A-1204",
    floor: "12",
    configuration: "3BHK",
    area_sqft: "1850",
    facing: "East",
    parking: "2",
    asking_price: "28500000",
    available_for_sale: "no",
    remarks: "Owner reachable after 6pm",
  };
  return [headers.join(","), headers.map((h) => example[h] ?? "").join(",")].join("\n");
}

function getValue(row: Record<string, string>, canonical: string): string {
  for (const alias of HEADER_ALIASES[canonical] ?? [canonical]) {
    const val = row[alias];
    if (val) return val.trim();
  }
  return "";
}

function parseNumber(
  raw: string,
  rowNum: number,
  label: string
): { value: number | null; error?: BulkRowError } {
  if (!raw) return { value: null };
  const cleaned = raw.replace(/[,₹\s]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) {
    return { value: null, error: { row: rowNum, message: `${label} must be a number` } };
  }
  return { value: num };
}

function parseInteger(
  raw: string,
  rowNum: number,
  label: string
): { value: number | null; error?: BulkRowError } {
  const result = parseNumber(raw, rowNum, label);
  if (result.error || result.value == null) return result;
  return { value: Math.trunc(result.value) };
}

function parseBoolean(
  raw: string,
  rowNum: number,
  label: string
): { value: boolean; error?: BulkRowError } {
  if (!raw) return { value: false };
  const lower = raw.trim().toLowerCase();
  if (["yes", "y", "true", "1", "available", "for sale"].includes(lower)) {
    return { value: true };
  }
  if (["no", "n", "false", "0"].includes(lower)) {
    return { value: false };
  }
  return {
    value: false,
    error: { row: rowNum, message: `${label} must be yes or no` },
  };
}

export function parseSellerRows(
  rows: Record<string, string>[],
  projects: Project[],
  defaultProjectId: string | null
): BulkImportResult<SellerInsert> {
  const valid: SellerInsert[] = [];
  const errors: BulkRowError[] = [];
  const warnings: BulkRowError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const ownerName = getValue(row, "owner_name");
    if (!ownerName) {
      errors.push({ row: rowNum, message: "Owner name is required" });
      return;
    }

    const projectName = getValue(row, "project");
    let projectId = defaultProjectId;
    if (projectName) {
      const project = projects.find(
        (p) => p.name.toLowerCase() === projectName.toLowerCase()
      );
      if (!project) {
        errors.push({ row: rowNum, message: `Unknown project "${projectName}"` });
        return;
      }
      projectId = project.id;
    }

    const floor = parseNumber(getValue(row, "floor"), rowNum, "Floor");
    if (floor.error) {
      errors.push(floor.error);
      return;
    }
    const area = parseNumber(getValue(row, "area_sqft"), rowNum, "Area");
    if (area.error) {
      errors.push(area.error);
      return;
    }
    const parking = parseInteger(getValue(row, "parking"), rowNum, "Parking");
    if (parking.error) {
      errors.push(parking.error);
      return;
    }
    const askingPrice = parseNumber(getValue(row, "asking_price"), rowNum, "Asking price");
    if (askingPrice.error) {
      errors.push(askingPrice.error);
      return;
    }
    const available = parseBoolean(
      getValue(row, "available_for_sale"),
      rowNum,
      "Available for sale"
    );
    if (available.error) {
      errors.push(available.error);
      return;
    }

    const assigned = assignSplitPhones(
      getValue(row, "contact_phone"),
      getValue(row, "alt_phone")
    );
    for (const fragment of assigned.dropped) {
      warnings.push({ row: rowNum, message: `Dropped "${fragment}" (not a phone number)` });
    }
    const remarks = mergeRemarksPhones(getValue(row, "remarks"), assigned.extras);

    valid.push({
      owner_name: ownerName,
      contact_phone: assigned.primary,
      alt_phone: assigned.alt,
      email: getValue(row, "email") || null,
      project_id: projectId,
      tower: getValue(row, "tower") || null,
      unit_number: getValue(row, "unit_number") || null,
      floor: floor.value,
      configuration: getValue(row, "configuration") || null,
      area_sqft: area.value,
      facing: getValue(row, "facing") || null,
      parking: parking.value,
      asking_price: askingPrice.value,
      available_for_sale: available.value,
      remarks,
    });
  });

  return { valid, errors, warnings };
}

export interface SellerInventorySource {
  project_id: string | null;
  unit_number: string | null;
  configuration: string | null;
  area_sqft: number | null;
  asking_price: number | null;
  tower: string | null;
  floor: number | null;
  facing: string | null;
  parking: number | null;
}

/**
 * Map seller fields onto an inventory row. custom_data keys reuse the
 * inventory field-definition keys (floor, facing, car_parking) plus tower
 * so linked units render like manually added ones.
 */
export function mapSellerToInventoryInput(
  seller: SellerInventorySource,
  sellerId: string
): { inventory: (InventoryInsert & { seller_id: string }) | null; error?: string } {
  const unitNumber = seller.unit_number?.trim();
  if (!unitNumber) {
    return { inventory: null, error: "Unit number is required to list in inventory" };
  }

  const customData: Record<string, unknown> = {};
  if (seller.tower) customData.tower = seller.tower;
  if (seller.floor != null) customData.floor = seller.floor;
  if (seller.facing) customData.facing = seller.facing;
  if (seller.parking != null) customData.car_parking = seller.parking;

  return {
    inventory: {
      project_id: seller.project_id,
      unit_number: unitNumber,
      unit_type: seller.configuration,
      area_sqft: seller.area_sqft,
      price: seller.asking_price,
      status: "available",
      seller_id: sellerId,
      custom_data: customData,
    },
  };
}

/** Fields synced from seller → linked inventory on edit (status excluded). */
export function mapSellerToInventorySync(seller: SellerInventorySource): {
  project_id: string | null;
  unit_number: string;
  unit_type: string | null;
  area_sqft: number | null;
  price: number | null;
  custom_data: Record<string, unknown>;
} {
  const mapped = mapSellerToInventoryInput(seller, "sync");
  if (!mapped.inventory) {
    throw new Error(mapped.error ?? "Cannot sync seller to inventory");
  }
  return {
    project_id: mapped.inventory.project_id ?? null,
    unit_number: mapped.inventory.unit_number,
    unit_type: mapped.inventory.unit_type ?? null,
    area_sqft: mapped.inventory.area_sqft ?? null,
    price: mapped.inventory.price ?? null,
    custom_data: mapped.inventory.custom_data ?? {},
  };
}
