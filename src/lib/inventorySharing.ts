import { INVENTORY_MEDIA_BUCKET } from "@/lib/queries/inventory";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { Inventory, InventoryMedia, InventoryStatus } from "@/types";
import { INVENTORY_STATUS_CONFIG } from "@/types";

/** Keys that must never appear in shared inventory messages. */
const PRIVATE_CUSTOM_KEYS = new Set([
  "owner_name",
  "owner_phone",
  "owner",
  "owner_contact",
  "owner_email",
]);

export function getInventorySharePath(unitIds: string[]): string {
  const ids = unitIds.filter(Boolean);
  return `/share/inventory?ids=${encodeURIComponent(ids.join(","))}`;
}

export function getInventoryShareUrl(unitIds: string[], origin?: string): string {
  const path = getInventorySharePath(unitIds);
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${path}` : path;
}

export function parseInventoryShareIds(ids: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(ids) ? ids.join(",") : ids;
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function getProjectName(unit: Inventory): string | null {
  const fromCustom = unit.custom_data?.project_name;
  if (typeof fromCustom === "string" && fromCustom.trim()) return fromCustom.trim();
  return unit.projects?.name ?? null;
}

function getPublicCustomFields(unit: Inventory): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  const data = unit.custom_data ?? {};

  const labels: Record<string, string> = {
    property_type: "Property Type",
    floor: "Floor",
    facing: "Facing",
    car_parking: "Car Parking",
    remarks: "Remarks",
  };

  for (const [key, raw] of Object.entries(data)) {
    if (PRIVATE_CUSTOM_KEYS.has(key)) continue;
    if (key === "project_name") continue;
    if (raw == null || raw === "") continue;

    const label =
      labels[key] ??
      key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    const value =
      key === "property_type" ? String(raw).charAt(0).toUpperCase() + String(raw).slice(1) : String(raw);
    fields.push({ label, value });
  }

  return fields;
}

function getUnitDetailLines(unit: Inventory): string[] {
  const lines: string[] = [];
  const projectName = getProjectName(unit);
  if (projectName) lines.push(`Project: ${projectName}`);
  if (unit.unit_type) lines.push(`Type: ${unit.unit_type}`);
  if (unit.area_sqft != null) {
    lines.push(`Area: ${unit.area_sqft.toLocaleString("en-IN")} sq.ft.`);
  }
  if (unit.price != null) lines.push(`Price: ${formatCurrency(unit.price)}`);
  if (unit.status) {
    const statusLabel =
      INVENTORY_STATUS_CONFIG[unit.status as InventoryStatus]?.label ?? unit.status;
    lines.push(`Status: ${statusLabel}`);
  }

  for (const field of getPublicCustomFields(unit)) {
    lines.push(`${field.label}: ${field.value}`);
  }

  return lines;
}

export function getInventoryMediaUrls(units: Inventory[]): string[] {
  return units.flatMap((unit) =>
    (unit.inventory_media ?? [])
      .map((media) => media.public_url)
      .filter((url): url is string => Boolean(url))
  );
}

export function buildInventoryShareText({
  units,
  shareUrl,
  includeLink = false,
  includeMediaUrls = false,
}: {
  units: Inventory[];
  shareUrl?: string;
  includeLink?: boolean;
  includeMediaUrls?: boolean;
}): string {
  const title =
    units.length === 1
      ? `Sharing unit ${units[0].unit_number}`
      : `Sharing ${units.length} inventory options`;

  const unitLines = units.map((unit, index) => {
    const heading =
      units.length === 1 ? unit.unit_number : `${index + 1}. ${unit.unit_number}`;
    return [heading, ...getUnitDetailLines(unit)].join("\n");
  });

  const parts = [title, ...unitLines];

  if (includeMediaUrls) {
    const mediaUrls = getInventoryMediaUrls(units);
    if (mediaUrls.length > 0) {
      parts.push(`Photos & videos:\n${mediaUrls.join("\n")}`);
    }
  }

  if (includeLink && shareUrl) {
    parts.push(`View details: ${shareUrl}`);
  }

  return parts.join("\n\n");
}

export function countInventoryMedia(units: Inventory[]): number {
  return units.reduce((total, unit) => total + (unit.inventory_media?.length ?? 0), 0);
}

export function getInventoryMediaFileName(
  media: InventoryMedia,
  unitNumber: string,
  index: number
): string {
  const fromPath = media.storage_path.split("/").pop();
  if (fromPath) return fromPath;

  const ext =
    media.mime_type.split("/")[1]?.split(";")[0] ||
    (media.media_type === "video" ? "mp4" : "jpg");
  const safeName = unitNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  return `${safeName || "unit"}-${index + 1}.${ext}`;
}

function getShareableMimeType(media: InventoryMedia, blob: Blob): string {
  if (media.mime_type?.startsWith("image/") || media.mime_type?.startsWith("video/")) {
    return media.mime_type;
  }
  if (blob.type?.startsWith("image/") || blob.type?.startsWith("video/")) {
    return blob.type;
  }
  return media.media_type === "video" ? "video/mp4" : "image/jpeg";
}

async function downloadMediaBlob(media: InventoryMedia): Promise<Blob | null> {
  if (media.storage_path) {
    const { data, error } = await supabase.storage
      .from(INVENTORY_MEDIA_BUCKET)
      .download(media.storage_path);
    if (!error && data) return data;
  }

  if (!media.public_url) return null;

  try {
    const response = await fetch(media.public_url, { mode: "cors", credentials: "omit" });
    if (!response.ok) return null;
    return response.blob();
  } catch {
    return null;
  }
}

export async function fetchInventoryMediaFiles(units: Inventory[]): Promise<File[]> {
  const tasks: Promise<File | null>[] = [];

  for (const unit of units) {
    const mediaItems = unit.inventory_media ?? [];
    for (let index = 0; index < mediaItems.length; index++) {
      const media = mediaItems[index];
      if (!media.storage_path && !media.public_url) continue;

      tasks.push(
        (async () => {
          const blob = await downloadMediaBlob(media);
          if (!blob) return null;

          const fileName = getInventoryMediaFileName(media, unit.unit_number, index);
          const type = getShareableMimeType(media, blob);
          return new File([blob], fileName, { type, lastModified: Date.now() });
        })()
      );
    }
  }

  const results = await Promise.all(tasks);
  return results.filter((file): file is File => file !== null);
}

function getShareableImageFiles(files: File[]): File[] {
  return files.filter((file) => file.type.startsWith("image/"));
}

function canShareMediaFiles(files: File[]): boolean {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    return false;
  }
  if (files.length === 0) return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

function getPreferredShareableFiles(files: File[]): File[] {
  if (files.length === 0) return [];
  const imageFiles = getShareableImageFiles(files);
  if (imageFiles.length > 0 && canShareMediaFiles(imageFiles)) return imageFiles;
  if (canShareMediaFiles(files)) return files;
  return [];
}

function getShareTitle(units: Inventory[]): string {
  return units.length === 1 ? units[0].unit_number : `${units.length} inventory options`;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function getWhatsAppDeepLink(message: string): string {
  return `whatsapp://send?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppWithMessage(message: string): void {
  const urls = isMobileDevice()
    ? [getWhatsAppDeepLink(message), getWhatsAppShareUrl(message)]
    : [getWhatsAppShareUrl(message)];

  for (const url of urls) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    if (typeof anchor.remove === "function") {
      anchor.remove();
    } else {
      anchor.parentNode?.removeChild(anchor);
    }
    return;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadMediaFiles(files: File[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export type InventoryShareResult = "native" | "whatsapp" | "whatsapp-with-photos";

/**
 * Share property details + media. Owner name/phone are never included in the text.
 */
export async function shareInventory({
  units,
  preferWhatsApp = false,
}: {
  units: Inventory[];
  preferWhatsApp?: boolean;
}): Promise<InventoryShareResult> {
  const message = buildInventoryShareText({
    units,
    includeLink: false,
    includeMediaUrls: false,
  });

  let files: File[] = [];
  try {
    files = await fetchInventoryMediaFiles(units);
  } catch {
    files = [];
  }

  const shareableFiles = getPreferredShareableFiles(files);
  await copyTextToClipboard(message);

  if (shareableFiles.length > 0) {
    try {
      await navigator.share({
        files: shareableFiles,
        title: getShareTitle(units),
        text: preferWhatsApp ? undefined : message,
      });
      return preferWhatsApp ? "whatsapp-with-photos" : "native";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  if (!preferWhatsApp && typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: getShareTitle(units),
        text: message,
      });
      return "native";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  if (files.length > 0) {
    downloadMediaFiles(files);
  }

  openWhatsAppWithMessage(message);
  return shareableFiles.length > 0 || files.length > 0 ? "whatsapp" : "whatsapp";
}
