"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectShareSheet } from "@/components/projects/ProjectShareSheet";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { projectsKey, useProjects } from "@/lib/queries/projects";
import type { Project } from "@/types";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, isError } = useProjects();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((project) => {
      return (
        project.name.toLowerCase().includes(q) ||
        (project.location ?? "").toLowerCase().includes(q) ||
        (project.region ?? "").toLowerCase().includes(q) ||
        (project.status ?? "").toLowerCase().includes(q) ||
        (project.land_area ?? "").toLowerCase().includes(q) ||
        (project.total_towers ?? "").toLowerCase().includes(q) ||
        (project.sizes ?? "").toLowerCase().includes(q) ||
        (project.usps ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, search]);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedIds.has(project.id)),
    [projects, selectedIds]
  );

  function openCreateForm() {
    setEditingProject(null);
    setFormOpen(true);
  }

  function openEditForm(project: Project) {
    setEditingProject(project);
    setFormOpen(true);
  }

  function updateSelection(projectId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(projectId);
      } else {
        next.delete(projectId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: projectsKey });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
            <p className="text-xs text-muted-foreground">
              Manage client-ready project details and media.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={openCreateForm} aria-label="Add project">
            <Plus />
          </Button>
        </div>

        <div className="relative mt-3">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            className="h-12 pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load projects"
            description="Check your Supabase connection and apply the latest migration."
            actionLabel="Try again"
            onAction={handleRefresh}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={projects.length === 0 ? "No projects yet" : "No matching projects"}
            description={
              projects.length === 0
                ? "Add your first project with client-ready details, photos, and videos."
                : "Try a different search term."
            }
            actionLabel={projects.length === 0 ? "Add Project" : undefined}
            onAction={projects.length === 0 ? openCreateForm : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                selected={selectedIds.has(project.id)}
                onSelectedChange={(selected) => updateSelection(project.id, selected)}
                onEdit={() => openEditForm(project)}
              />
            ))}
          </div>
        )}
      </PullToRefresh>

      {selectedProjects.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <p className="min-w-0 flex-1 text-sm font-medium">
              {selectedProjects.length} selected
            </p>
            <Button type="button" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 data-icon="inline-start" />
              Share
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="icon"
          className="fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full shadow-lg"
          onClick={openCreateForm}
          aria-label="Add project"
        >
          <Plus />
        </Button>
      )}

      <ProjectForm
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
      />
      <ProjectShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        projects={selectedProjects}
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
