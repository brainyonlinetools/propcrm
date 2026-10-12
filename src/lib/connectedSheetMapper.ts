import { format } from "date-fns";
import type {
  InventoryInsert,
  InventoryStatus,
  LeadInsert,
  PipelineStage,
  Project,
} from "@/types";
import { normalizePhoneKey } from "@/lib/utils";
import {
  assignSplitPhones,
  mergeRemarksPhones,
  normalizeStoredPhone,
  splitPhoneCell,
} from "@/lib/phoneNumbers";

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

export function getSheetField(row: Record<string, string>, name: string): string {
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

const BUDGET_TOKEN_RE = /([\d,]+(?:\.\d+)?)\s*(crores?|cr|lacs?|lakhs?|lac|l|k)?/gi;

function budgetTokenToCr(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("l")) return value / 100;
  if (u === "k") return value / 100000;
  if (!u && value >= 1000) return value / 10000000;
  return value;
}

/**
 * Budget entered as Cr, including Meta-style ranges and bounds.
 * Single values ("2.5", "2.5 Cr", "50 L", full rupees like 25000000),
 * ranges ("₹1.5 Cr - ₹2.0 Cr", "₹50 Lac - ₹1.0 Cr" → midpoint, matching
 * parseMetaBudget), and open bounds ("₹3.5 Cr+", "< ₹50 Lac" → the bound).
 */
export function parseBudgetCr(raw: string | undefined): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const tokens = [...t.matchAll(BUDGET_TOKEN_RE)]
    .filter((m) => /\d/.test(m[1]))
    .map((m) => ({
      value: Number(m[1].replace(/,/g, "")),
      unit: (m[2] ?? "").toLowerCase(),
    }))
    .filter((tok) => !Number.isNaN(tok.value));
  if (tokens.length === 0) return null;
  // Trailing unit applies to the whole range ("1.5 - 2.0 Cr").
  const fallbackUnit = [...tokens].reverse().find((tok) => tok.unit)?.unit ?? "";
  const values = tokens
    .slice(0, 2)
    .map((tok) => budgetTokenToCr(tok.value, tok.unit || fallbackUnit));
  if (values.length === 1) return values[0];
  return Math.round(((values[0] + values[1]) / 2) * 100) / 100;
}

/** True when the raw budget carries range/bound info the number alone loses. */
export function isRangedBudget(raw: string): boolean {
  return /[-–—+<>]|\bto\b/i.test(raw);
}

export interface MapConnectedLeadResult {
  lead: LeadInsert | null;
  /** Sheet Notes cell → created as a lead note for new leads only. */
  note: string | null;
  warnings: string[];
  error?: string;
  /** Set when the row is silently skipped (header row, effectively empty). */
  skipped?: string;
}

/** Cell fillers that mean "no value" (never imported literally). */
const SHEET_PLACEHOLDERS = new Set(["-", "--", "na", "n/a", "nil", "none"]);

export function normalizeSheetText(raw: string): string {
  const text = raw.trim();
  return SHEET_PLACEHOLDERS.has(text.toLowerCase()) ? "" : text;
}

/** Meta-export header tokens, stripped of spaces/underscores for comparison. */
const HEADER_LIKE_TOKENS = new Set([
  "fullname",
  "firstname",
  "lastname",
  "phonenumber",
  "email",
  "campaignname",
  "adname",
  "adsetname",
  "formname",
  "createdtime",
  "leadstatus",
]);

function isHeaderLikeCell(value: string): boolean {
  const compact = value.trim().toLowerCase().replace(/[\s_]+/g, "");
  return compact !== "" && HEADER_LIKE_TOKENS.has(compact);
}

/** Pasted header rows (e.g. Meta export columns) are never leads. */
export function looksLikeHeaderRow(row: Record<string, string>): boolean {
  const cells = [
    getSheetField(row, "Name"),
    getSheetField(row, "Email"),
    getSheetField(row, "Source"),
    getSheetField(row, "Project Interest"),
  ];
  return cells.filter(isHeaderLikeCell).length >= 2;
}

