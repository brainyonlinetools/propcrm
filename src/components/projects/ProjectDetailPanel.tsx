"use client";

import { useState } from "react";
import Image from "next/image";
import { Edit3, ImageIcon, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteProject } from "@/lib/queries/projects";
import { PROJECT_STATUS_LABELS, type Project, type ProjectMedia } from "@/types";

interface ProjectDetailPanelProps {
  project: Project;
  onEdit: () => void;
  onDeleted?: () => void;
}

export function ProjectDetailPanel({ project, onEdit, onDeleted }: ProjectDetailPanelProps) {
  const deleteProject = useDeleteProject();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const media = project.project_media ?? [];
  const fields = [
    project.location ? { label: "Location", value: project.location } : null,
    project.region ? { label: "Region", value: project.region } : null,
    project.status
      ? { label: "Status", value: PROJECT_STATUS_LABELS[project.status] }
      : null,
    project.land_area ? { label: "Land Area", value: project.land_area } : null,
    project.total_towers ? { label: "Towers", value: project.total_towers } : null,
    project.sizes ? { label: "Sizes", value: project.sizes } : null,
    project.usps ? { label: "USPs", value: project.usps } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  async function handleDelete() {
    try {
      await deleteProject.mutateAsync(project.id);
      toast.success("Project deleted");
      setDeleteOpen(false);
      onDeleted?.();
    } catch {
      toast.error("Failed to delete project");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{project.name}</h1>
          {project.location && (
            <p className="truncate text-sm text-muted-foreground">{project.location}</p>
          )}
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Delete project">
              <Trash2 className="text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {project.name}? Media files will also be removed.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteProject.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="Edit project">
          <Edit3 />
        </Button>
      </div>

      {media[0] && <ProjectHero media={media[0]} projectName={project.name} />}

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project details yet</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span className="shrink-0 text-muted-foreground">{field.label}</span>
                <span className="min-w-0 text-right break-words font-medium">{field.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {media.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold">Media</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {media.map((item) => (
              <ProjectMediaThumb key={item.id} media={item} projectName={project.name} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectHero({
  media,
  projectName,
}: {
  media: ProjectMedia;
  projectName: string;
}) {
  if (media.media_type === "video") {
    return media.public_url ? (
      <div className="relative overflow-hidden rounded-lg border border-border">
        <video
          className="aspect-video w-full bg-muted object-cover"
          src={media.public_url}
          controls
          preload="metadata"
        />
        <Badge variant="secondary" className="absolute right-2 bottom-2">
          <Video />
          Video
        </Badge>
      </div>
    ) : null;
  }

  if (!media.public_url) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
      <Image
        src={media.public_url}
        alt={media.caption ?? projectName}
        fill
        sizes="(max-width: 768px) 100vw, 60vw"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

function ProjectMediaThumb({
  media,
  projectName,
}: {
  media: ProjectMedia;
  projectName: string;
}) {
  if (media.media_type === "video") {
    return (
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {media.public_url ? (
          <video className="h-full w-full object-cover" src={media.public_url} preload="metadata" />
        ) : (
          <Video />
        )}
        <Badge variant="secondary" className="absolute right-1 bottom-1 scale-90">
          <Video />
        </Badge>
      </div>
    );
  }

  if (!media.public_url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ImageIcon />
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
      <Image
        src={media.public_url}
        alt={media.caption ?? projectName}
        fill
        sizes="160px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
