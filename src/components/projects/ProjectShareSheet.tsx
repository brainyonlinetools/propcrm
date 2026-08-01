"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";
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
  countProjectMedia,
  downloadProjectMediaFiles,
  fetchProjectMediaFiles,
  getProjectShareUrl,
  getWhatsAppShareUrl,
  shareProjectsToWhatsApp,
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
  const [isPreparing, setIsPreparing] = useState(false);
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const shareUrl = useMemo(() => getProjectShareUrl(projectIds), [projectIds]);
  const mediaCount = useMemo(() => countProjectMedia(projects), [projects]);
  const message = useMemo(
    () =>
      buildProjectShareText({
        projects,
        shareUrl,
        includeLink: true,
        includeMediaUrls: mediaCount > 0,
      }),
    [projects, shareUrl, mediaCount]
  );

  async function shareViaWhatsApp() {
    setIsPreparing(true);
    try {
      const result = await shareProjectsToWhatsApp({ projects });
      if (result === "native-files") {
        toast.success("Photos attached — WhatsApp opened with project details");
      } else if (mediaCount > 0) {
        toast.success("WhatsApp opened with project details and photo links");
      } else {
        toast.success("WhatsApp opened with project details");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not prepare project media for sharing");
    } finally {
      setIsPreparing(false);
    }
  }

  async function downloadMedia() {
    setIsPreparing(true);
    try {
      const files = await fetchProjectMediaFiles(projects);
      if (files.length === 0) {
        toast.error("No photos or videos to download");
        return;
      }

      downloadProjectMediaFiles(files);
      toast.success(`Downloaded ${files.length} file${files.length === 1 ? "" : "s"}`);

      window.open(getWhatsAppShareUrl(message), "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not download project media");
    } finally {
      setIsPreparing(false);
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
          <SheetTitle>Share Projects</SheetTitle>
          <SheetDescription>
            {mediaCount > 0
              ? `Send project details with ${mediaCount} photo/video ${mediaCount === 1 ? "attachment" : "attachments"} via WhatsApp.`
              : `Send ${projects.length} selected ${projects.length === 1 ? "project" : "projects"} as a message.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Message Preview</p>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm font-sans">
              {message}
            </pre>
            {mediaCount > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                On supported phones, photos are attached directly. Otherwise photo links are included
                in the message.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button type="button" size="lg" onClick={shareViaWhatsApp} disabled={isPreparing}>
              {isPreparing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ExternalLink data-icon="inline-start" />
              )}
              {isPreparing ? "Preparing media..." : "Share via WhatsApp"}
            </Button>
            {mediaCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={downloadMedia}
                disabled={isPreparing}
              >
                <Download data-icon="inline-start" />
                Download Media & Open WhatsApp
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="lg" onClick={copyLink}>
              <Copy data-icon="inline-start" />
              Copy Brochure Link
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
