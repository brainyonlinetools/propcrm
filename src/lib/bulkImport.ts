import type {
  EntityType,
  FieldDefinition,
  InventoryInsert,
  InventoryStatus,
  LeadInsert,
  PipelineStage,
  Project,
} from "@/types";
import { LEAD_SOURCES } from "@/types";
import { slugify } from "@/lib/utils";
import { format } from "date-fns";

export interface BulkImportResult<T> {
  valid: T[];
  errors: BulkRowError[];
}

export interface BulkRowError {
  row: number;
  message: string;
}

const LEAD_SYSTEM_KEYS = new Set([
  "name",
  "phone",
  "email",
  "source",
  "stage",
  "stage_label",
  "project",
  "project_name",
  "project_interest",
  "acquired_date",
  "lead_date",
]);

const INVENTORY_SYSTEM_KEYS = new Set([
  "unit_number",
  "unit",
  "unit_no",
  "project",
  "project_name",
  "unit_type",
  "type",
  "area_sqft",
  "area",
  "price",
  "status",
  "acquired_date",
]);

const INVENTORY_STATUSES = new Set<InventoryStatus>([
  "available",
  "blocked",
  "booked",
  "sold",
]);

export function getBulkImportTemplate(
  entityType: EntityType,
  customFields: FieldDefinition[]
): string {
  if (entityType === "lead") {
    const headers = [
      "name",
      "phone",
      "email",
      "source",
      "stage",
      "project",
      "acquired_date",
      ...customFields.map((f) => f.field_key),
    ];
    const example: Record<string, string> = {
      name: "Rajesh Malhotra",
      phone: "9876543210",
      email: "rajesh@email.com",
      source: "Meta",
      stage: "New",
      project: "Anand Prime Residences",
      acquired_date: "2024-06-15",
      budget: "2.8",
      configuration: "3BHK",
    };
    customFields.forEach((f) => {
      if (!(f.field_key in example)) example[f.field_key] = "";
    });
    return [headers.join(","), headers.map((h) => example[h] ?? "").join(",")].join("\n");
  }

  const headers = [
    "unit_number",
    "project",
    "unit_type",
    "area_sqft",
    "price",
    "status",
    "acquired_date",
    ...customFields.map((f) => f.field_key),
  ];
  const example: Record<string, string> = {
    unit_number: "A-1204",
    project: "Anand Prime Residences",
    unit_type: "3BHK",
    area_sqft: "1850",
    price: "28500000",
    status: "available",
    acquired_date: "2024-03-01",
    floor: "12",
    facing: "East",
  };
  customFields.forEach((f) => {
    if (!(f.field_key in example)) example[f.field_key] = "";
  });
  return [headers.join(","), headers.map((h) => example[h] ?? "").join(",")].join("\n");
}

export function parseLeadRows(
  rows: Record<string, string>[],
  stages: PipelineStage[],
  customFields: FieldDefinition[]
): BulkImportResult<LeadInsert> {
  const valid: LeadInsert[] = [];
  const errors: BulkRowError[] = [];
  const defaultStageId = stages[0]?.id ?? null;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const name = getValue(row, ["name"]);
    if (!name) {
      errors.push({ row: rowNum, message: "Name is required" });
      return;
    }

    const stageLabel = getValue(row, ["stage", "stage_label"]);
    const stage = stageLabel
      ? stages.find((s) => s.label.toLowerCase() === stageLabel.toLowerCase())
      : null;
    if (stageLabel && !stage) {
      errors.push({ row: rowNum, message: `Unknown stage "${stageLabel}"` });
      return;
    }

    const projectInterest = getValue(row, ["project", "project_name", "project_interest"]);

    const acquiredDateRaw = getValue(row, ["acquired_date", "lead_date"]);
    const acquiredDateResult = parseAcquiredDate(acquiredDateRaw, rowNum);
    if (acquiredDateResult.error) {
      errors.push(acquiredDateResult.error);
      return;
    }

    const source = getValue(row, ["source"]);
    if (source && !LEAD_SOURCES.includes(source as (typeof LEAD_SOURCES)[number])) {
      errors.push({
        row: rowNum,
        message: `Invalid source "${source}". Use: ${LEAD_SOURCES.join(", ")}`,
      });
      return;
    }

    const customResult = parseCustomFields(row, customFields, LEAD_SYSTEM_KEYS, rowNum);
    if (customResult.error) {
      errors.push(customResult.error);
      return;
    }

    valid.push({
      name,
      phone: getValue(row, ["phone"]) || null,
      email: getValue(row, ["email"]) || null,
      source: source || null,
      stage_id: stage?.id ?? defaultStageId,
      project_interest: projectInterest || null,
      acquired_date: acquiredDateResult.value,
      custom_data: customResult.data,
    });
  });

  return { valid, errors };
}

