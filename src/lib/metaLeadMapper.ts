import { format } from "date-fns";
import type { LeadInsert } from "@/types";

export const META_SHEET_COLUMNS = [
  "id",
  "created_time",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "form_id",
  "form_name",
  "is_organic",
  "platform",
  "what_is_your_budget_for_investment?",
  "what_is_your_preferred_size?",
  "full_name",
  "phone_number",
  "email",
  "lead_status",
] as const;

export type MetaSheetRow = Record<string, string | undefined>;

export interface MapMetaLeadOptions {
  sheetRow: number;
  sheetId?: string;
  defaultStageId: string | null;
}

export interface MapMetaLeadResult {
  lead: LeadInsert | null;
  error?: string;
}

const CONFIGURATION_VALUES = ["2BHK", "3BHK", "4BHK", "Penthouse"] as const;

export function parseMetaPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^p:/i, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits || null;
}

export function parseMetaCreatedTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "yyyy-MM-dd");
}

export function parseMetaBudget(raw: string | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/_/g, " ").trim();

  const moreThanMatch = normalized.match(/more\s+than\s+([\d.]+)/);
  if (moreThanMatch) {
    const value = Number(moreThanMatch[1]);
    return Number.isNaN(value) ? null : value;
  }

  const numbers = [...normalized.matchAll(/([\d.]+)\s*(?:cr)?/g)].map((m) => Number(m[1]));
  const valid = numbers.filter((n) => !Number.isNaN(n));
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  return (valid[0] + valid[1]) / 2;
}

export function parseMetaConfiguration(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d)\s*bhk/i);
  if (!match) return null;
  const value = `${match[1]}BHK` as (typeof CONFIGURATION_VALUES)[number];
  return CONFIGURATION_VALUES.includes(value) ? value : null;
}

export function mapMetaRowToLead(
  row: MetaSheetRow,
  options: MapMetaLeadOptions
): MapMetaLeadResult {
  const name = row.full_name?.trim();
  if (!name) {
    return { lead: null, error: "full_name is required" };
  }

  const budgetRaw = row["what_is_your_budget_for_investment?"];
  const sizeRaw = row.what_is_your_preferred_size;
  const budget = parseMetaBudget(budgetRaw);
  const configuration = parseMetaConfiguration(sizeRaw);

  const customData: Record<string, unknown> = {
    imported_from_sheet: true,
    sheet_row: options.sheetRow,
    meta_lead_id: row.id?.trim() || null,
  };

  if (options.sheetId) customData.sheet_id = options.sheetId;
  if (budgetRaw) customData.meta_budget_raw = budgetRaw;
  if (sizeRaw) customData.meta_size_raw = sizeRaw;
  if (budget != null) customData.budget = budget;
  if (configuration) customData.configuration = configuration;

  const metadataKeys = [
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "form_id",
    "form_name",
    "is_organic",
    "platform",
  ] as const;

  for (const key of metadataKeys) {
    const value = row[key]?.trim();
    if (value) customData[key] = value;
  }

  return {
    lead: {
      name,
      phone: parseMetaPhone(row.phone_number),
      email: row.email?.trim().toLowerCase() || null,
      source: "Meta",
      stage_id: options.defaultStageId,
      project_interest: row.campaign_name?.trim() || row.form_name?.trim() || null,
      acquired_date: parseMetaCreatedTime(row.created_time),
      custom_data: customData,
    },
  };
}
