import { google } from "googleapis";
import { normalizePhoneKey } from "@/lib/utils";

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
  if (/exceeds grid limits/i.test(message)) {
    return (
      `Cannot write to tab "${context.tab}": a tracked sheet row no longer exists ` +
      `in the sheet (it was deleted and the sheet shrank). Re-run sync so the ` +
      `surviving rows are re-matched, then update again.`
    );
  }
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

export interface SheetGridLimits {
  rowCount: number;
  columnCount: number;
  /** Numeric tab id, for grid-property updates. */
  sheetId: number;
}

export interface StatusWriteResult {
  updated: number;
  skippedRows: number[];
}

export interface SheetCellWrite {
  row: number;
  header: string;
  value: string;
}

export interface SheetCellsWriteResult {
  writtenCells: number;
  writtenRows: number;
  skippedRows: number[];
}

/** Header row of one tab, in column order. */
export async function readSheetHeaders(sheetId: string, sheetName: string): Promise<string[]> {
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
  return (response.data.values?.[0] ?? []).map((h) => String(h ?? ""));
}

/**
 * Write arbitrary cells by header name, skipping rows outside the current
 * grid (same stale-row protection as the status write-back).
 */
export async function writeSheetCells(
  sheetName: string,
  cells: SheetCellWrite[]
): Promise<SheetCellsWriteResult> {
  if (cells.length === 0) return { writtenCells: 0, writtenRows: 0, skippedRows: [] };
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }

  const [headers, limits] = await Promise.all([
    readSheetHeaders(sheetId, sheetName),
    getSheetGridLimits(sheetId, sheetName),
  ]);
  const columnByHeader = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = header.trim().toLowerCase();
    if (key && !columnByHeader.has(key)) columnByHeader.set(key, index);
  });

  const skippedRows: number[] = [];
  const data: { range: string; values: string[][] }[] = [];
  const writtenRowSet = new Set<number>();
  for (const cell of cells) {
    const column = columnByHeader.get(cell.header.trim().toLowerCase());
    if (column === undefined) {
      throw new Error(`Column "${cell.header}" not found in sheet header row`);
    }
    const { inBounds } = partitionInBoundsUpdates(
      [{ row: cell.row, status: cell.value }],
      column,
      limits
    );
    if (inBounds.length === 0) {
      skippedRows.push(cell.row);
      continue;
    }
    data.push({
      range: `${sheetName}!${columnIndexToLetter(column)}${cell.row}`,
      values: [[cell.value]],
    });
    writtenRowSet.add(cell.row);
  }
  if (data.length === 0) {
    return { writtenCells: 0, writtenRows: 0, skippedRows };
  }

  const sheets = getSheetsClient();
  for (let i = 0; i < data.length; i += WRITE_CHUNK_SIZE) {
    try {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: data.slice(i, i + WRITE_CHUNK_SIZE),
        },
      });
    } catch (err) {
      throw new Error(describeSheetsError(err, { tab: sheetName }));
    }
  }
  return { writtenCells: data.length, writtenRows: writtenRowSet.size, skippedRows };
}

/** A1 range for an explicit append block starting at column A. */
export function appendRangeFor(
  sheetName: string,
  startRow: number,
  rowCount: number,
  width: number
): string {
  const endCol = columnIndexToLetter(Math.max(0, width - 1));
  return `${sheetName}!A${startRow}:${endCol}${startRow + rowCount - 1}`;
}

/** Compare a written block against a read-back, ignoring trimmed trailing empties. */
export function blocksMatch(expected: string[][], actual: unknown[][] | undefined): boolean {
  const trim = (row: unknown[]): string[] => {
    const cells = row.map((c) => String(c ?? ""));
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    return cells;
  };
  if ((actual ?? []).length !== expected.length) return false;
  return expected.every(
    (row, i) => JSON.stringify(trim(row)) === JSON.stringify(trim(actual![i] ?? []))
  );
}

