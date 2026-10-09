/**
 * Phone-number normalization and multi-number cell splitting for imports.
 *
 * Storage normalization is conservative: 10-digit Indian mobiles are stored
 * as-is, +91/91 prefixes and trunk 0 are stripped, and anything else keeps
 * its full digits so landlines and international numbers are never mangled.
 * (Dedupe matching still uses the last-10-digits key in `normalizePhoneKey`.)
 */

const MIN_PHONE_DIGITS = 6;

function isMobileTail(digits: string): boolean {
  return digits.length === 10 && /^[6-9]/.test(digits);
}

export function normalizeStoredPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Strip +91/91 or trunk 0 only when the remainder is a 10-digit mobile,
  // so STD codes (e.g. Delhi 011…) are never mangled.
  if (digits.length === 12 && digits.startsWith("91") && isMobileTail(digits.slice(2))) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0") && isMobileTail(digits.slice(1))) {
    return digits.slice(1);
  }
  return digits;
}

export interface SplitPhones {
  /** Normalized, deduped numbers in cell order. */
  numbers: string[];
  /** Fragments too short to be numbers, in cell order. */
  dropped: string[];
}

export function splitPhoneCell(cell: string | null | undefined): SplitPhones {
  if (!cell || !cell.trim()) return { numbers: [], dropped: [] };

  const unified = cell.replace(/\s+(and|or)\s+/gi, ",");
  const parts = unified.split(/[,;/|\n&]+/);

  const numbers: string[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const fragment = part.trim();
    if (!fragment) continue;
    const digits = fragment.replace(/\D/g, "");
    if (digits.length < MIN_PHONE_DIGITS) {
      dropped.push(fragment);
      continue;
    }
    const normalized = normalizeStoredPhone(fragment);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    numbers.push(normalized);
  }

  return { numbers, dropped };
}

export interface AssignedPhones {
  primary: string | null;
  alt: string | null;
  extras: string[];
  dropped: string[];
}

/**
 * Assign numbers from a primary cell and an optional alt cell into
 * primary / alt / extras slots. Numbers already in the primary cell win
 * over the alt cell; everything dedupes.
 */
export function assignSplitPhones(
  primaryCell: string | null | undefined,
  altCell?: string | null | undefined
): AssignedPhones {
  const primary = splitPhoneCell(primaryCell);
  const alt = splitPhoneCell(altCell);

  const combined: string[] = [];
  const seen = new Set<string>();
  for (const num of [...primary.numbers, ...alt.numbers]) {
    if (seen.has(num)) continue;
    seen.add(num);
    combined.push(num);
  }

  return {
    primary: combined[0] ?? null,
    alt: combined[1] ?? null,
    extras: combined.slice(2),
    dropped: [...primary.dropped, ...alt.dropped],
  };
}

/** Append extra numbers to remarks, replacing any previous extras line (idempotent). */
export function mergeRemarksPhones(
  remarks: string | null | undefined,
  extras: string[]
): string | null {
  const base = (remarks ?? "")
    .split("\n")
    .filter((line) => !line.startsWith("Other phones:"))
    .join("\n")
    .trim();
  const parts = [base];
  if (extras.length > 0) parts.push(`Other phones: ${extras.join(", ")}`);
  return parts.filter(Boolean).join("\n") || null;
}