export function mapConnectedLeadRow(
  row: Record<string, string>,
  options: { sheetRow: number; sheetId: string; sheetTab: string; stages: PipelineStage[] }
): MapConnectedLeadResult {
  const warnings: string[] = [];
  if (looksLikeHeaderRow(row)) {
    return { lead: null, note: null, warnings, skipped: "looks like a header row" };
  }
  const nameField = normalizeSheetText(getSheetField(row, "Name"));
  const name = nameField || `Lead ${options.sheetRow}`;
  if (!nameField) {
    warnings.push(`Missing name, used "${name}"`);
  }

  const sorted = [...options.stages].sort((a, b) => a.sort_order - b.sort_order);
  const defaultStageId = sorted[0]?.id ?? null;

  const stageRaw = getSheetField(row, "Stage");
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

  const budgetRaw = getSheetField(row, "Budget");
  const budget = parseBudgetCr(budgetRaw);
  if (budgetRaw && budget == null) {
    warnings.push(`Could not parse budget "${budgetRaw}"`);
  }

  const leadType = normalizeSheetText(getSheetField(row, "Lead Type"));
  const lastCallRaw = getSheetField(row, "Last Date of Call");
  const lastCall = parseSheetDate(lastCallRaw);
  if (lastCallRaw && !lastCall) {
    warnings.push(`Could not parse last call date "${lastCallRaw}"`);
  }

  const dateRaw = getSheetField(row, "Date");
  const acquiredDate = parseSheetDate(dateRaw);
  if (dateRaw && !acquiredDate) {
    warnings.push(`Could not parse date "${dateRaw}"`);
  }

  const emailField = normalizeSheetText(getSheetField(row, "Email"));
  const sourceField = normalizeSheetText(getSheetField(row, "Source"));
  const projectField = normalizeSheetText(getSheetField(row, "Project Interest"));
  const assigned = assignSplitPhones(getSheetField(row, "Phone"));
  for (const fragment of assigned.dropped) {
    warnings.push(`Dropped "${fragment}" (not a phone number)`);
  }

  // Rows with no name and no contact info (e.g. a lone Stage cell left
  // behind by row clears) are not leads — skip instead of minting
  // "Lead N" placeholders.
  if (!nameField && !assigned.primary && !emailField) {
    return { lead: null, note: null, warnings, skipped: "row has no name or contact info" };
  }

  const customData: Record<string, unknown> = {
    ...buildSheetTracking(options.sheetId, options.sheetTab, options.sheetRow),
  };
  if (leadType) customData.lead_type = leadType;
  if (budget != null) {
    customData.budget = budget;
    if (isRangedBudget(budgetRaw)) customData.budget_raw = budgetRaw;
  }
  if (lastCall) customData.last_call_date = lastCall;
  if (assigned.extras.length > 0) customData.additional_phones = assigned.extras;

  return {
    lead: {
      name,
      phone: assigned.primary,
      alt_phone: assigned.alt,
      email: emailField.toLowerCase() || null,
      source: sourceField || null,
      stage_id: stageId,
      project_interest: projectField || null,
      acquired_date: acquiredDate,
      custom_data: customData,
    },
    note: getSheetField(row, "Notes") || null,
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
  const unitNumber = getSheetField(row, "Unit Number");
  if (!unitNumber) {
    return { unit: null, note: null, warnings, error: "Unit Number is required" };
  }

  const projectName = getSheetField(row, "Project");
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

  const area = parseSheetNumber(getSheetField(row, "Area (sq.ft.)"), "Area");
  if (area.error) return { unit: null, note: null, warnings, error: area.error };
  const price = parseSheetNumber(getSheetField(row, "Price"), "Price");
  if (price.error) return { unit: null, note: null, warnings, error: price.error };
  const floor = parseSheetNumber(getSheetField(row, "Floor"), "Floor");
  if (floor.error) return { unit: null, note: null, warnings, error: floor.error };
  const parking = parseSheetNumber(getSheetField(row, "Parking"), "Parking");
  if (parking.error) return { unit: null, note: null, warnings, error: parking.error };

  const statusRaw = getSheetField(row, "Status").toLowerCase();
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
  const facing = getSheetField(row, "Facing");
  if (facing) customData.facing = facing;
  if (parking.value != null) customData.car_parking = parking.value;
  const ownerName = getSheetField(row, "Owner Name");
  if (ownerName) customData.owner_name = ownerName;
  const ownerPhones = splitPhoneCell(getSheetField(row, "Owner Phone"));
  if (ownerPhones.numbers[0]) customData.owner_phone = ownerPhones.numbers[0];
  for (const extra of ownerPhones.numbers.slice(1)) {
    warnings.push(`Extra owner phone kept in remarks: ${extra}`);
  }
  for (const fragment of ownerPhones.dropped) {
    warnings.push(`Dropped "${fragment}" (not a phone number)`);
  }

  const dateRaw = getSheetField(row, "Date");
  const acquiredDate = parseSheetDate(dateRaw);
  if (dateRaw && !acquiredDate) {
    warnings.push(`Could not parse date "${dateRaw}"`);
  }

  return {
    unit: {
      unit_number: unitNumber,
      project_id: projectId,
      unit_type: getSheetField(row, "Type") || null,
      area_sqft: area.value,
      price: price.value,
      status,
      acquired_date: acquiredDate,
      custom_data: customData,
    },
    note: mergeRemarksPhones(getSheetField(row, "Remarks"), ownerPhones.numbers.slice(1)),
    warnings,
  };
}

/** Column order for rows appended to the Leads tab. */
export const LEAD_SHEET_HEADERS = [
  "Date",
  "Name",
  "Phone",
  "Email",
  "Stage",
  "Source",
  "Lead Type",
  "Project Interest",
  "Budget",
  "Last Date of Call",
  "Notes",
] as const;

/**
 * One lead in merge-comparable form. Both the sheet row and the app record
 * reduce to this shape so change detection compares like with like
 * (formatting differences like "₹1.5 Cr - ₹2.0 Cr" vs 1.75 don't count).
 */
export interface LeadCanonical {
  name: string;
  /** Comma-joined normalized numbers (primary, alt, extras). */
  phone: string;
  email: string;
  /** Stage label, or null when blank/unknown. */
  stage: string | null;
  source: string;
  leadType: string;
  project: string;
  budget: number | null;
  /** ISO date or null. */
  date: string | null;
  lastCall: string | null;
}

export type LeadCanonicalField = keyof LeadCanonical;

export const LEAD_CANONICAL_FIELDS: LeadCanonicalField[] = [
  "name",
  "phone",
  "email",
  "stage",
  "source",
  "leadType",
  "project",
  "budget",
  "date",
  "lastCall",
];

export const LEAD_FIELD_HEADERS: Record<LeadCanonicalField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  stage: "Stage",
  source: "Source",
  leadType: "Lead Type",
  project: "Project Interest",
  budget: "Budget",
  date: "Date",
  lastCall: "Last Date of Call",
};

