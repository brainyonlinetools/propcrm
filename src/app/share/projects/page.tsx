"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Building2, ImageIcon, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectsByIds } from "@/lib/queries/projects";
import { parseProjectShareIds } from "@/lib/projectSharing";
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectMedia,
  type ProjectStatus,
} from "@/types";

export default function SharedProjectsPage() {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <SharedProjectsContent />
    </Suspense>
  );
}

function SharedProjectsContent() {
  const searchParams = useSearchParams();
  const ids = useMemo(() => parseProjectShareIds(searchParams.get("ids")), [searchParams]);
  const { data: projects = [], isLoading, isError } = useProjectsByIds(ids);

  if (ids.length === 0) {
    return (
      <ShareShell>
        <EmptyShareState
          title="No projects selected"
          description="Ask your Anand Prime advisor to resend the project link."
        />
      </ShareShell>
    );
  }

  if (isLoading) return <ShareSkeleton />;

  if (isError) {
    return (
      <ShareShell>
        <EmptyShareState
          title="Could not load projects"
          description="The project link may be expired or temporarily unavailable."
        />
      </ShareShell>
    );
  }

  return (
    <ShareShell>
      <header className="rounded-2xl bg-card p-5 shadow-card">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Anand Prime
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {projects.length === 1 ? projects[0].name : "Curated Project Options"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore project details, photos, and videos shared by your Anand Prime advisor.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyShareState
          title="Projects not found"
          description="The selected projects may have been removed."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {projects.map((project) => (
            <ProjectBrochure key={project.id} project={project} />
          ))}
        </div>
      )}
    </ShareShell>
  );
}

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-4 py-5">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">{children}</div>
    </main>
  );
}

function ProjectBrochure({ project }: { project: Project }) {
  const detailFields = [
    project.region ? { label: "Region", value: project.region } : null,
    project.status
      ? {
          label: "Status",
          value: PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status,
        }
      : null,
    project.land_area ? { label: "Land Area", value: project.land_area } : null,
    project.total_towers ? { label: "Total Towers", value: project.total_towers } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <HeroMedia project={project} />

      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
          {project.location && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <Building2 className="mt-0.5 shrink-0" />
              <span>{project.location}</span>
            </p>
          )}
        </div>

        {detailFields.length > 0 && (
          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
            {detailFields.map((field) => (
              <div key={field.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {project.sizes && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">Sizes</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {project.sizes}
            </p>
          </section>
        )}

        {project.usps && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">USPs</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {project.usps}
            </p>
          </section>
        )}

        <MediaGallery media={project.project_media ?? []} projectName={project.name} />
      </div>
    </article>
  );
}

function HeroMedia({ project }: { project: Project }) {
  const cover = project.project_media?.[0];

  if (!cover) {
    return (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon />
      </div>
    );
  }

  if (cover.media_type === "video") {
    return cover.public_url ? (
      <video
        className="aspect-video w-full bg-muted object-cover"
        src={cover.public_url}
        controls
        preload="metadata"
      />
    ) : (
      <FallbackMedia icon="video" />
    );
  }

  return cover.public_url ? (
    <div className="relative aspect-video w-full bg-muted">
      <Image
        src={cover.public_url}
        alt={cover.caption ?? project.name}
        fill
        sizes="(max-width: 640px) 100vw, 512px"
        className="object-cover"
        unoptimized
        priority
      />
    </div>
  ) : (
    <FallbackMedia icon="image" />
  );
}

function MediaGallery({
  media,
  projectName,
}: {
  media: ProjectMedia[];
  projectName: string;
}) {
  if (media.length <= 1) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Photos & Videos</h3>
        <Badge variant="secondary">{media.length} items</Badge>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {media.slice(1).map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-xl border border-border bg-background">
            {item.media_type === "video" ? (
              item.public_url ? (
                <video
                  className="aspect-video w-full bg-muted object-cover"
                  src={item.public_url}
                  controls
                  preload="metadata"
                />
              ) : (
                <FallbackMedia icon="video" />
              )
            ) : item.public_url ? (
              <div className="relative aspect-video w-full bg-muted">
                <Image
                  src={item.public_url}
                  alt={item.caption ?? projectName}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <FallbackMedia icon="image" />
            )}
            {item.caption && (
              <figcaption className="p-2 text-xs text-muted-foreground">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function FallbackMedia({ icon }: { icon: "image" | "video" }) {
  const Icon = icon === "video" ? Video : ImageIcon;
  return (
    <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
      <Icon />
    </div>
  );
}

function EmptyShareState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ShareSkeleton() {
  return (
    <ShareShell>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </ShareShell>
  );
}
