import { NextResponse } from "next/server";
import { unauthorized, verifyBearerSecret } from "@/lib/apiAuth";
import { importLeadFromSheetRow } from "@/lib/importSheetLead";
import type { MetaSheetRow } from "@/lib/metaLeadMapper";

interface WebhookPayload {
  sheet_row: number;
  row: MetaSheetRow;
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

  const result = await importLeadFromSheetRow(payload.sheet_row, payload.row);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Import failed" }, { status: 400 });
  }

  if (result.skipped === "duplicate") {
    return NextResponse.json({ ok: true, skipped: "duplicate", lead_id: result.lead_id });
  }

  return NextResponse.json({ ok: true, lead_id: result.lead_id });
}