export function parseInventoryRows(
  rows: Record<string, string>[],
  projects: Project[],
  customFields: FieldDefinition[]
): BulkImportResult<InventoryInsert> {
  const valid: InventoryInsert[] = [];
  const errors: BulkRowError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const unitNumber = getValue(row, ["unit_number", "unit", "unit_no"]);
    if (!unitNumber) {
      errors.push({ row: rowNum, message: "Unit number is required" });
      return;
    }

    const projectName = getValue(row, ["project", "project_name"]);
    const project = projectName
      ? projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase())
      : null;
    if (projectName && !project) {
      errors.push({ row: rowNum, message: `Unknown project "${projectName}"` });
      return;
    }

    const statusRaw = getValue(row, ["status"])?.toLowerCase() ?? "available";
    if (!INVENTORY_STATUSES.has(statusRaw as InventoryStatus)) {
      errors.push({
        row: rowNum,
        message: `Invalid status "${statusRaw}". Use: available, blocked, booked, sold`,
      });
      return;
    }

    const areaRaw = getValue(row, ["area_sqft", "area"]);
    const priceRaw = getValue(row, ["price"]);
    const area = areaRaw ? Number(areaRaw) : null;
    const price = priceRaw ? Number(priceRaw) : null;

    if (areaRaw && Number.isNaN(area)) {
      errors.push({ row: rowNum, message: "Area must be a number" });
      return;
    }
    if (priceRaw && Number.isNaN(price)) {
      errors.push({ row: rowNum, message: "Price must be a number" });
      return;
    }

    const customResult = parseCustomFields(row, customFields, INVENTORY_SYSTEM_KEYS, rowNum);
    if (customResult.error) {
      errors.push(customResult.error);
      return;
    }

    const acquiredDateRaw = getValue(row, ["acquired_date"]);
    const acquiredDateResult = parseAcquiredDate(acquiredDateRaw, rowNum);
    if (acquiredDateResult.error) {
      errors.push(acquiredDateResult.error);
      return;
    }

    valid.push({
      unit_number: unitNumber,
      project_id: project?.id ?? null,
      unit_type: getValue(row, ["unit_type", "type"]) || null,
      area_sqft: area,
      price,
      status: statusRaw as InventoryStatus,
      acquired_date: acquiredDateResult.value,
      custom_data: customResult.data,
    });
  });

  return { valid, errors };
}

function getValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val) return val;
  }
  return "";
}

function parseAcquiredDate(
  raw: string,
  rowNum: number
): { value: string | null; error?: BulkRowError } {
  if (!raw) return { value: null };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return {
      value: null,
      error: { row: rowNum, message: `Invalid date "${raw}". Use YYYY-MM-DD` },
    };
  }
  return { value: format(date, "yyyy-MM-dd") };
}

function parseCustomFields(
  row: Record<string, string>,
  fields: FieldDefinition[],
  systemKeys: Set<string>,
  rowNum: number
): { data: Record<string, unknown>; error?: BulkRowError } {
  const data: Record<string, unknown> = {};
  const fieldByKey = new Map(fields.map((f) => [f.field_key, f]));
  const fieldByLabel = new Map(fields.map((f) => [slugify(f.label), f]));

  for (const [rawKey, rawVal] of Object.entries(row)) {
    if (!rawVal || systemKeys.has(rawKey)) continue;

    const field = fieldByKey.get(rawKey) ?? fieldByLabel.get(rawKey);
    if (!field) continue;

    const parsed = parseFieldValue(field, rawVal);
    if (parsed.error) {
      return { data, error: { row: rowNum, message: `${field.label}: ${parsed.error}` } };
    }
    data[field.field_key] = parsed.value;
  }

  for (const field of fields) {
    if (field.is_required && data[field.field_key] == null) {
      const val = row[field.field_key] ?? row[slugify(field.label)];
      if (!val) {
        return {
          data,
          error: { row: rowNum, message: `${field.label} is required` },
        };
      }
    }
  }

  return { data };
}

function parseFieldValue(
  field: FieldDefinition,
  raw: string
): { value: unknown; error?: string } {
  switch (field.field_type) {
    case "number":
      if (!raw) return { value: null };
      const num = Number(raw);
      if (Number.isNaN(num)) return { value: null, error: "must be a number" };
      return { value: num };
    case "boolean": {
      const lower = raw.toLowerCase();
      if (["yes", "true", "1"].includes(lower)) return { value: true };
      if (["no", "false", "0"].includes(lower)) return { value: false };
      return { value: null, error: "must be yes/no or true/false" };
    }
    case "multiselect":
      return { value: raw.split(";").map((s) => s.trim()).filter(Boolean) };
    case "select": {
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(raw)) {
        return { value: null, error: `must be one of: ${options.join(", ")}` };
      }
      return { value: raw };
    }
    default:
      return { value: raw };
  }
}
