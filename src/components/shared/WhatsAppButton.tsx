"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWhatsAppTemplates } from "@/lib/queries/whatsappTemplates";
import {
  buildWhatsAppUrl,
  DEFAULT_WHATSAPP_TEMPLATE_BODY,
  renderWhatsAppTemplate,
} from "@/lib/whatsappTemplates";
import type { Lead } from "@/types";
import { useCreateLeadNote } from "@/lib/queries/tasks";
import { toast } from "sonner";

interface WhatsAppButtonProps {
  lead: Pick<Lead, "name" | "phone" | "project_interest" | "email" | "source" | "custom_data" | "pipeline_stages" | "id">;
  templateBody?: string;
  className?: string;
}

export function WhatsAppButton({ lead, templateBody, className }: WhatsAppButtonProps) {
  const createNote = useCreateLeadNote();
  const { data: templates = [] } = useWhatsAppTemplates();

  if (!lead.phone) return null;

  const body =
    templateBody ?? templates[0]?.body ?? DEFAULT_WHATSAPP_TEMPLATE_BODY;
  const message = renderWhatsAppTemplate(body, lead as Lead);
  const href = buildWhatsAppUrl(lead.phone, message);
  if (!href) return null;

  const handleClick = async () => {
    if (lead.id) {
      try {
        await createNote.mutateAsync({
          lead_id: lead.id,
          content: "WhatsApp message sent",
          note_type: "whatsapp",
        });
        toast.success("WhatsApp activity logged to timeline");
      } catch (error) {
        console.error("Failed to log WhatsApp activity:", error);
        toast.error("Failed to log activity");
      }
    }
  };

  return (
    <Button asChild className={className} size="lg" onClick={handleClick}>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        <MessageCircle data-icon="inline-start" />
        WhatsApp
      </a>
    </Button>
  );
}
