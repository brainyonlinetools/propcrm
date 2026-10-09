import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { connectedLeadsTab } from "@/lib/connectedSheetMapper";
import {
  clearTrackedSheetRow,
  type SheetIdentityCheck,
} from "@/lib/googleSheets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Delete a lead from the app. When the lead is tracked to a row of the
 * connected sheet, that row's cells are cleared too (the row itself stays
 * in place so every other tracked row number remains valid).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, phone, email, custom_data")
    .eq("id", id)
    .single();
  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const tracking = (lead.custom_data ?? {}) as Record<string, unknown>;

  const { error: deleteError } = await supabase.from("leads").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID ?? "";
  const tab = connectedLeadsTab();
  const sheetRow = tracking.sheet_row;
  if (
    tracking.imported_from_sheet !== true ||
    tracking.sheet_id !== sheetId ||
    tracking.sheet_tab !== tab ||
    typeof sheetRow !== "number"
  ) {
    return NextResponse.json({ deleted: true, sheetCleared: false });
  }

  const checks: SheetIdentityCheck[] = [];
  if (lead.phone) checks.push({ header: "Phone", expected: lead.phone, kind: "phone" });
  if (lead.email) checks.push({ header: "Email", expected: lead.email, kind: "text" });

  try {
    const result = await clearTrackedSheetRow(tab, sheetRow, checks);
    if (!result.cleared) {
      return NextResponse.json({
        deleted: true,
        sheetCleared: false,
        warning:
          "Deleted from the app, but the sheet row no longer matches this lead, so it was left in place.",
      });
    }
    return NextResponse.json({ deleted: true, sheetCleared: true });
  } catch (err) {
    return NextResponse.json({
      deleted: true,
      sheetCleared: false,
      warning: `Deleted from the app, but the sheet update failed (${
        err instanceof Error ? err.message : "unknown error"
      }). The row may reappear on the next sync.`,
    });
  }
}
