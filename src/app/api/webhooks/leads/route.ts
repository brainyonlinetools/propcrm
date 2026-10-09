import { NextResponse } from "next/server";

/**
 * Retired: the Meta-leads Apps Script sync was replaced by the connected
 * sheet (Leads + Inventory tabs) two-way sync at /api/cron/sync-sheet-status.
 * Kept as 410 Gone so a stale Apps Script trigger on the old sheet fails
 * loudly instead of importing rows against the wrong sheet.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Meta leads sync retired. Use the connected Google Sheet." },
    { status: 410 }
  );
}