/**
 * Append rows at an explicit start row via values.update. values.append's
 * table inference once placed rows in the wrong columns, so callers compute
 * startRow from the rows they just read and the write is verified by
 * read-back (mismatches are cleared and thrown, never silently kept).
 */
export async function appendSheetRows(
  sheetName: string,
  startRow: number,
  rows: string[][]
): Promise<{ startRow: number; appended: number }> {
  if (rows.length === 0) return { startRow, appended: 0 };
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }
  if (!Number.isInteger(startRow) || startRow < 2) {
    throw new Error(`Cannot append to ${sheetName} at row ${startRow}`);
  }
  const width = Math.max(...rows.map((r) => r.length));
  const range = appendRangeFor(sheetName, startRow, rows.length, width);

  await ensureSheetRows(sheetId, sheetName, startRow + rows.length - 1);

  const sheets = getSheetsClient();
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: sheetName }));
  }

  let check;
  try {
    check = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: sheetName }));
  }
  if (!blocksMatch(rows, check.data.values as unknown[][] | undefined)) {
    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range });
    throw new Error(
      `Appended rows to "${sheetName}" did not verify at ${range}; the range was cleared, try sync again.`
    );
  }
  return { startRow, appended: rows.length };
}

/** Grow a tab's grid so it holds at least minRows rows (no-op when it fits). */
export async function ensureSheetRows(
  sheetId: string,
  sheetName: string,
  minRows: number
): Promise<void> {
  const limits = await getSheetGridLimits(sheetId, sheetName);
  if (minRows <= limits.rowCount) return;
  const sheets = getSheetsClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: limits.sheetId,
                gridProperties: { rowCount: minRows },
              },
              fields: "gridProperties.rowCount",
            },
          },
        ],
      },
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: sheetName }));
  }
}

/** Ranges per values.batchUpdate call; keeps payloads small and failures contained. */
const WRITE_CHUNK_SIZE = 500;

/** Current grid dimensions of one tab (row/column counts shrink when rows are deleted). */
export async function getSheetGridLimits(
  sheetId: string,
  sheetName: string
): Promise<SheetGridLimits> {
  const sheets = getSheetsClient();
  let response;
  try {
    response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: "sheets.properties.title,sheets.properties.sheetId,sheets.properties.gridProperties",
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab: sheetName }));
  }
  const match = (response.data.sheets ?? []).find(
    (entry) => entry.properties?.title === sheetName
  );
  const grid = match?.properties?.gridProperties;
  const tabId = match?.properties?.sheetId;
  if (!grid?.rowCount || !grid?.columnCount || typeof tabId !== "number") {
    throw new Error(
      `Tab "${sheetName}" was not found in the connected spreadsheet. ` +
        `Check GOOGLE_SHEET_LEADS_TAB and GOOGLE_SHEET_INVENTORY_TAB.`
    );
  }
  return { rowCount: grid.rowCount, columnCount: grid.columnCount, sheetId: tabId };
}

/**
 * Split status writes into rows inside the current grid and rows to skip.
 * Tracked rows go stale when sheet rows are deleted (the grid shrinks), and
 * one out-of-range cell rejects the whole batchUpdate — so stale rows are
 * skipped up front instead of failing every other write. Row 1 is the header
 * and is never written.
 */
export function partitionInBoundsUpdates(
  updates: LeadStatusUpdate[],
  columnIndex: number,
  limits: SheetGridLimits
): { inBounds: LeadStatusUpdate[]; skippedRows: number[] } {
  const inBounds: LeadStatusUpdate[] = [];
  const skippedRows: number[] = [];
  const columnOk =
    Number.isInteger(columnIndex) && columnIndex >= 0 && columnIndex < limits.columnCount;
  for (const update of updates) {
    if (
      !columnOk ||
      !Number.isInteger(update.row) ||
      update.row < 2 ||
      update.row > limits.rowCount
    ) {
      skippedRows.push(update.row);
    } else {
      inBounds.push(update);
    }
  }
  return { inBounds, skippedRows };
}

