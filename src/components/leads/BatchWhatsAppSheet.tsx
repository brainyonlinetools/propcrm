"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWhatsAppTemplates } from "@/lib/queries/whatsappTemplates";
import { useCreateLeadNote } from "@/lib/queries/tasks";
import {
  buildWhatsAppUrl,
  renderWhatsAppTemplate,
  truncateForNote,
} from "@/lib/whatsappTemplates";
import type { Lead } from "@/types";

type Step = "template" | "review" | "send";

interface BatchWhatsAppSheetProps {
  leads: Lead[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function BatchWhatsAppSheet({
  leads,
  open,
  onOpenChange,
  onComplete,
}: BatchWhatsAppSheetProps) {
  const { data: templates = [], isLoading } = useWhatsAppTemplates();
  const createNote = useCreateLeadNote();

  const [step, setStep] = useState<Step>("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openedCount, setOpenedCount] = useState(0);
  const [loggedLeadIds, setLoggedLeadIds] = useState<Set<string>>(new Set());

  const sendableLeads = useMemo(
    () => leads.filter((lead) => Boolean(lead.phone?.trim())),
    [leads]
  );
  const skippedCount = leads.length - sendableLeads.length;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0];
  const previewLead = sendableLeads[0] ?? leads[0];
  const currentLead = sendableLeads[currentIndex];

  const previewMessage = useMemo(() => {
    if (!selectedTemplate || !previewLead) return "";
    return renderWhatsAppTemplate(selectedTemplate.body, previewLead);
  }, [selectedTemplate, previewLead]);

  const currentMessage = useMemo(() => {
    if (!selectedTemplate || !currentLead) return "";
    return renderWhatsAppTemplate(selectedTemplate.body, currentLead);
  }, [selectedTemplate, currentLead]);

  function resetState() {
    setStep("template");
    setSelectedTemplateId(null);
    setCurrentIndex(0);
    setOpenedCount(0);
    setLoggedLeadIds(new Set());
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (openedCount > 0) {
        toast.success(`Opened WhatsApp for ${openedCount} contact${openedCount === 1 ? "" : "s"}`);
      }
      resetState();
      onComplete?.();
    }
    onOpenChange(nextOpen);
  }

  async function logWhatsAppNote(lead: Lead, message: string) {
    if (loggedLeadIds.has(lead.id)) return;
    try {
      await createNote.mutateAsync({
        lead_id: lead.id,
        note_type: "whatsapp",
        content: `Sent batch message: ${truncateForNote(message)}`,
      });
      setLoggedLeadIds((prev) => new Set(prev).add(lead.id));
    } catch {
      toast.error(`Could not log activity for ${lead.name}`);
    }
  }

  async function handleOpenWhatsApp() {
    if (!currentLead || !selectedTemplate) return;
    const url = buildWhatsAppUrl(currentLead.phone, currentMessage);
    if (!url) {
      toast.error("No valid phone number for this contact");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    await logWhatsAppNote(currentLead, currentMessage);
    setOpenedCount((count) => count + 1);
  }

  function handleNext() {
    if (currentIndex < sendableLeads.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }
    handleOpenChange(false);
  }

  function handleSkip() {
    handleNext();
  }

  function canProceedFromTemplate() {
    return Boolean(selectedTemplate) && sendableLeads.length > 0;
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Batch WhatsApp</SheetTitle>
          <SheetDescription>
            {step === "template" && "Choose a message template for your selected leads."}
            {step === "review" && "Review who will receive this message."}
            {step === "send" && "Open WhatsApp for each contact one at a time."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No templates yet. Add WhatsApp templates in Settings first.
            </div>
          ) : step === "template" ? (
            <>
              <div className="flex flex-col gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      (selectedTemplateId ?? templates[0]?.id) === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {template.body}
                    </p>
                  </button>
                ))}
              </div>

              {previewLead && selectedTemplate && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Preview for {previewLead.name}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{previewMessage}</p>
                </div>
              )}

              {sendableLeads.length === 0 && (
                <p className="text-sm text-destructive">
                  None of the selected leads have a phone number.
                </p>
              )}

              <Button
                className="h-12"
                disabled={!canProceedFromTemplate()}
                onClick={() => setStep("review")}
              >
                Continue
                <ChevronRight data-icon="inline-end" />
              </Button>
            </>
          ) : step === "review" ? (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">
                  Sending to {sendableLeads.length} contact
                  {sendableLeads.length === 1 ? "" : "s"}
                </p>
                {skippedCount > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {skippedCount} without phone will be skipped
                  </p>
                )}
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {sendableLeads.slice(0, 8).map((lead) => (
                    <li key={lead.id}>{lead.name}</li>
                  ))}
                  {sendableLeads.length > 8 && (
                    <li className="text-muted-foreground">
                      +{sendableLeads.length - 8} more
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="h-12 flex-1" onClick={() => setStep("template")}>
                  Back
                </Button>
                <Button className="h-12 flex-1" onClick={() => setStep("send")}>
                  Start sending
                </Button>
              </div>
            </>
          ) : (
            currentLead &&
            selectedTemplate && (
              <>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">
                    Contact {currentIndex + 1} of {sendableLeads.length}
                  </p>
                  <p className="mt-1 text-base font-semibold">{currentLead.name}</p>
                  {currentLead.phone && (
                    <p className="text-sm text-muted-foreground">{currentLead.phone}</p>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
                  <p className="whitespace-pre-wrap text-sm">{currentMessage}</p>
                </div>

                <Button className="h-12" onClick={handleOpenWhatsApp}>
                  <MessageCircle data-icon="inline-start" />
                  Open WhatsApp
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" className="h-12 flex-1" onClick={handleSkip}>
                    {currentIndex < sendableLeads.length - 1 ? "Skip" : "Done"}
                  </Button>
                  <Button className="h-12 flex-1" onClick={handleNext}>
                    {currentIndex < sendableLeads.length - 1 ? "Next" : "Finish"}
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
