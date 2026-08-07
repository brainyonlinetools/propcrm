"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildProjectShareText,
  copyTextToClipboard,
  countProjectMedia,
  getProjectMediaUrls,
  getProjectShareUrl,
  shareProjects,
} from "@/lib/projectSharing";
import type { Project } from "@/types";

interface ProjectShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
}

export function ProjectShareSheet({
  open,
  onOpenChange,
  projects,
}: ProjectShareSheetProps) {
  const [isSharing, setIsSharing] = useState(false);
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const shareUrl = useMemo(() => getProjectShareUrl(projectIds), [projectIds]);
  const mediaCount = useMemo(() => countProjectMedia(projects), [projects]);
  const mediaUrls = useMemo(() => getProjectMediaUrls(projects), [projects]);
  const message = useMemo(
    () =>
      buildProjectShareText({
        projects,
        includeLink: false,
        includeMediaUrls: false,
      }),
    [projects]
  );

  async function handleShare() {
    setIsSharing(true);
    try {
      const result = await shareProjects({ projects });

      if (result === "whatsapp-with-photos") {
        toast.success(
          "Photos & videos attached — paste project details from clipboard as the caption."
        );
      } else if (mediaCount > 0) {
        toast.success(
          "WhatsApp opened with details only; attach downloaded photos/videos if needed."
        );
      } else {
        toast.success("WhatsApp opened with project details.");
      }

      onOpenChange(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not open WhatsApp — try copying the message instead");
    } finally {
      setIsSharing(false);
    }
  }

  async function copyMessage() {
    const copied = await copyTextToClipboard(message);
    if (copied) {
      toast.success("Message copied — paste it in WhatsApp");
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
          <SheetTitle>Share Project</SheetTitle>
          <SheetDescription>
            {mediaCount > 0
              ? `Attach ${mediaCount} photo${mediaCount === 1 ? "" : "s"}/video${mediaCount === 1 ? "" : "s"} in WhatsApp, then paste the project details as the caption.`
              : "Share project details in WhatsApp."}
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
                    alt="Project photo"
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
            <p className="mb-2 text-xs font-medium text-muted-foreground">WhatsApp Message</p>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm font-sans">
              {message}
            </pre>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="button" size="lg" onClick={handleShare} disabled={isSharing}>
              {isSharing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <MessageCircle data-icon="inline-start" />
              )}
              {isSharing ? "Opening WhatsApp..." : "Share via WhatsApp"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={copyMessage}>
              <Copy data-icon="inline-start" />
              Copy Message
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={copyLink}>
              <Copy data-icon="inline-start" />
              Copy brochure link
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