export const LEAD_FIELD_LABELS: Record<LeadCanonicalField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  stage: "Stage",
  source: "Source",
  leadType: "Lead Type",
  project: "Project Interest",
  budget: "Budget",
  date: "Date",
  lastCall: "Last Date of Call",
};

export function canonicalFromSheetRow(
  row: Record<string, string>,
  stages: PipelineStage[]
): LeadCanonical {
  const stageRaw = getSheetField(row, "Stage");
  const stageMatch = stageRaw
    ? stages.find((s) => s.label.toLowerCase() === stageRaw.toLowerCase())
    : undefined;
  return {
    name: normalizeSheetText(getSheetField(row, "Name")),
    phone: splitPhoneCell(getSheetField(row, "Phone")).numbers.join(", "),
    email: normalizeSheetText(getSheetField(row, "Email")).toLowerCase(),
    stage: stageMatch ? stageMatch.label : null,
    source: normalizeSheetText(getSheetField(row, "Source")),
    leadType: normalizeSheetText(getSheetField(row, "Lead Type")),
    project: normalizeSheetText(getSheetField(row, "Project Interest")),
    budget: parseBudgetCr(getSheetField(row, "Budget")),
    date: parseSheetDate(getSheetField(row, "Date")),
    lastCall: parseSheetDate(getSheetField(row, "Last Date of Call")),
  };
}

export interface AppLeadForCanonical {
  name: string;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  source: string | null;
  stage_id: string | null;
  project_interest: string | null;
  acquired_date: string | null;
  custom_data: unknown;
}

