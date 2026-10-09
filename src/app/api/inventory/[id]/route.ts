import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { connectedInventoryTab } from "@/lib/connectedSheetMapper";
import {
  clearTrackedSheetRow,
  type SheetIdentityCheck,
} from "@/lib/googleSheets";

// Must match INVENTORY_MEDIA_BUCKET in lib/queries/inventory.ts.
const MEDIA_BUCKET = "inventory-media";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Delete an inventory unit (and its stored media) from the app. When the
 * unit is tracked to a row of the connected sheet, that row's cells are
 * cleared too (the row itself stays in place so every other tracked row
 * number remains valid).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: unit, error: fetchError } = await supabase
    .from("inventory")
    .select("id, unit_number, project_id, custom_data")
    .eq("id", id)
    .single();
  if (fetchError || !unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }
  const tracking = (unit.custom_data ?? {}) as Record<string, unknown>;

  let projectName: string | null = null;
  if (unit.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", unit.project_id)
      .single();
    projectName = project?.name ?? null;
  }

  const { data: media } = await supabase
    .from("inventory_media")
    .select("storage_path")
    .eq("inventory_id", id);
  const paths = (media ?? [])
    .map((item) => item.storage_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  }

  const { error: deleteError } = await supabase.from("inventory").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID ?? "";
  const tab = connectedInventoryTab();
  const sheetRow = tracking.sheet_row;
  if (
    tracking.imported_from_sheet !== true ||
    tracking.sheet_id !== sheetId ||
    tracking.sheet_tab !== tab ||
    typeof sheetRow !== "number"
  ) {
    return NextResponse.json({ deleted: true, sheetCleared: false });
  }

  const checks: SheetIdentityCheck[] = [
    { header: "Unit Number", expected: unit.unit_number, kind: "text" },
  ];
  if (projectName) {
    checks.push({ header: "Project", expected: projectName, kind: "text" });
  }

  try {
    const result = await clearTrackedSheetRow(tab, sheetRow, checks);
    if (!result.cleared) {
      return NextResponse.json({
        deleted: true,
        sheetCleared: false,
        warning:
          "Deleted from the app, but the sheet row no longer matches this unit, so it was left in place.",
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
