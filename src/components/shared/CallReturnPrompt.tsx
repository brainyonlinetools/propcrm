"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CallQueueSheet, type CallQueueContact } from "@/components/shared/CallQueueSheet";
import { useLeadCalling } from "@/components/leads/useLeadCalling";
import { useLead } from "@/lib/queries/leads";
import { useCreateLeadNote } from "@/lib/queries/tasks";
import { clearPendingCall, readPendingCall, type PendingCall } from "@/lib/pendingCall";

/** When the user comes back to the app after tapping Call, ask how the call went. */
export function CallReturnPrompt() {
  const [pending, setPending] = useState<PendingCall | null>(null);
  const [open, setOpen] = useState(false);
  const { data: lead } = useLead(pending?.leadId ?? "");
  const { logOutcome, followUpForOutcome } = useLeadCalling();
  const createNote = useCreateLeadNote();

  const check = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const p = readPendingCall();
    // Ignore the instant the call was tapped; wait until the user actually returns.
    if (!p || Date.now() - p.ts < 4000) return;
    clearPendingCall();
    setPending(p);
    setOpen(true);
  }, []);

  useEffect(() => {
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [check]);

  const contacts = useMemo<CallQueueContact[]>(
    () =>
      pending && lead
        ? [
            {
              id: `${lead.id}:return`,
              recordId: lead.id,
              name: lead.name,
              phone: pending.phone,
              subtitle: [lead.pipeline_stages?.label, lead.project_interest]
                .filter(Boolean)
                .join(" · ") || null,
            },
          ]
        : [],
    [pending, lead]
  );

  if (!pending || !lead) return null;

  return (
    <CallQueueSheet
      open={open}
      onOpenChange={setOpen}
      mode="single"
      title={`Call with ${lead.name}`}
      contacts={contacts}
      onLogOutcome={logOutcome}
      followUp={followUpForOutcome}
      onClosed={({ logged }) => {
        // Dismissed without choosing an outcome: still record that a call was made.
        if (logged === 0) {
          createNote.mutate({
            lead_id: lead.id,
            content: `Call initiated ${pending.phone}`,
            note_type: "call",
          });
        }
        setPending(null);
      }}
    />
  );
}
