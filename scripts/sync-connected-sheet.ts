/**
 * Two-way sync with the connected Google Sheet (Leads + Inventory tabs).
 *
 * Usage (from project root, requires .env.local):
 *   npx tsx scripts/sync-connected-sheet.ts [leads|inventory]
 *
 * Same operation the nightly cron and the in-app Sync-now buttons run:
 * imports new sheet rows, then writes stage/status back to the sheet.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  runConnectedSheetSync,
  type ConnectedSheetTab,
} from "../src/lib/connectedSheetSync";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const arg = process.argv[2];
  const tabs: ConnectedSheetTab[] =
    arg === "leads" || arg === "inventory" ? [arg] : ["leads", "inventory"];

  console.log(`Syncing tabs: ${tabs.join(", ")}...`);
  const result = await runConnectedSheetSync(tabs);

  for (const tab of tabs) {
    const r = result[tab];
    const wb = result.writeBack[tab];
    console.log(`\n[${tab}] created=${r.created} repointed=${r.repointed} writtenBack=${wb.synced} skipped=${wb.skipped}`);
    for (const w of r.warnings.slice(0, 10)) console.log(`  WARN: ${w}`);
    for (const e of r.errors.slice(0, 10)) console.log(`  ERROR: ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
