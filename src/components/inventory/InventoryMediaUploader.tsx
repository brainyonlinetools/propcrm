"use client";

import { useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImageIcon, Trash2, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDeleteInventoryMedia,
  useInventoryMedia,
  useUpdateInventoryMedia,
  useUploadInventoryMedia,
} from "@/lib/queries/inventory";
import type { Inventory, InventoryMedia } from "@/types";

interface InventoryMediaUploaderProps {
  unit: Inventory;
}

export function InventoryMediaUploader({ unit }: InventoryMediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: media = [] } = useInventoryMedia(unit.id);
  const uploadMedia = useUploadInventoryMedia();
  const updateMedia = useUpdateInventoryMedia();
  const deleteMedia = useDeleteInventoryMedia();

  async function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length === 0) return;

    try {
      await Promise.all(
        selected.map((file, index) =>
          uploadMedia.mutateAsync({
            inventoryId: unit.id,
            file,
            sortOrder: media.length + index,
          })
        )
      );
      toast.success(selected.length === 1 ? "Media uploaded" : "Media files uploaded");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to upload media";
      toast.error(message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleCaptionBlur(item: InventoryMedia, caption: string) {
    const nextCaption = caption.trim() || null;
    if (nextCaption === item.caption) return;

    try {
      await updateMedia.mutateAsync({
        id: item.id,
        inventory_id: item.inventory_id,
        caption: nextCaption,
      });
      toast.success("Caption updated");
    } catch {
      toast.error("Failed to update caption");
    }
  }

  async function handleDelete(item: InventoryMedia) {
    try {
      await deleteMedia.mutateAsync(item);
      toast.success("Media deleted");
    } catch {
      toast.error("Failed to delete media");
    }
  }

  const isUploading = uploadMedia.isPending;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Photos & Videos</h3>
          <p className="text-xs text-muted-foreground">
            Shared with clients — owner contact is never included.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload data-icon="inline-start" />
          Upload
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {media.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No media yet. Add photos or short videos for sharing.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
          {media.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <MediaPreview item={item} />
              <div className="flex flex-col gap-2 p-2">
                <Input
                  className="h-9"
                  placeholder="Caption"
                  defaultValue={item.caption ?? ""}
                  onBlur={(event) => handleCaptionBlur(item, event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-destructive"
                  onClick={() => handleDelete(item)}
                  disabled={deleteMedia.isPending}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MediaPreview({ item }: { item: InventoryMedia }) {
  if (item.media_type === "video") {
    return item.public_url ? (
      <video
        className="aspect-video w-full bg-muted object-cover"
        src={item.public_url}
        controls
        preload="metadata"
      />
    ) : (
      <FallbackPreview icon="video" />
    );
  }

  return item.public_url ? (
    <div className="relative aspect-video w-full bg-muted">
      <Image
        src={item.public_url}
        alt={item.caption ?? "Unit media"}
        fill
        sizes="(max-width: 420px) 50vw, 210px"
        className="object-cover"
        unoptimized
      />
    </div>
  ) : (
    <FallbackPreview icon="image" />
  );
}

function FallbackPreview({ icon }: { icon: "image" | "video" }) {
  const Icon = icon === "video" ? Video : ImageIcon;
  return (
    <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
      <Icon />
    </div>
  );
}
