"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAgentName, phoneToWhatsApp } from "@/lib/utils";

interface WhatsAppButtonProps {
  name: string;
  phone: string | null;
  projectName?: string | null;
  className?: string;
}

export function WhatsAppButton({ name, phone, projectName, className }: WhatsAppButtonProps) {
  if (!phone) return null;

  const agentName = getAgentName() || "your Anand Prime advisor";
  const project = projectName ?? "our projects";
  const message = encodeURIComponent(
    `Hi ${name}, this is ${agentName} from Anand Prime. Following up regarding your enquiry about ${project}.`
  );
  const waPhone = phoneToWhatsApp(phone);
  const href = `https://wa.me/${waPhone}?text=${message}`;

  return (
    <Button asChild className={className} size="lg">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle data-icon="inline-start" />
        WhatsApp
      </a>
    </Button>
  );
}
