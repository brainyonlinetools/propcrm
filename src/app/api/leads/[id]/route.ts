import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Delete a lead from the app. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .single();
  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("leads").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
