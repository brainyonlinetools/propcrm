import { format } from "date-fns";
import type {
  InventoryInsert,
  InventoryStatus,
  LeadInsert,
  PipelineStage,
  Project,
} from "@/types";
import { normalizePhoneKey } from "@/lib/utils";
import { assignSplitPhones, mergeRemarksPhones, splitPhoneCell } from "@/lib/phoneNumbers";

export const CONNECTED_LEADS_TAB_DEFAULT = "Leads";
export const CONNECTED_INVENTORY_TAB_DEFAULT = "Inventory";

export function connectedLeadsTab(): string {
  return process.env.GOOGLE_SHEET_LEADS_TAB ?? CONNECTED_LEADS_TAB_DEFAULT;
}

export function connectedInventoryTab(): string {
  return process.env.GOOGLE_SHEET_INVENTORY_TAB ?? CONNECTED_INVENTORY_TAB_DEFAULT;
}

export function buildSheetTracking(sheetId: string, sheetTab: string, sheetRow: number) {
  return {
    imported_from_sheet: true as const,
    sheet_id: sheetId,
    sheet_tab: sheetTab,
    sheet_row: sheetRow,
  };
}

function getField(row: Record<string, string>, name: string): string {
  if (row[name] != null) return String(row[name]).trim();
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    if (key.trim().toLowerCase() === lower && value != null) {
      return String(value).trim();
    }
  }
  return "";
}

export function parseSheetDate(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  }

  // Indian-locale day-first dates: 09/10/2026, 9-10-2026, 09.10.2026
  const dmy = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  }

  // Short-year day-first dates: 24/11/24. POSIX pivot: 00-68 → 2000s, 69-99 → 1900s.
  const dmyShort = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})(?!\d)/);
  if (dmyShort) {
    const [, d, m, yy] = dmyShort;
    const year = Number(yy) <= 68 ? 2000 + Number(yy) : 1900 + Number(yy);
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  }

  const date = new Date(t);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "yyyy-MM-dd");
}

export function parseSheetPhone(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  return normalizePhoneKey(raw);
}

function parseSheetNumber(
  raw: string,
  label: string
): { value: number | null; error?: string } {
  if (!raw) return { value: null };
  const num = Number(raw.replace(/[,₹\s]/g, ""));
  if (Number.isNaN(num)) return { value: null, error: `${label} must be a number` };
  return { value: num };
}

/** Budget entered as Cr (2.5, "2.5 Cr", "50 L", or full rupees like 25000000). */
export function parseBudgetCr(raw: string | undefined): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const match = t.replace(/[,₹\s]/g, "").match(/^([\d.]+)(crores?|cr|lacs?|lakhs?|l|k)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  const unit = (match[2] ?? "").toLowerCase();
  if (unit.startsWith("l")) return value / 100;
  if (unit === "k") return value / 100000;
  if (!unit && value >= 100000) return value / 10000000;
  return value;
}

export interface MapConnectedLeadResult {
  lead: LeadInsert | null;
  /** Sheet Notes cell → created as a lead note for new leads only. */
  note: string | null;
  warnings: string[];
  error?: string;
}

export function mapConnectedLeadRow(
  row: Record<string, string>,
  options: { sheetRow: number; sheetId: string; sheetTab: string; stages: PipelineStage[] }
): MapConnectedLeadResult {
  const warnings: string[] = [];
  const nameField = getField(row, "Name");
  const name = nameField || `Lead ${options.sheetRow}`;
  if (!nameField) {
    warnings.push(`Missing name, used "${name}"`);
  }

  const sorted = [...options.stages].sort((a, b) => a.sort_order - b.sort_order);
  const defaultStageId = sorted[0]?.id ?? null;

  const stageRaw = getField(row, "Stage");
  let stageId = defaultStageId;
  if (stageRaw) {
    const stage = options.stages.find(
      (s) => s.label.toLowerCase() === stageRaw.toLowerCase()
    );
    if (stage) {
      stageId = stage.id;
    } else {
      warnings.push(`Unknown stage "${stageRaw}", used default`);
    }
  }

  const budgetRaw = getField(row, "Budget");
  const budget = parseBudgetCr(budgetRaw);
  if (budgetRaw && budget == null) {
    warnings.push(`Could not parse budget "${budgetRaw}"`);
  }

  const leadType = getField(row, "Lead Type");
  const lastCallRaw = getField(row, "Last Date of Call");
  const lastCall = parseSheetDate(lastCallRaw);
  if (lastCallRaw && !lastCall) {
    warnings.push(`Could not parse last call date "${lastCallRaw}"`);
  }

  const dateRaw = getField(row, "Date");
  const acquiredDate = parseSheetDate(dateRaw);
  if (dateRaw && !acquiredDate) {
    warnings.push(`Could not parse date "${dateRaw}"`);
  }

  const assigned = assignSplitPhones(getField(row, "Phone"));
  for (const fragment of assigned.dropped) {
    warnings.push(`Dropped "${fragment}" (not a phone number)`);
  }

  const customData: Record<string, unknown> = {
    ...buildSheetTracking(options.sheetId, options.sheetTab, options.sheetRow),
  };
  if (leadType) customData.lead_type = leadType;
  if (budget != null) customData.budget = budget;
  if (lastCall) customData.last_call_date = lastCall;
  if (assigned.extras.length > 0) customData.additional_phones = assigned.extras;

  return {
    lead: {
      name,
      phone: assigned.primary,
      alt_phone: assigned.alt,
      email: getField(row, "Email")?.toLowerCase() || null,
      source: getField(row, "Source") || null,
      stage_id: stageId,
      project_interest: getField(row, "Project Interest") || null,
      acquired_date: acquiredDate,
      custom_data: customData,
    },
    note: getField(row, "Notes") || null,
    warnings,
  };
}

