import type { Json } from "@/types/database";
import { mapMetaRowToLead, type MetaSheetRow } from "@/lib/metaLeadMapper";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export interface ImportLeadResult {
  ok: boolean;
  lead_id?: string;
  skipped?: "duplicate" | "invalid";
  updated?: boolean;
  error?: string;
}

async function getDefaultStageId() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  return data.id;
}

async function findExistingLead(metaLeadId: string | null, phone: string | null, email: string | null) {
  const supabase = createSupabaseAdmin();

  if (metaLeadId) {
    const { data } = await supabase
      .from("leads")
      .select("id, custom_data")
      .filter("custom_data->>meta_lead_id", "eq", metaLeadId)
      .maybeSingle();
    if (data) return data;
  }

  if (phone) {
    const { data } = await supabase
      .from("leads")
      .select("id, custom_data")
      .eq("phone", phone)
      .maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await supabase
      .from("leads")
      .select("id, custom_data")
      .eq("email", email)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

export async function importLeadFromSheetRow(
  sheetRow: number,
  row: MetaSheetRow,
  options?: { updateOnDuplicate?: boolean }
): Promise<ImportLeadResult> {
  const defaultStageId = await getDefaultStageId();
  const mapped = mapMetaRowToLead(row, {
    sheetRow,
    sheetId: process.env.GOOGLE_SHEET_ID,
    defaultStageId,
  });

  if (!mapped.lead) {
    return { ok: false, skipped: "invalid", error: mapped.error ?? "Invalid lead data" };
  }

  const metaLeadId =
    typeof mapped.lead.custom_data?.meta_lead_id === "string"
      ? mapped.lead.custom_data.meta_lead_id
      : null;

  const existing = await findExistingLead(
    metaLeadId,
    mapped.lead.phone ?? null,
    mapped.lead.email ?? null
  );

  if (existing) {
    if (options?.updateOnDuplicate) {
      const supabase = createSupabaseAdmin();
      const existingCustom =
        existing.custom_data && typeof existing.custom_data === "object"
          ? (existing.custom_data as Record<string, unknown>)
          : {};
      const merged = {
        ...existingCustom,
        ...mapped.lead.custom_data,
        imported_from_sheet: true,
        sheet_row: sheetRow,
      };

      await supabase
        .from("leads")
        .update({ custom_data: merged as Json })
        .eq("id", existing.id);

      return { ok: true, skipped: "duplicate", lead_id: existing.id, updated: true };
    }

    return { ok: true, skipped: "duplicate", lead_id: existing.id };
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...mapped.lead,
      custom_data: (mapped.lead.custom_data ?? {}) as Json,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, lead_id: data.id };
}
