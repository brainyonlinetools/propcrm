"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildInventoryShareText,
  copyTextToClipboard,
  countInventoryMedia,
  getInventoryMediaUrls,
  getInventoryShareUrl,
  shareInventory,
} from "@/lib/inventorySharing";
import { useInventoryMedia } from "@/lib/queries/inventory";
import type { Inventory } from "@/types";

interface InventoryShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: Inventory[];
}

export function InventoryShareSheet({
  open,
  onOpenChange,
  units,
}: InventoryShareSheetProps) {
  const [isSharing, setIsSharing] = useState(false);
  const primaryId = units[0]?.id ?? "";
  const { data: primaryMedia = [] } = useInventoryMedia(open ? primaryId : "");

  const unitsWithMedia = useMemo(() => {
    if (units.length !== 1) return units;
    const existing = units[0].inventory_media ?? [];
    if (existing.length > 0) return units;
    return [{ ...units[0], inventory_media: primaryMedia }];
  }, [units, primaryMedia]);

  const unitIds = useMemo(() => unitsWithMedia.map((unit) => unit.id), [unitsWithMedia]);
  const shareUrl = useMemo(() => getInventoryShareUrl(unitIds), [unitIds]);
  const mediaCount = useMemo(() => countInventoryMedia(unitsWithMedia), [unitsWithMedia]);
  const mediaUrls = useMemo(() => getInventoryMediaUrls(unitsWithMedia), [unitsWithMedia]);
  const message = useMemo(
    () =>
      buildInventoryShareText({
        units: unitsWithMedia,
        includeLink: false,
        includeMediaUrls: false,
      }),
    [unitsWithMedia]
  );

  async function handleShare(preferWhatsApp: boolean) {
    setIsSharing(true);
    try {
      const result = await shareInventory({ units: unitsWithMedia, preferWhatsApp });

      if (result === "whatsapp-with-photos" || result === "native") {
        toast.success(
          mediaCount > 0
            ? "Shared with media — paste details from clipboard if needed."
            : "Share sheet opened with unit details."
        );
      } else if (mediaCount > 0) {
        toast.success(
          "WhatsApp opened with details; attach downloaded photos if needed."
        );
      } else {
        toast.success("WhatsApp opened with unit details.");
      }

      onOpenChange(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share — try copying the message instead");
    } finally {
      setIsSharing(false);
    }
  }

  async function copyMessage() {
    const copied = await copyTextToClipboard(message);
    if (copied) {
      toast.success("Message copied");
    } else {
      toast.error("Could not copy message");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[86dvh] w-full overflow-y-auto rounded-t-xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>Share Inventory</SheetTitle>
          <SheetDescription>
            Shares property details and media only. Owner name and phone are never included.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          {mediaUrls.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaUrls.map((url) => (
                <div
                  key={url}
                  className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                >
                  <Image
                    src={url}
                    alt="Unit photo"
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Share Message</p>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm">
              {message}
            </pre>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              onClick={() => handleShare(false)}
              disabled={isSharing || units.length === 0}
            >
              {isSharing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Share2 data-icon="inline-start" />
              )}
              {isSharing ? "Sharing…" : "Share"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => handleShare(true)}
              disabled={isSharing || units.length === 0}
            >
              <MessageCircle data-icon="inline-start" />
              WhatsApp
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={copyMessage}>
              <Copy data-icon="inline-start" />
              Copy Message
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={copyLink}>
              <Copy data-icon="inline-start" />
              Copy listing link
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
