import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Must match INVENTORY_MEDIA_BUCKET in lib/queries/inventory.ts.
const MEDIA_BUCKET = "inventory-media";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Delete an inventory unit (and its stored media) from the app.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: unit, error: fetchError } = await supabase
    .from("inventory")
    .select("id")
    .eq("id", id)
    .single();
  if (fetchError || !unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
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

  return NextResponse.json({ deleted: true });
}
