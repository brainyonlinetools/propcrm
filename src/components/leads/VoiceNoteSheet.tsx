"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUpdateLead } from "@/lib/queries/leads";
import { useCreateLeadNote, useCreateTask } from "@/lib/queries/tasks";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";
import {
  buildNoteContent,
  mergeCustomData,
  type VoiceExtraction,
} from "@/lib/voiceExtract";
import { DEFAULT_TASK_REMINDER_TIME } from "@/lib/taskReminders";
import { DateChips } from "@/components/shared/DateChips";
import type { Lead } from "@/types";

type Phase = "record" | "processing" | "review";

const EMPTY: VoiceExtraction = {
  budget: null,
  configuration: null,
  project_interest: null,
  possession_preference: null,
  requirement: null,
  follow_up_date: null,
  follow_up_title: null,
  summary: null,
};

interface VoiceNoteSheetProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceNoteSheet({ lead, open, onOpenChange }: VoiceNoteSheetProps) {
  const recorder = useVoiceRecorder();
  const updateLead = useUpdateLead();
  const createNote = useCreateLeadNote();
  const createTask = useCreateTask();
  const [phase, setPhase] = useState<Phase>("record");
  const [transcript, setTranscript] = useState("");
  const [ex, setEx] = useState<VoiceExtraction>(EMPTY);
  const [saving, setSaving] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const savedSteps = useRef({ note: false, lead: false, task: false });
  const MAX_SECONDS = 180;

