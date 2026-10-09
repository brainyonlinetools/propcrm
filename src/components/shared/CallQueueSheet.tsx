"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Check, Phone, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPhone, phoneToTel } from "@/lib/utils";
import { CALL_OUTCOME_LABELS, type CallOutcome } from "@/types";

export interface CallQueueContact {
  /** Unique per queue entry (one contact can contribute several numbers). */
  id: string;
  /** Lead/seller id outcomes are logged against. */
  recordId: string;
  name: string;
  phone: string;
  subtitle?: string | null;
}

interface CallQueueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  contacts: CallQueueContact[];
  onLogOutcome: (
    contact: CallQueueContact,
    outcome: CallOutcome,
    opts?: { note?: string; followUpDate?: string }
  ) => Promise<void>;
}

const OUTCOMES = Object.keys(CALL_OUTCOME_LABELS) as CallOutcome[];

function defaultCallbackDate(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

export function CallQueueSheet({
  open,
  onOpenChange,
  title,
  contacts,
  onLogOutcome,
}: CallQueueSheetProps) {
  const [index, setIndex] = useState(0);
  const [logged, setLogged] = useState(0);
  const [note, setNote] = useState("");
  const [callbackDate, setCallbackDate] = useState(defaultCallbackDate);
  const [confirmingCallback, setConfirmingCallback] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setLogged(0);
      setNote("");
      setCallbackDate(defaultCallbackDate());
      setConfirmingCallback(false);
      setSaving(false);
    }
  }, [open ]);

  const current = contacts[index] ?? null;
  const finished = index >= contacts.length;
  const upNext = useMemo(() => contacts.slice(index + 1, index + 4), [contacts, index]);

  function advance() {
    setIndex((i) => i + 1);
    setNote("");
    setCallbackDate(defaultCallbackDate());
    setConfirmingCallback(false);
  }

  async function handleOutcome(outcome: CallOutcome) {
    if (!current || saving) return;
    if (outcome === "callback" && !confirmingCallback) {
      setConfirmingCallback(true);
      return;
    }
    setSaving(true);
    try {
      await onLogOutcome(current, outcome, {
        note: note.trim() || undefined,
        followUpDate: outcome === "callback" ? callbackDate : undefined,
      });
      setLogged((n) => n + 1);
      advance();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl px-0"
      >
        <SheetHeader className="shrink-0 px-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {finished
              ? "Queue complete"
              : `Contact ${Math.min(index + 1, contacts.length)} of ${contacts.length} · ${logged} logged`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          {finished || !current ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Check />
              </div>
              <h2 className="mt-3 text-base font-semibold">Queue complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {logged} of {contacts.length} contact{contacts.length !== 1 ? "s" : ""} logged.
              </p>
              <Button className="mt-4" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">Now calling</p>
                <h2 className="mt-1 truncate text-xl font-semibold">{current.name}</h2>
                <p className="mt-0.5 text-lg font-medium text-primary">
                  {formatPhone(current.phone)}
                </p>
                {current.subtitle && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {current.subtitle}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button asChild size="lg" className="flex-1">
                    <a href={`tel:${phoneToTel(current.phone)}`}>
                      <Phone data-icon="inline-start" />
                      Call now
                    </a>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={advance}
                    aria-label="Skip without logging"
                  >
                    <SkipForward />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="call-queue-note">Note (optional)</Label>
                <Input
                  id="call-queue-note"
                  placeholder="e.g. asked for 3BHK floor plan"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-12"
                />
              </div>

              {confirmingCallback && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <Label htmlFor="call-queue-callback">Call back on</Label>
                  <Input
                    id="call-queue-callback"
                    type="date"
                    className="h-12"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                  />
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium">
                  {confirmingCallback
                    ? "Confirm call back"
                    : "Log outcome to continue"}
                </p>
                {confirmingCallback ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmingCallback(false)}
                      disabled={saving}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleOutcome("callback")}
                      disabled={saving || !callbackDate}
                    >
                      {saving ? "Saving…" : "Save & next"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {OUTCOMES.map((outcome) => (
                      <Button
                        key={outcome}
                        variant="outline"
                        className="h-11 justify-start"
                        onClick={() => handleOutcome(outcome)}
                        disabled={saving}
                      >
                        {CALL_OUTCOME_LABELS[outcome]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {upNext.length > 0 && (
                <div className="text-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Up next
                  </p>
                  <ul className="mt-1 space-y-1">
                    {upNext.map((c) => (
                      <li key={c.id} className="truncate text-muted-foreground">
                        {c.name} · {formatPhone(c.phone)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
