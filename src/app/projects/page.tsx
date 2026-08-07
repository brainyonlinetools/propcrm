"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectDetailPanel } from "@/components/projects/ProjectDetailPanel";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectShareSheet } from "@/components/projects/ProjectShareSheet";
import {
  DetailEmptyState,
  MasterDetailLayout,
} from "@/components/shared/MasterDetailLayout";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import {
  ViewModeToggle,
  type ListViewMode,
} from "@/components/shared/ViewModeToggle";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { projectsKey, useProjects } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABELS, type Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProjectsPage() {
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<ListViewMode>("table");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isDesktop) return;
    if (selectedId && filtered.some((project) => project.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [isDesktop, filtered, selectedId]);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedIds.has(project.id)),
    [projects, selectedIds]
  );

  const selectedProject = useMemo(
    () => filtered.find((project) => project.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const isGallery = view === "gallery";

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

  function handleProjectDeleted(projectId: string) {
    setSelectedIds((current) => {
      if (!current.has(projectId)) return current;
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
    setSelectedId((current) => (current === projectId ? null : current));
    setEditingProject(null);
    setFormOpen(false);
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: projectsKey });
  }

  const listHeader = (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground">
            Manage client-ready project details and media.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ViewModeToggle value={view} onChange={setView} />
          <Button variant="ghost" size="icon" onClick={openCreateForm} aria-label="Add project">
            <Plus />
          </Button>
        </div>
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
  );

  const listBody = (
    <PullToRefresh
      onRefresh={handleRefresh}
      className={cn("flex-1 px-4 py-4", isDesktop && "overflow-y-auto")}
    >
      {isLoading ? (
        <div
          className={cn(
            isGallery
              ? "grid grid-cols-1 gap-3 min-[380px]:grid-cols-2"
              : "overflow-x-auto"
          )}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn("rounded-lg", isGallery ? "h-64" : "h-12 w-full")}
            />
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
      ) : isGallery ? (
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-1">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={selectedIds.has(project.id)}
              onSelectedChange={(selected) => updateSelection(project.id, selected)}
              onEdit={() => openEditForm(project)}
              onOpen={isDesktop ? () => setSelectedId(project.id) : undefined}
              highlighted={isDesktop && selectedId === project.id}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2.5 font-medium" scope="col">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Name
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Location
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Status
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Media
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => {
                const isSelected = selectedId === project.id;
                return (
                  <tr
                    key={project.id}
                    className={cn(
                      "cursor-pointer border-b border-border last:border-b-0",
                      isDesktop && isSelected ? "bg-muted" : "hover:bg-muted/60"
                    )}
                    onClick={() => {
                      if (isDesktop) {
                        setSelectedId(project.id);
                      } else {
                        openEditForm(project);
                      }
                    }}
                  >
                    <td
                      className="px-3 py-2.5 align-middle"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(project.id)}
                        onCheckedChange={(checked) =>
                          updateSelection(project.id, Boolean(checked))
                        }
                        aria-label={`Select ${project.name}`}
                      />
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2.5 align-middle font-medium md:max-w-none">
                      {project.name}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 align-middle text-muted-foreground">
                      {project.location ?? project.region ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-muted-foreground">
                      {project.status ? PROJECT_STATUS_LABELS[project.status] : "—"}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {(project.project_media?.length ?? 0) > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {project.project_media!.length}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PullToRefresh>
  );

  const listPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      {listHeader}
      {listBody}
    </div>
  );

  const detailPane = selectedProject ? (
    <div className="h-full overflow-y-auto bg-background">
      <ProjectDetailPanel
        key={selectedProject.id}
        project={selectedProject}
        onEdit={() => openEditForm(selectedProject)}
        onDeleted={() => handleProjectDeleted(selectedProject.id)}
      />
    </div>
  ) : (
    <DetailEmptyState
      title="Select a project"
      description="Choose a project from the list to view details and media."
    />
  );

  return (
    <>
      <MasterDetailLayout split={isDesktop} list={listPane} detail={detailPane} />

      {selectedProjects.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:bottom-0 md:left-16">
          <div className="mx-auto flex max-w-lg items-center gap-2 md:max-w-none">
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
          className="fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full shadow-lg md:right-6 md:bottom-6"
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
        onDeleted={
          editingProject ? () => handleProjectDeleted(editingProject.id) : undefined
        }
      />
      <ProjectShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        projects={selectedProjects}
      />
    </>
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
