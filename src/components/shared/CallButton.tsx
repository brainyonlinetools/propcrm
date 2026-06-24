"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { phoneToTel } from "@/lib/utils";

interface CallButtonProps {
  phone: string | null;
  className?: string;
}

export function CallButton({ phone, className }: CallButtonProps) {
  if (!phone) return null;

  const href = `tel:${phoneToTel(phone)}`;

  return (
    <Button asChild className={className} size="lg" variant="outline">
      <a href={href}>
        <Phone data-icon="inline-start" />
        Call
      </a>
    </Button>
  );
}