const INVENTORY_STATUSES = new Set(["available", "blocked", "booked", "sold"]);

export interface MapConnectedInventoryResult {
  unit: InventoryInsert | null;
  note: string | null;
  warnings: string[];
  error?: string;
}

export function mapConnectedInventoryRow(
  row: Record<string, string>,
  options: { sheetRow: number; sheetId: string; sheetTab: string; projects: Project[] }
): MapConnectedInventoryResult {
  const warnings: string[] = [];
  const unitNumber = getField(row, "Unit Number");
  if (!unitNumber) {
    return { unit: null, note: null, warnings, error: "Unit Number is required" };
  }

  const projectName = getField(row, "Project");
  let projectId: string | null = null;
  if (projectName) {
    const project = options.projects.find(
      (p) => p.name.toLowerCase() === projectName.toLowerCase()
    );
    if (!project) {
      return { unit: null, note: null, warnings, error: `Unknown project "${projectName}"` };
    }
    projectId = project.id;
  }

  const area = parseSheetNumber(getField(row, "Area (sq.ft.)"), "Area");
  if (area.error) return { unit: null, note: null, warnings, error: area.error };
  const price = parseSheetNumber(getField(row, "Price"), "Price");
  if (price.error) return { unit: null, note: null, warnings, error: price.error };
  const floor = parseSheetNumber(getField(row, "Floor"), "Floor");
  if (floor.error) return { unit: null, note: null, warnings, error: floor.error };
  const parking = parseSheetNumber(getField(row, "Parking"), "Parking");
  if (parking.error) return { unit: null, note: null, warnings, error: parking.error };

  const statusRaw = getField(row, "Status").toLowerCase();
  let status: InventoryStatus = "available";
  if (statusRaw) {
    if (INVENTORY_STATUSES.has(statusRaw)) {
      status = statusRaw as InventoryStatus;
    } else {
      warnings.push(`Unknown status "${statusRaw}", used available`);
    }
  }

  const customData: Record<string, unknown> = {
    ...buildSheetTracking(options.sheetId, options.sheetTab, options.sheetRow),
  };
  if (floor.value != null) customData.floor = floor.value;
  const facing = getField(row, "Facing");
  if (facing) customData.facing = facing;
  if (parking.value != null) customData.car_parking = parking.value;
  const ownerName = getField(row, "Owner Name");
  if (ownerName) customData.owner_name = ownerName;
  const ownerPhones = splitPhoneCell(getField(row, "Owner Phone"));
  if (ownerPhones.numbers[0]) customData.owner_phone = ownerPhones.numbers[0];
  for (const extra of ownerPhones.numbers.slice(1)) {
    warnings.push(`Extra owner phone kept in remarks: ${extra}`);
  }
  for (const fragment of ownerPhones.dropped) {
    warnings.push(`Dropped "${fragment}" (not a phone number)`);
  }

  const dateRaw = getField(row, "Date");
  const acquiredDate = parseSheetDate(dateRaw);
  if (dateRaw && !acquiredDate) {
    warnings.push(`Could not parse date "${dateRaw}"`);
  }

  return {
    unit: {
      unit_number: unitNumber,
      project_id: projectId,
      unit_type: getField(row, "Type") || null,
      area_sqft: area.value,
      price: price.value,
      status,
      acquired_date: acquiredDate,
      custom_data: customData,
    },
    note: mergeRemarksPhones(getField(row, "Remarks"), ownerPhones.numbers.slice(1)),
    warnings,
  };
}
