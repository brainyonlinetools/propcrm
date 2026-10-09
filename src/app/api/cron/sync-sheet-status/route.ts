import { NextResponse } from "next/server";
import { verifyBearerSecret, unauthorized } from "@/lib/apiAuth";
import {
  runConnectedSheetSync,
  type ConnectedSheetTab,
} from "@/lib/connectedSheetSync";

// Manual syncs are idempotent but expensive; throttle bursts to one per minute.
let lastManualSyncAt = 0;
const MANUAL_SYNC_COOLDOWN_MS = 60_000;

/** Nightly cron: full two-way sync of both connected tabs. */
export async function GET(request: Request) {
  if (!verifyBearerSecret(request, "CRON_SECRET")) {
    return unauthorized();
  }

  try {
    const result = await runConnectedSheetSync();
    return NextResponse.json({ ok: true, ...summarize(result) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ManualSyncBody {
  tabs?: ConnectedSheetTab[];
}

/**
 * Manual "Sync now" trigger from the app. Runs the same idempotent sync and
 * returns counts only (no row data). Rate-limited; no secret required since
 * the app has no user auth and triggering a sync exposes nothing.
 */
export async function POST(request: Request) {
  const now = Date.now();
  if (now - lastManualSyncAt < MANUAL_SYNC_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Sync already ran recently, try again in a minute" },
      { status: 429 }
    );
  }

  let tabs: ConnectedSheetTab[] = ["leads", "inventory"];
  try {
    const body = (await request.json()) as ManualSyncBody;
    if (Array.isArray(body.tabs) && body.tabs.length > 0) {
      const valid = body.tabs.filter(
        (t): t is ConnectedSheetTab => t === "leads" || t === "inventory"
      );
      if (valid.length > 0) tabs = valid;
    }
  } catch {
    // No (valid) body: sync everything.
  }

  lastManualSyncAt = now;
  try {
    const result = await runConnectedSheetSync(tabs);
    return NextResponse.json({ ok: true, ...summarize(result, tabs) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function summarize(
  result: Awaited<ReturnType<typeof runConnectedSheetSync>>,
  tabs: ConnectedSheetTab[] = ["leads", "inventory"]
) {
  const summary: Record<string, unknown> = {};
  if (tabs.includes("leads")) {
    summary.leads = {
      created: result.leads.created,
      repointed: result.leads.repointed,
      writtenBack: result.writeBack.leads.synced,
      warnings: result.leads.warnings.slice(0, 5),
      errors: result.leads.errors.slice(0, 5),
    };
  }
  if (tabs.includes("inventory")) {
    summary.inventory = {
      created: result.inventory.created,
      repointed: result.inventory.repointed,
      writtenBack: result.writeBack.inventory.synced,
      warnings: result.inventory.warnings.slice(0, 5),
      errors: result.inventory.errors.slice(0, 5),
    };
  }
  return summary;
}
