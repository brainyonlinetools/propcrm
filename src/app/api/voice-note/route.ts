import { NextResponse } from "next/server";
import { unauthorized, verifyBearerSecret } from "@/lib/apiAuth";
import {
  EXTRACTION_SCHEMA,
  buildExtractionPrompt,
  normalizeExtraction,
} from "@/lib/voiceExtract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export async function POST(request: Request) {
  if (!verifyBearerSecret(request, "VOICE_API_SECRET")) return unauthorized();

  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!deepgramKey || !geminiKey) {
    return NextResponse.json({ error: "Voice notes are not configured" }, { status: 500 });
  }

  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }
  if (audio.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Recording too large" }, { status: 413 });
  }
  const contentType = request.headers.get("content-type") || "audio/webm";

  // 1. Speech to text
  const dgRes = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${deepgramKey}`, "Content-Type": contentType },
      body: audio,
    }
  );
  if (!dgRes.ok) {
    console.error("Deepgram error", dgRes.status, await dgRes.text());
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
  const dg = await dgRes.json();
  const transcript: string = dg?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!transcript) {
    return NextResponse.json({ transcript: "", extraction: null });
  }

  // 2. Structured extraction
  const gRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildExtractionPrompt(transcript, todayIST()) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
        },
      }),
    }
  );
  if (!gRes.ok) {
    console.error("Gemini error", gRes.status, await gRes.text());
    // Still return the transcript so the note isn't lost.
    return NextResponse.json({ transcript, extraction: null, warning: "Extraction failed" });
  }
  const g = await gRes.json();
  const text: string = g?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // fall through with empty extraction
  }

  return NextResponse.json({ transcript, extraction: normalizeExtraction(parsed) });
}
