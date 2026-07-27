"use client";

import { Edit3, ImageIcon, Video } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PROJECT_STATUS_LABELS, type Project, type ProjectMedia } from "@/types";

interface ProjectCardProps {
  project: Project;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onEdit: () => void;
}

export function ProjectCard({
  project,
  selected,
  onSelectedChange,
  onEdit,
}: ProjectCardProps) {
  const media = project.project_media ?? [];
  const cover = media[0];
  const summaryFields = [
    project.region ? { label: "Region", value: project.region } : null,
    project.status
      ? { label: "Status", value: PROJECT_STATUS_LABELS[project.status] }
      : null,
    project.land_area ? { label: "Land Area", value: project.land_area } : null,
    project.total_towers ? { label: "Towers", value: project.total_towers } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-card transition-colors active:bg-muted/50">
      <ProjectCover media={cover} projectName={project.name} />
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(Boolean(checked))}
            aria-label={`Select ${project.name}`}
            className="mt-1"
          />
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
            <h3 className="truncate text-sm font-semibold">{project.name}</h3>
            {project.location && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{project.location}</p>
            )}
          </button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit project">
            <Edit3 />
          </Button>
        </div>

        {summaryFields.length > 0 && (
          <div className="flex flex-col gap-1 text-xs">
            {summaryFields.map((field) => (
              <div key={field.label} className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground">{field.label}</span>
                <span className="max-w-[55%] truncate text-right font-medium">{field.value}</span>
              </div>
            ))}
          </div>
        )}

        {media.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              {media.length} media {media.length === 1 ? "item" : "items"}
            </Badge>
          </div>
        )}
      </div>
    </article>
  );
}

function ProjectCover({
  media,
  projectName,
}: {
  media: ProjectMedia | undefined;
  projectName: string;
}) {
  if (!media) {
    return (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon />
      </div>
    );
  }

  if (media.media_type === "video") {
    return media.public_url ? (
      <div className="relative">
        <video className="aspect-video w-full bg-muted object-cover" src={media.public_url} preload="metadata" />
        <Badge variant="secondary" className="absolute right-2 bottom-2">
          <Video />
          Video
        </Badge>
      </div>
    ) : (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <Video />
      </div>
    );
  }

  return media.public_url ? (
    <div className="relative aspect-video w-full bg-muted">
      <Image
        src={media.public_url}
        alt={media.caption ?? projectName}
        fill
        sizes="(max-width: 420px) 50vw, 210px"
        className="object-cover"
        unoptimized
      />
    </div>
  ) : (
    <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
      <ImageIcon />
    </div>
  );
}
