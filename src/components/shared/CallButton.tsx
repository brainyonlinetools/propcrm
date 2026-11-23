"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { phoneToTel } from "@/lib/utils";
import { markCallStarted } from "@/lib/pendingCall";

interface CallButtonProps {
  phone: string | null;
  leadId?: string;
  className?: string;
}

/**
 * Starts a call. The outcome is logged when the user returns to the app
 * (see CallReturnPrompt), so nothing is claimed as "logged" before the call happens.
 */
export function CallButton({ phone, leadId, className }: CallButtonProps) {
  if (!phone) return null;

  return (
    <Button asChild className={`h-12 ${className ?? ""}`} size="lg" variant="outline">
      <a
        href={`tel:${phoneToTel(phone)}`}
        onClick={(e) => {
          e.stopPropagation();
          if (leadId) markCallStarted(leadId, phone);
        }}
      >
        <Phone data-icon="inline-start" />
        Call
      </a>
    </Button>
  );
}
