/**
 * Parse CSV/TSV text into an array of row objects keyed by header names.
 */
export function parseDelimitedText(text: string): {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
} {
  const errors: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return { headers: [], rows: [], errors: ["No data provided"] };
  }

  const lines = splitLines(trimmed);
  if (lines.length < 1) {
    return { headers: [], rows: [], errors: ["No data provided"] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map(normalizeHeader);

  if (headers.length === 0 || headers.every((h) => !h)) {
    return { headers: [], rows: [], errors: ["Could not detect column headers"] };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    errors.push("No data rows found (header row only)");
  }

  return { headers, rows, errors };
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line, idx, arr) => {
    if (idx === arr.length - 1 && !line.trim()) return false;
    return true;
  });
}

function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}
