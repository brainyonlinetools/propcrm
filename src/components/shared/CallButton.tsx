"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { phoneToTel } from "@/lib/utils";
import { useCreateLeadNote } from "@/lib/queries/tasks";
import { toast } from "sonner";

interface CallButtonProps {
  phone: string | null;
  leadId?: string;
  className?: string;
}

export function CallButton({ phone, leadId, className }: CallButtonProps) {
  const createNote = useCreateLeadNote();

  if (!phone) return null;

  const href = `tel:${phoneToTel(phone)}`;

  const handleClick = async () => {
    if (leadId) {
      try {
        await createNote.mutateAsync({
          lead_id: leadId,
          content: "Call initiated",
          note_type: "call",
        });
        toast.success("Call logged to activity");
      } catch (error) {
        console.error("Failed to log call activity:", error);
        toast.error("Failed to log activity");
      }
    }
  };

  return (
    <Button asChild className={className} size="lg" variant="outline" onClick={handleClick}>
      <a href={href} onClick={(e) => e.stopPropagation()}>
        <Phone data-icon="inline-start" />
        Call
      </a>
    </Button>
  );
}