export async function updateLeadStatusColumn(
  updates: LeadStatusUpdate[],
  options?: { sheetName?: string; statusColumn?: string }
): Promise<StatusWriteResult> {
  if (updates.length === 0) return { updated: 0, skippedRows: [] };

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }

  const sheetName = options?.sheetName ?? process.env.GOOGLE_SHEET_NAME ?? "Sheet1";
  const statusColumn = options?.statusColumn ?? process.env.GOOGLE_SHEET_STATUS_COLUMN ?? "lead_status";

  const [columnIndex, limits] = await Promise.all([
    getColumnIndexByHeader(sheetId, sheetName, statusColumn),
    getSheetGridLimits(sheetId, sheetName),
  ]);
  const { inBounds, skippedRows } = partitionInBoundsUpdates(updates, columnIndex, limits);
  if (inBounds.length === 0) return { updated: 0, skippedRows };

  const columnLetter = columnIndexToLetter(columnIndex);
  const sheets = getSheetsClient();

  for (let i = 0; i < inBounds.length; i += WRITE_CHUNK_SIZE) {
    const data = inBounds.slice(i, i + WRITE_CHUNK_SIZE).map(({ row, status }) => ({
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

  return { updated: inBounds.length, skippedRows };
}

export interface SheetLeadRow {
  sheetRow: number;
  row: Record<string, string>;
}

export interface SheetIdentityCheck {
  /** Header cell to look up (case-insensitive). */
  header: string;
  expected: string;
  /** "phone" compares digit keys; "text" compares trimmed case-insensitive. */
  kind: "phone" | "text";
}

/** Verify a sheet row still belongs to the record before clearing it. */
export function sheetRowMatchesIdentity(
  headers: (string | null | undefined)[],
  values: (string | null | undefined)[],
  checks: SheetIdentityCheck[]
): boolean {
  if (checks.length === 0) return true;
  const indexByHeader = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = String(header ?? "").trim().toLowerCase();
    if (key && !indexByHeader.has(key)) indexByHeader.set(key, index);
  });
  return checks.every(({ header, expected, kind }) => {
    const index = indexByHeader.get(header.trim().toLowerCase());
    if (index === undefined) return false;
    const cell = String(values[index] ?? "").trim();
    if (!cell) return false;
    if (kind === "phone") {
      const actual = normalizePhoneKey(cell);
      const wanted = normalizePhoneKey(expected);
      return !!actual && actual === wanted;
    }
    return cell.toLowerCase() === expected.trim().toLowerCase();
  });
}

export interface ClearTrackedRowResult {
  cleared: boolean;
  mismatched: boolean;
}

/**
 * Clear a tracked row's cells after verifying it still matches the record.
 * Clears values (keeps the row in place) so every other tracked row number
 * stays valid. Already-empty rows report cleared (idempotent).
 */
export async function clearTrackedSheetRow(
  tab: string,
  sheetRow: number,
  checks: SheetIdentityCheck[]
): Promise<ClearTrackedRowResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }
  if (!Number.isInteger(sheetRow) || sheetRow < 2) {
    return { cleared: false, mismatched: true };
  }

  const sheets = getSheetsClient();
  let fetched;
  try {
    fetched = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: [`${tab}!1:1`, `${tab}!${sheetRow}:${sheetRow}`],
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab }));
  }
  const valueRanges = fetched.data.valueRanges ?? [];
  const headers = valueRanges[0]?.values?.[0] ?? [];
  const values = valueRanges[1]?.values?.[0] ?? [];
  if (values.length === 0 || values.every((v) => String(v ?? "").trim() === "")) {
    return { cleared: true, mismatched: false };
  }
  if (!sheetRowMatchesIdentity(headers, values, checks)) {
    return { cleared: false, mismatched: true };
  }

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tab}!A${sheetRow}:ZZ${sheetRow}`,
    });
  } catch (err) {
    throw new Error(describeSheetsError(err, { tab }));
  }
  return { cleared: true, mismatched: false };
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
