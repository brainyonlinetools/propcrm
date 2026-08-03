import { PROJECT_MEDIA_BUCKET } from "@/lib/queries/projects";
import { supabase } from "@/lib/supabase";
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectMedia,
  type ProjectStatus,
} from "@/types";

export function getProjectSharePath(projectIds: string[]): string {
  const ids = projectIds.filter(Boolean);
  return `/share/projects?ids=${encodeURIComponent(ids.join(","))}`;
}

export function getProjectShareUrl(projectIds: string[], origin?: string): string {
  const path = getProjectSharePath(projectIds);
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${path}` : path;
}

export function getWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function getWhatsAppDeepLink(message: string): string {
  return `whatsapp://send?text=${encodeURIComponent(message)}`;
}

export function parseProjectShareIds(ids: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(ids) ? ids.join(",") : ids;
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function getProjectDetailLines(project: Project): string[] {
  const lines: string[] = [];

  if (project.location) lines.push(`Location: ${project.location}`);
  if (project.region) lines.push(`Region: ${project.region}`);
  if (project.status) {
    lines.push(`Status: ${PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status}`);
  }
  if (project.land_area) lines.push(`Land Area: ${project.land_area}`);
  if (project.total_towers) lines.push(`Total Towers: ${project.total_towers}`);
  if (project.sizes) lines.push(`Sizes:\n${project.sizes}`);
  if (project.usps) lines.push(`USPs:\n${project.usps}`);

  return lines;
}

export function getProjectMediaUrls(projects: Project[]): string[] {
  return projects.flatMap((project) =>
    (project.project_media ?? [])
      .map((media) => media.public_url)
      .filter((url): url is string => Boolean(url))
  );
}

export function buildProjectShareText({
  projects,
  shareUrl,
  includeLink = false,
  includeMediaUrls = false,
}: {
  projects: Project[];
  shareUrl?: string;
  includeLink?: boolean;
  includeMediaUrls?: boolean;
}): string {
  const title =
    projects.length === 1
      ? `Sharing details for ${projects[0].name}`
      : `Sharing ${projects.length} project options`;

  const projectLines = projects.map((project, index) => {
    const heading = projects.length === 1 ? project.name : `${index + 1}. ${project.name}`;
    return [heading, ...getProjectDetailLines(project)].join("\n");
  });

  const parts = [title, ...projectLines];

  if (includeMediaUrls) {
    const mediaUrls = getProjectMediaUrls(projects);
    if (mediaUrls.length > 0) {
      parts.push(`Photos & videos:\n${mediaUrls.join("\n")}`);
    }
  }

  if (includeLink && shareUrl) {
    parts.push(`View details: ${shareUrl}`);
  }

  return parts.join("\n\n");
}

export function countProjectMedia(projects: Project[]): number {
  return projects.reduce((total, project) => total + (project.project_media?.length ?? 0), 0);
}

export function getProjectMediaFileName(
  media: ProjectMedia,
  projectName: string,
  index: number
): string {
  const fromPath = media.storage_path.split("/").pop();
  if (fromPath) return fromPath;

  const ext =
    media.mime_type.split("/")[1]?.split(";")[0] ||
    (media.media_type === "video" ? "mp4" : "jpg");
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  return `${safeName || "project"}-${index + 1}.${ext}`;
}

function getShareableMimeType(media: ProjectMedia, blob: Blob): string {
  if (media.mime_type?.startsWith("image/") || media.mime_type?.startsWith("video/")) {
    return media.mime_type;
  }
  if (blob.type?.startsWith("image/") || blob.type?.startsWith("video/")) {
    return blob.type;
  }
  return media.media_type === "video" ? "video/mp4" : "image/jpeg";
}

async function downloadMediaBlob(media: ProjectMedia): Promise<Blob | null> {
  if (media.storage_path) {
    const { data, error } = await supabase.storage
      .from(PROJECT_MEDIA_BUCKET)
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

export async function fetchProjectMediaFiles(projects: Project[]): Promise<File[]> {
  const tasks: Promise<File | null>[] = [];

  for (const project of projects) {
    const mediaItems = project.project_media ?? [];
    for (let index = 0; index < mediaItems.length; index++) {
      const media = mediaItems[index];
      if (!media.storage_path && !media.public_url) continue;

      tasks.push(
        (async () => {
          const blob = await downloadMediaBlob(media);
          if (!blob) return null;

          const fileName = getProjectMediaFileName(media, project.name, index);
          const type = getShareableMimeType(media, blob);
          return new File([blob], fileName, { type, lastModified: Date.now() });
        })()
      );
    }
  }

  const results = await Promise.all(tasks);
  return results.filter((file): file is File => file !== null);
}

export function getShareableImageFiles(files: File[]): File[] {
  return files.filter((file) => file.type.startsWith("image/"));
}

export function canShareProjectMediaFiles(files: File[]): boolean {
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

function getShareTitle(projects: Project[]): string {
  return projects.length === 1 ? projects[0].name : `${projects.length} project options`;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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

export type ProjectShareResult = "whatsapp" | "whatsapp-with-photos";

export async function shareProjects({
  projects,
}: {
  projects: Project[];
}): Promise<ProjectShareResult> {
  const message = buildProjectShareText({
    projects,
    includeLink: false,
    includeMediaUrls: false,
  });

  let files: File[] = [];
  try {
    files = await fetchProjectMediaFiles(projects);
  } catch {
    files = [];
  }

  if (files.length > 0 && canShareProjectMediaFiles(files)) {
    try {
      await navigator.share({
        files,
        title: getShareTitle(projects),
        text: message,
      });
      return "whatsapp-with-photos";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  openWhatsAppWithMessage(message);
  return "whatsapp";
}

export async function shareProjectsToWhatsApp({
  projects,
}: {
  projects: Project[];
}): Promise<"native-files" | "whatsapp-url"> {
  const result = await shareProjects({ projects });
  if (result === "whatsapp-with-photos") return "native-files";
  return "whatsapp-url";
}

export async function shareProjectsWithMedia({
  projects,
  title,
}: {
  projects: Project[];
  title?: string;
}): Promise<void> {
  await shareProjects({ projects });
  void title;
}

export function downloadProjectMediaFiles(files: File[]): void {
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
