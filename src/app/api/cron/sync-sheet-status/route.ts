import { NextResponse } from "next/server";
import type { Json } from "@/types/database";
import { verifyBearerSecret, unauthorized } from "@/lib/apiAuth";
import { updateLeadStatusColumn } from "@/lib/googleSheets";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface SheetImportedLead {
  id: string;
  stage_id: string | null;
  custom_data: Record<string, unknown> | null;
  pipeline_stages: { label: string } | null;
}

export async function GET(request: Request) {
  if (!verifyBearerSecret(request, "CRON_SECRET")) {
    return unauthorized();
  }

  const supabase = createSupabaseAdmin();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, stage_id, custom_data, pipeline_stages(label)")
    .filter("custom_data->>imported_from_sheet", "eq", "true");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updates: { row: number; status: string; leadId: string }[] = [];
  const skipped: string[] = [];

  for (const lead of (leads ?? []) as SheetImportedLead[]) {
    const customData = lead.custom_data ?? {};
    const sheetRow = customData.sheet_row;
    const stageLabel = lead.pipeline_stages?.label;

    if (typeof sheetRow !== "number" || !stageLabel) {
      skipped.push(lead.id);
      continue;
    }

    updates.push({ row: sheetRow, status: stageLabel, leadId: lead.id });
  }

  if (updates.length > 0) {
    try {
      await updateLeadStatusColumn(
        updates.map(({ row, status }) => ({ row, status }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google Sheets update failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const syncedAt = new Date().toISOString();
  for (const { leadId } of updates) {
    const lead = (leads as SheetImportedLead[]).find((l) => l.id === leadId);
    const customData = { ...(lead?.custom_data ?? {}), sheet_status_synced_at: syncedAt };

    await supabase
      .from("leads")
      .update({ custom_data: customData as Json })
      .eq("id", leadId);
  }

  return NextResponse.json({
    ok: true,
    synced: updates.length,
    skipped: skipped.length,
  });
}
