import { google } from "googleapis";

export interface LeadStatusUpdate {
  row: number;
  status: string;
}

export function getSheetsClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  const credentials = JSON.parse(json) as {
    client_email: string;
    private_key: string;
  };

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export interface SheetsErrorContext {
  tab: string;
}

/**
 * Translate raw Google Sheets API failures into actionable sync errors.
 * Google returns a bare 404 ("Requested entity was not found.") both when
 * the spreadsheet ID is wrong and when the sheet isn't shared with the
 * service account, so spell out both checks.
 */
export function describeSheetsError(err: unknown, context: SheetsErrorContext): string {
  const holder = err as { code?: unknown; status?: unknown };
  const codes = [holder?.code, holder?.status]
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const message = err instanceof Error ? err.message : String(err);
  if (codes.includes(404) || /requested entity was not found/i.test(message)) {
    return (
      `Cannot open the connected spreadsheet (tab "${context.tab}"): ` +
      `spreadsheet not found or not shared with the service account. ` +
      `Check that GOOGLE_SHEET_ID is the bare spreadsheet ID and the sheet ` +
      `is shared with the service account as Editor.`
    );
  }
  if (/unable to parse range/i.test(message)) {
    return (
      `Tab "${context.tab}" was not found in the connected spreadsheet. ` +
      `Check GOOGLE_SHEET_LEADS_TAB and GOOGLE_SHEET_INVENTORY_TAB.`
    );
  }
  return message;
}

function columnIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export async function getColumnIndexByHeader(
  sheetId: string,
  sheetName: string,
  headerName: string
): Promise<number> {
  const sheets = getSheetsClient();
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!1:1`,
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: sheetName }));
  }

  const headers = response.data.values?.[0] ?? [];
  const index = headers.findIndex(
    (h) => String(h).trim().toLowerCase() === headerName.trim().toLowerCase()
  );

  if (index === -1) {
    throw new Error(`Column "${headerName}" not found in sheet header row`);
  }

  return index;
}

export async function updateLeadStatusColumn(
  updates: LeadStatusUpdate[],
  options?: { sheetName?: string; statusColumn?: string }
): Promise<void> {
  if (updates.length === 0) return;

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }

  const sheetName = options?.sheetName ?? process.env.GOOGLE_SHEET_NAME ?? "Sheet1";
  const statusColumn = options?.statusColumn ?? process.env.GOOGLE_SHEET_STATUS_COLUMN ?? "lead_status";

  const columnIndex = await getColumnIndexByHeader(sheetId, sheetName, statusColumn);
  const columnLetter = columnIndexToLetter(columnIndex);
  const sheets = getSheetsClient();

  const data = updates.map(({ row, status }) => ({
    range: `${sheetName}!${columnLetter}${row}`,
    values: [[status]],
  }));

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: sheetName }));
  }
}

export interface SheetLeadRow {
  sheetRow: number;
  row: Record<string, string>;
}

/** Generic tab reader keyed by the tab's own header row. Skips fully-empty rows. */
export async function readSheetTab(tabName: string): Promise<SheetLeadRow[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }

  const sheets = getSheetsClient();
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:ZZ`,
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: tabName }));
  }

  const values = response.data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim());
  const rows: SheetLeadRow[] = [];

  for (let i = 1; i < values.length; i++) {
    const line = values[i];
    const row: Record<string, string> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const cell = line[index];
      const value = cell != null ? String(cell).trim() : "";
      row[header] = value;
      if (value) hasValue = true;
    });

    if (!hasValue) continue;
    rows.push({ sheetRow: i + 1, row });
  }

  return rows;
}

export async function readMetaLeadRows(
  options?: { sheetName?: string }
): Promise<SheetLeadRow[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }

  const sheetName = options?.sheetName ?? process.env.GOOGLE_SHEET_NAME ?? "Sheet1";
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:ZZ`,
  });

  const values = response.data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim());
  const rows: SheetLeadRow[] = [];

  for (let i = 1; i < values.length; i++) {
    const line = values[i];
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      if (!header) return;
      const cell = line[index];
      row[header] = cell != null ? String(cell) : "";
    });

    if (!row.full_name && !row.id) continue;

    rows.push({ sheetRow: i + 1, row });
  }

  return rows;
}