export function canonicalFromAppLead(
  lead: AppLeadForCanonical,
  stages: PipelineStage[]
): LeadCanonical {
  const custom = (lead.custom_data ?? {}) as Record<string, unknown>;
  const extras = Array.isArray(custom.additional_phones)
    ? (custom.additional_phones as unknown[]).filter(
        (p): p is string => typeof p === "string" && Boolean(p)
      )
    : [];
  // Same normalization as the sheet side (splitPhoneCell) so stored numbers
  // compare stable instead of flapping between formats every sync.
  const phone = [lead.phone, lead.alt_phone, ...extras]
    .map((p) => normalizeStoredPhone(p))
    .filter((p): p is string => Boolean(p))
    .join(", ");
  const budget = custom.budget;
  const leadType = custom.lead_type;
  const lastCall = custom.last_call_date;
  return {
    name: lead.name ?? "",
    phone,
    email: (lead.email ?? "").toLowerCase(),
    stage: stages.find((s) => s.id === lead.stage_id)?.label ?? null,
    source: lead.source ?? "",
    leadType: typeof leadType === "string" ? leadType : "",
    project: lead.project_interest ?? "",
    budget: typeof budget === "number" ? budget : null,
    date: lead.acquired_date ?? null,
    lastCall: typeof lastCall === "string" ? lastCall : null,
  };
}

export type CanonicalValue = string | number | null;
export type MergeAction = "none" | "toApp" | "toSheet" | "conflict";

/**
 * Three-way merge decision for one field: the side that differs from the
 * last-synced snapshot is the side that changed. Both changed = conflict
 * (caller keeps the app value and warns).
 */
export function resolveField(
  snapshot: CanonicalValue,
  sheet: CanonicalValue,
  app: CanonicalValue
): MergeAction {
  const sheetChanged = sheet !== snapshot;
  const appChanged = app !== snapshot;
  if (sheetChanged && appChanged) return "conflict";
  if (sheetChanged) return "toApp";
  if (appChanged) return "toSheet";
  return "none";
}

/** Blank sheet cells never wipe app values (blank = unknown, not deletion). */
export function isBlankCanon(value: CanonicalValue): boolean {
  return value == null || value === "";
}

/**
 * Seed the snapshot for a lead that has never merged. Stage seeds from the
 * sheet (stages are worked in the app, so any difference is app work to push
 * back); every other field seeds from the app (sheet differences flow in).
 * An uninitialized app stage (null) seeds from the sheet instead so a blank
 * app stage can never wipe the sheet's stage on first merge.
 */
export function seedSheetSnapshot(
  sheet: LeadCanonical,
  app: LeadCanonical
): LeadCanonical {
  return { ...app, stage: app.stage == null ? app.stage : sheet.stage };
}

/** Read a stored snapshot defensively; null when missing or malformed. */
export function readSnapshot(customData: unknown): LeadCanonical | null {
  const holder = customData as { sheet_snapshot?: unknown } | null;
  const raw = holder?.sheet_snapshot;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const str = (value: unknown): string => (typeof value === "string" ? value : "");
  const strNull = (value: unknown): string | null =>
    typeof value === "string" ? value : null;
  return {
    name: str(record.name),
    phone: str(record.phone),
    email: str(record.email),
    stage: strNull(record.stage),
    source: str(record.source),
    leadType: str(record.leadType),
    project: str(record.project),
    budget: typeof record.budget === "number" ? record.budget : null,
    date: strNull(record.date),
    lastCall: strNull(record.lastCall),
  };
}

/** Format one canonical field back to its sheet-cell text (round-trips). */
export function formatCanonicalFieldForSheet(
  field: LeadCanonicalField,
  canon: LeadCanonical
): string {
  const value = canon[field];
  if (value == null) return "";
  if (field === "budget") return `${value} Cr`;
  return String(value);
}

/** Format a full canonical lead as sheet cells keyed by header. */
export function formatCanonicalForSheet(
  canon: LeadCanonical
): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const field of LEAD_CANONICAL_FIELDS) {
    cells[LEAD_FIELD_HEADERS[field]] = formatCanonicalFieldForSheet(field, canon);
  }
  cells.Notes = "";
  return cells;
}