  /** Review-phase edits must not vanish on an accidental tap outside. */
  function requestClose(next: boolean) {
    if (!next && phase === "review" && !saving) {
      if (!window.confirm("Discard this voice note?")) return;
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) {
      recorder.cancel();
      setPhase("record");
      setTranscript("");
      setEx(EMPTY);
      blobRef.current = null;
      savedSteps.current = { note: false, lead: false, task: false };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function processAudio(blob: Blob) {
    setPhase("processing");
    try {
      const res = await fetch("/api/voice-note", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "audio/webm",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_VOICE_API_SECRET ?? ""}`,
        },
        body: blob,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        transcript: string;
        extraction: VoiceExtraction | null;
      };
      if (!data.transcript) {
        toast.error("Couldn't hear anything, try again");
        blobRef.current = null;
        setPhase("record");
        return;
      }
      if (!data.extraction) toast.warning("Saved transcript only; extraction failed");
      blobRef.current = null;
      setTranscript(data.transcript);
      setEx(data.extraction ?? EMPTY);
      setPhase("review");
    } catch {
      // Keep the recording so a retry doesn't mean speaking again.
      blobRef.current = blob;
      toast.error("Upload failed. Tap Retry to send the same recording.");
      setPhase("record");
    }
  }

  async function toggleRecording() {
    if (recorder.state === "recording") {
      const blob = await recorder.stop();
      if (!blob) {
        toast.error("No audio captured");
        return;
      }
      await processAudio(blob);
      return;
    }
    try {
      await recorder.start();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error(
          "Microphone is blocked. Enable it in your browser/site settings (on iPhone: Settings → Safari or the app → Microphone), then tap again.",
          { duration: 8000 }
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        toast.error("No microphone found on this device.");
      } else if (name === "NotReadableError") {
        toast.error("Microphone is in use by another app.");
      } else if (err instanceof Error && err.message === "UNSUPPORTED") {
        toast.error("Recording isn't supported here. Use HTTPS and a current browser.");
      } else {
        toast.error("Couldn't start recording.");
      }
    }
  }

  // Auto-stop long recordings so a forgotten recording can't run on.
  useEffect(() => {
    if (recorder.state === "recording" && recorder.seconds >= MAX_SECONDS) {
      void toggleRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.seconds, recorder.state]);

  function set<K extends keyof VoiceExtraction>(key: K, value: string) {
    setEx((prev) => ({ ...prev, [key]: value.trim() ? value : null }));
  }

  async function handleSave() {
    setSaving(true);
    const done = savedSteps.current;
    try {
      if (!done.note) {
        await createNote.mutateAsync({
          lead_id: lead.id,
          content: buildNoteContent(ex.summary, transcript),
          note_type: "call",
        });
        done.note = true;
      }

      if (!done.lead) {
        const customData = mergeCustomData(lead.custom_data as Record<string, unknown>, ex);
        const changedCustom =
          JSON.stringify(customData) !== JSON.stringify(lead.custom_data ?? {});
        const projectChanged =
          ex.project_interest && ex.project_interest !== lead.project_interest;
        if (changedCustom || projectChanged) {
          await updateLead.mutateAsync({
            id: lead.id,
            ...(changedCustom ? { custom_data: customData as never } : {}),
            ...(projectChanged ? { project_interest: ex.project_interest } : {}),
          });
        }
        done.lead = true;
      }

      if (ex.follow_up_date && !done.task) {
        await createTask.mutateAsync({
          lead_id: lead.id,
          title: ex.follow_up_title?.trim() || "Follow up",
          due_date: ex.follow_up_date,
          due_time: DEFAULT_TASK_REMINDER_TIME,
        });
        done.task = true;
      }
      toast.success("Voice note saved");
      onOpenChange(false);
    } catch {
      // Steps already completed are skipped on retry, so nothing is duplicated.
      toast.error("Some parts failed to save. Tap Save again to finish.");
    } finally {
      setSaving(false);
    }
  }

  const recording = recorder.state === "recording";

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Voice note · {lead.name}</SheetTitle>
          <SheetDescription>
            Speak budget, requirement, follow-up. Hindi or English.
          </SheetDescription>
        </SheetHeader>

        {phase !== "review" && (
          <div className="flex flex-col items-center gap-4 px-4 py-8">
            <Button
              type="button"
              onClick={toggleRecording}
              disabled={phase === "processing"}
              aria-label={recording ? "Stop recording" : "Start recording"}
              className={`size-28 rounded-full ${recording ? "bg-destructive hover:bg-destructive/90" : ""}`}
            >
              {phase === "processing" ? (
                <Loader2 className="size-10 animate-spin" />
              ) : recording ? (
                <Square className="size-10" />
              ) : (
                <Mic className="size-10" />
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              {phase === "processing"
                ? "Transcribing…"
                : blobRef.current
                  ? "Upload failed. Tap Retry."
                : recording
                  ? `Recording ${fmt(recorder.seconds)} · tap to stop`
                  : "Tap to record"}
            </p>
            {phase === "record" && !recording && blobRef.current && (
              <Button type="button" className="h-12" onClick={() => processAudio(blobRef.current!)}>
                Retry upload
              </Button>
            )}
            {recording && (
              <p className="text-xs text-muted-foreground">Stops automatically at 3 minutes</p>
            )}
          </div>
        )}

        {phase === "review" && (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="vn-summary">Summary</Label>
              <Textarea id="vn-summary" value={ex.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="vn-budget">Budget</Label>
                <Input id="vn-budget" inputMode="decimal" className="h-11" value={ex.budget ?? ""} onChange={(e) => set("budget", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="vn-config">Configuration</Label>
                <Input id="vn-config" className="h-11" value={ex.configuration ?? ""} onChange={(e) => set("configuration", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="vn-project">Project / area</Label>
                <Input id="vn-project" className="h-11" value={ex.project_interest ?? ""} onChange={(e) => set("project_interest", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="vn-possession">Possession</Label>
                <Input id="vn-possession" className="h-11" value={ex.possession_preference ?? ""} onChange={(e) => set("possession_preference", e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="vn-req">Requirement</Label>
              <Textarea id="vn-req" value={ex.requirement ?? ""} onChange={(e) => set("requirement", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1">
                <Label htmlFor="vn-date">Follow-up date</Label>
                <DateChips value={ex.follow_up_date ?? ""} onChange={(v) => set("follow_up_date", v)} />
                <Input id="vn-date" type="date" className="h-11" value={ex.follow_up_date ?? ""} onChange={(e) => set("follow_up_date", e.target.value)} />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <Label htmlFor="vn-task">Follow-up task</Label>
                <Input id="vn-task" className="h-11" value={ex.follow_up_title ?? ""} onChange={(e) => set("follow_up_title", e.target.value)} />
              </div>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary>Transcript</summary>
              <p className="mt-1 whitespace-pre-wrap">{transcript}</p>
            </details>
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1" onClick={() => { savedSteps.current = { note: false, lead: false, task: false }; setPhase("record"); }} disabled={saving}>
                Re-record
              </Button>
              <Button className="h-12 flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
