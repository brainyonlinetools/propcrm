export const CONFIGURATION_OPTIONS = ["2BHK", "3BHK", "4BHK", "Penthouse"] as const;
export const POSSESSION_OPTIONS = [
  "Ready to Move",
  "Under Construction",
  "2025",
  "2026",
  "2027+",
] as const;

export interface VoiceExtraction {
  budget: string | null;
  configuration: string | null;
  project_interest: string | null;
  possession_preference: string | null;
  /** Free-form requirement details (location, floor, purpose, objections...). */
  requirement: string | null;
  /** YYYY-MM-DD */
  follow_up_date: string | null;
  follow_up_title: string | null;
  summary: string | null;
}

/** Gemini responseSchema (OpenAPI subset). Every field is nullable: absent = not mentioned. */
export const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    budget: { type: "STRING", nullable: true },
    configuration: { type: "STRING", enum: [...CONFIGURATION_OPTIONS], nullable: true },
    project_interest: { type: "STRING", nullable: true },
    possession_preference: { type: "STRING", enum: [...POSSESSION_OPTIONS], nullable: true },
    requirement: { type: "STRING", nullable: true },
    follow_up_date: { type: "STRING", nullable: true },
    follow_up_title: { type: "STRING", nullable: true },
    summary: { type: "STRING", nullable: true },
  },
  required: [
    "budget",
    "configuration",
    "project_interest",
    "possession_preference",
    "requirement",
    "follow_up_date",
    "follow_up_title",
    "summary",
  ],
} as const;

export function buildExtractionPrompt(transcript: string, today: string): string {
  return `You are an assistant for an Indian real-estate sales CRM. A sales agent dictated a short voice note right after calling a lead (Hindi / English / Hinglish). Extract only what was explicitly said. Never guess or invent; use null for anything not mentioned.

Today's date (IST): ${today}

Fields:
- budget: short text in Indian style, e.g. "2-3 Cr", "80 L", "1.5 Cr". Convert spoken forms ("2 se 3 crore" -> "2-3 Cr").
- configuration: one of ${CONFIGURATION_OPTIONS.join(", ")} only if clearly stated.
- project_interest: project or sector/locality named.
- possession_preference: one of ${POSSESSION_OPTIONS.join(", ")} only if stated.
- requirement: other requirement details (floor, facing, purpose such as investment/self-use, loan, objections), concise English.
- follow_up_date: YYYY-MM-DD resolved from today's date if a callback/visit day was stated ("kal", "Saturday", "next week").
- follow_up_title: short task title for that follow-up (e.g. "Site visit", "Call back").
- summary: one or two concise English sentences summarising the call.

Transcript:
"""
${transcript}
"""`;
}

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Validates model output: unknown values for enum fields and malformed dates are dropped. */
export function normalizeExtraction(raw: unknown): VoiceExtraction {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const configuration = clean(o.configuration);
  const possession = clean(o.possession_preference);
  const date = clean(o.follow_up_date);
  return {
    budget: clean(o.budget),
    configuration: (CONFIGURATION_OPTIONS as readonly string[]).includes(configuration ?? "")
      ? configuration
      : null,
    project_interest: clean(o.project_interest),
    possession_preference: (POSSESSION_OPTIONS as readonly string[]).includes(possession ?? "")
      ? possession
      : null,
    requirement: clean(o.requirement),
    follow_up_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    follow_up_title: clean(o.follow_up_title),
    summary: clean(o.summary),
  };
}

/**
 * Merge extracted values into existing custom_data. Only non-empty extracted
 * fields overwrite; everything else is preserved. Requirement text is appended
 * to remarks rather than replacing it.
 */
export function mergeCustomData(
  existing: Record<string, unknown> | null | undefined,
  ex: Pick<VoiceExtraction, "budget" | "configuration" | "possession_preference" | "requirement">
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  if (ex.budget) next.budget = ex.budget;
  if (ex.configuration) next.configuration = ex.configuration;
  if (ex.possession_preference) next.possession_preference = ex.possession_preference;
  if (ex.requirement) {
    const prev = typeof next.remarks === "string" ? next.remarks.trim() : "";
    if (!prev.includes(ex.requirement)) {
      next.remarks = prev ? `${prev}\n${ex.requirement}` : ex.requirement;
    }
  }
  return next;
}

export function buildNoteContent(summary: string | null, transcript: string): string {
  const parts = [`🎙️ ${summary ?? "Voice note"}`];
  if (transcript.trim()) parts.push(`Transcript: ${transcript.trim()}`);
  return parts.join("\n\n");
}
