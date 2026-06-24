/**
 * Backfill all Meta leads from Google Sheet into Supabase.
 *
 * Usage (from project root, requires .env.local):
 *   npm run backfill:sheet
 *
 * Options:
 *   --dry-run   Print what would be imported without writing
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { readMetaLeadRows } from "../src/lib/googleSheets";
import { importLeadFromSheetRow } from "../src/lib/importSheetLead";

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

  const dryRun = process.argv.includes("--dry-run");

  console.log("Reading rows from Google Sheet...");
  const rows = await readMetaLeadRows();
  console.log(`Found ${rows.length} data rows.\n`);

  if (dryRun) {
    rows.slice(0, 5).forEach(({ sheetRow, row }) => {
      console.log(`Row ${sheetRow}: ${row.full_name} (${row.id})`);
    });
    if (rows.length > 5) console.log(`... and ${rows.length - 5} more`);
    return;
  }

  let created = 0;
  let duplicates = 0;
  let updated = 0;
  let invalid = 0;
  let failed = 0;

  for (const { sheetRow, row } of rows) {
    const result = await importLeadFromSheetRow(sheetRow, row, { updateOnDuplicate: true });

    if (!result.ok) {
      failed++;
      console.error(`Row ${sheetRow} FAILED: ${result.error}`);
      continue;
    }

    if (result.skipped === "invalid") {
      invalid++;
      console.warn(`Row ${sheetRow} SKIPPED (invalid): ${result.error}`);
      continue;
    }

    if (result.skipped === "duplicate") {
      duplicates++;
      if (result.updated) {
        updated++;
        console.log(`Row ${sheetRow} UPDATED (existing): ${row.full_name}`);
      } else {
        console.log(`Row ${sheetRow} DUPLICATE: ${row.full_name}`);
      }
      continue;
    }

    created++;
    console.log(`Row ${sheetRow} CREATED: ${row.full_name}`);
  }

  console.log("\n--- Backfill complete ---");
  console.log(`Created:    ${created}`);
  console.log(`Duplicate:  ${duplicates} (${updated} updated with sheet_row)`);
  console.log(`Invalid:    ${invalid}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Total rows: ${rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
