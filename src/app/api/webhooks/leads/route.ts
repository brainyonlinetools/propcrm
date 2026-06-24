import { NextResponse } from "next/server";
import type { Json } from "@/types/database";
import { unauthorized, verifyBearerSecret } from "@/lib/apiAuth";
import { mapMetaRowToLead, type MetaSheetRow } from "@/lib/metaLeadMapper";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface WebhookPayload {
  sheet_row: number;
  row: MetaSheetRow;
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
      .select("id")
      .filter("custom_data->>meta_lead_id", "eq", metaLeadId)
      .maybeSingle();
    if (data) return data;
  }

  if (phone) {
    const { data } = await supabase.from("leads").select("id").eq("phone", phone).maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await supabase.from("leads").select("id").eq("email", email).maybeSingle();
    if (data) return data;
  }

  return null;
}

export async function POST(request: Request) {
  if (!verifyBearerSecret(request, "WEBHOOK_SECRET")) {
    return unauthorized();
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.sheet_row || !payload.row) {
    return NextResponse.json({ error: "sheet_row and row are required" }, { status: 400 });
  }

  const defaultStageId = await getDefaultStageId();
  const mapped = mapMetaRowToLead(payload.row, {
    sheetRow: payload.sheet_row,
    sheetId: process.env.GOOGLE_SHEET_ID,
    defaultStageId,
  });

  if (!mapped.lead) {
    return NextResponse.json({ error: mapped.error ?? "Invalid lead data" }, { status: 400 });
  }

  const metaLeadId =
    typeof mapped.lead.custom_data?.meta_lead_id === "string"
      ? mapped.lead.custom_data.meta_lead_id
      : null;

  const existing = await findExistingLead(metaLeadId, mapped.lead.phone ?? null, mapped.lead.email ?? null);
  if (existing) {
    return NextResponse.json({ ok: true, skipped: "duplicate", lead_id: existing.id });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id: data.id });
}
