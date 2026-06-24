/**
 * Meta Leads Google Sheet → Anand Prime CRM sync
 *
 * Setup:
 * 1. Extensions → Apps Script → paste this file
 * 2. Set WEBHOOK_URL and WEBHOOK_SECRET below
 * 3. Run installTrigger() once to create the onChange trigger
 */

const WEBHOOK_URL = "https://your-app.vercel.app/api/webhooks/leads";
const WEBHOOK_SECRET = "your-webhook-secret";
const SHEET_TAB_NAME = "fresh2026";

const BACKFILL_BATCH_SIZE = 50;

const SHEET_COLUMNS = [
  "id",
  "created_time",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "form_id",
  "form_name",
  "is_organic",
  "platform",
  "what_is_your_budget_for_investment?",
  "what_is_your_preferred_size?",
  "full_name",
  "phone_number",
  "email",
  "lead_status",
];

function getLeadsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAB_NAME);
  if (!sheet) {
    throw new Error('Sheet tab "' + SHEET_TAB_NAME + '" not found');
  }
  return sheet;
}

function installTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === "onSheetChange") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("onSheetChange")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();
}

function onSheetChange(e) {
  if (!e || e.changeType !== "INSERT_ROW") return;

  const sheet = getLeadsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const props = PropertiesService.getScriptProperties();
  const lastProcessed = Number(props.getProperty("lastProcessedRow") || "1");
  if (lastRow <= lastProcessed) return;

  for (let row = Math.max(2, lastProcessed + 1); row <= lastRow; row++) {
    try {
      syncRow(sheet, row);
    } catch (err) {
      console.error("Failed to sync row " + row + ": " + err);
    }
    props.setProperty("lastProcessedRow", String(row));
  }
}

function syncRow(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, SHEET_COLUMNS.length).getValues()[0];
  const values = sheet.getRange(row, 1, 1, SHEET_COLUMNS.length).getValues()[0];

  const rowData = {};
  headers.forEach(function (header, index) {
    const key = String(header).trim();
    const value = values[index];
    rowData[key] = value != null ? String(value) : "";
  });

  if (!rowData.full_name && !rowData.id) return;

  const payload = {
    sheet_row: row,
    row: rowData,
  };

  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + WEBHOOK_SECRET,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Webhook returned " + code + ": " + body);
  }

  try {
    return JSON.parse(body);
  } catch (err) {
    return { ok: true };
  }
}

function testSyncLastRow() {
  const sheet = getLeadsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No data rows found");
  }
  syncRow(sheet, lastRow);
}

/**
 * Backfill: sync ALL existing rows to the CRM.
 * Run once from Apps Script editor. Safe to re-run — duplicates are skipped.
 *
 * For large sheets (500+ rows), use backfillBatch() instead (run repeatedly).
 */
function backfillAllRows() {
  const sheet = getLeadsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No data rows found");
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let row = 2; row <= lastRow; row++) {
    try {
      const result = syncRow(sheet, row);
      if (result && result.skipped) {
        skipped++;
      } else {
        created++;
      }
    } catch (err) {
      failed++;
      console.error("Row " + row + " failed: " + err);
    }

    if (row % 10 === 0) {
      Utilities.sleep(500);
    }
  }

  PropertiesService.getScriptProperties().setProperty("lastProcessedRow", String(lastRow));
  console.log("Backfill done. created=" + created + " skipped=" + skipped + " failed=" + failed);
}

/**
 * Backfill in batches (avoids Apps Script 6-minute timeout).
 * Run backfillBatch() repeatedly until it logs "Nothing left to backfill".
 */
function backfillBatch() {
  const sheet = getLeadsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No data rows found");
  }

  const props = PropertiesService.getScriptProperties();
  const startRow = Number(props.getProperty("backfillCursor") || "2");

  if (startRow > lastRow) {
    console.log("Nothing left to backfill. Reset with resetBackfillCursor() to start over.");
    return;
  }

  const endRow = Math.min(startRow + BACKFILL_BATCH_SIZE - 1, lastRow);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let row = startRow; row <= endRow; row++) {
    try {
      const result = syncRow(sheet, row);
      if (result && result.skipped) {
        skipped++;
      } else {
        created++;
      }
    } catch (err) {
      failed++;
      console.error("Row " + row + " failed: " + err);
    }
  }

  props.setProperty("backfillCursor", String(endRow + 1));
  props.setProperty("lastProcessedRow", String(endRow));

  console.log(
    "Batch rows " + startRow + "-" + endRow + ": created=" + created +
    " skipped=" + skipped + " failed=" + failed
  );

  if (endRow < lastRow) {
    console.log("Run backfillBatch() again for the next batch.");
  } else {
    console.log("Backfill complete.");
  }
}

function resetBackfillCursor() {
  PropertiesService.getScriptProperties().deleteProperty("backfillCursor");
  console.log("Backfill cursor reset. Next backfillBatch() starts from row 2.");
}
