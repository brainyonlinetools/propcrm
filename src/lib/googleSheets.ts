import { google } from "googleapis";

export interface LeadStatusUpdate {
  row: number;
  status: string;
}

function getSheetsClient() {
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
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!1:1`,
  });

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

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}
