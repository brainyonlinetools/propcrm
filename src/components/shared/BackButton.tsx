"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Goes back to wherever the user came from; falls back to the list when there is no history (e.g. opened from a push notification). */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label="Back"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeft />
    </Button>
  );
}
