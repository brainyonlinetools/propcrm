/**
 * Meta Leads Google Sheet → Anand Prime CRM sync
 *
 * Setup:
 * 1. Extensions → Apps Script → paste this file
 * 2. Set WEBHOOK_URL and WEBHOOK_SECRET below
 * 3. Run installTrigger() once to create the onChange trigger
 */

const WEBHOOK_URL = "https://your-app.vercel.app/api/webhooks/leads";
const WEBHOOK_SECRET = "c7a9fa279fa7eeb4f1641d3ac700431281eca1f67d005b0a2e09ae0055b7eb3d";

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

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
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
  if (code < 200 || code >= 300) {
    throw new Error("Webhook returned " + code + ": " + response.getContentText());
  }
}

function testSyncLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No data rows found");
  }
  syncRow(sheet, lastRow);
}
