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

interface WhatsAppButtonProps {
  lead: Pick<Lead, "name" | "phone" | "project_interest" | "email" | "source" | "custom_data" | "pipeline_stages">;
  templateBody?: string;
  className?: string;
}

export function WhatsAppButton({ lead, templateBody, className }: WhatsAppButtonProps) {
  const { data: templates = [] } = useWhatsAppTemplates();

  if (!lead.phone) return null;

  const body =
    templateBody ?? templates[0]?.body ?? DEFAULT_WHATSAPP_TEMPLATE_BODY;
  const message = renderWhatsAppTemplate(body, lead as Lead);
  const href = buildWhatsAppUrl(lead.phone, message);
  if (!href) return null;

  return (
    <Button asChild className={className} size="lg">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle data-icon="inline-start" />
        WhatsApp
      </a>
    </Button>
  );
}
