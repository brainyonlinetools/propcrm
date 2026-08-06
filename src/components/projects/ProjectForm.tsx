"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
import { ProjectMediaUploader } from "@/components/projects/ProjectMediaUploader";
import {
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "@/lib/queries/projects";
import { PROJECT_STATUS_OPTIONS, type Project, type ProjectStatus } from "@/types";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  location: z.string().optional(),
  region: z.string().optional(),
  status: z
    .enum(["upcoming", "under_construction", "ready_to_move", "completed"])
    .optional()
    .nullable(),
  land_area: z.string().optional(),
  total_towers: z.string().optional(),
  sizes: z.string().optional(),
  usps: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onDeleted?: () => void;
}

export function ProjectForm({ open, onOpenChange, project, onDeleted }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const activeProject = savedProject ?? project ?? null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      location: "",
      region: "",
      status: null,
      land_area: "",
      total_towers: "",
      sizes: "",
      usps: "",
    },
  });

  useEffect(() => {
    if (!open) {
      setSavedProject(null);
      return;
    }

    if (project) {
      setSavedProject(null);
      reset({
        name: project.name,
        location: project.location ?? "",
        region: project.region ?? "",
        status: project.status ?? null,
        land_area: project.land_area ?? "",
        total_towers: project.total_towers ?? "",
        sizes: project.sizes ?? "",
        usps: project.usps ?? "",
      });
    } else if (!savedProject) {
      reset({
        name: "",
        location: "",
        region: "",
        status: null,
        land_area: "",
        total_towers: "",
        sizes: "",
        usps: "",
      });
    }
  }, [open, project, reset, savedProject]);

  async function onSubmit(values: ProjectFormValues) {
    const payload = {
      name: values.name.trim(),
      location: values.location?.trim() || null,
      region: values.region?.trim() || null,
      status: values.status ?? null,
      land_area: values.land_area?.trim() || null,
      total_towers: values.total_towers?.trim() || null,
      sizes: values.sizes?.trim() || null,
      usps: values.usps?.trim() || null,
    };

    try {
      if (activeProject) {
        await updateProject.mutateAsync({ id: activeProject.id, ...payload });
        toast.success("Project updated");
        onOpenChange(false);
      } else {
        const created = await createProject.mutateAsync(payload);
        setSavedProject(created as Project);
        toast.success("Project added — you can upload photos & videos now");
      }
    } catch {
      toast.error(activeProject ? "Failed to update project" : "Failed to add project");
    }
  }

  async function handleDelete() {
    if (!activeProject) return;
    try {
      await deleteProject.mutateAsync(activeProject.id);
      toast.success("Project deleted");
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch {
      toast.error("Failed to delete project");
    }
  }

  const isPending =
    createProject.isPending || updateProject.isPending || deleteProject.isPending;
  const status = watch("status");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>{activeProject ? "Edit Project" : "Add Project"}</SheetTitle>
          <SheetDescription>
            Add the details and media that will be shared with clients.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Project Name *</Label>
            <Input id="project-name" className="h-12" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-location">Location</Label>
            <Input
              id="project-location"
              className="h-12"
              placeholder="e.g. Sector 62, Golf Course Extension Road"
              {...register("location")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-region">Region</Label>
            <Input
              id="project-region"
              className="h-12"
              placeholder="e.g. Gurugram, Noida"
              {...register("region")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select
              value={status ?? ""}
              onValueChange={(value) =>
                setValue("status", value ? (value as ProjectStatus) : null)
              }
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-land-area">Land Area</Label>
              <Input
                id="project-land-area"
                className="h-12"
                placeholder="e.g. 12 acres"
                {...register("land_area")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-total-towers">Total Towers</Label>
              <Input
                id="project-total-towers"
                className="h-12"
                placeholder="e.g. 4"
                {...register("total_towers")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-sizes">Sizes</Label>
            <Textarea
              id="project-sizes"
              rows={4}
              placeholder={"e.g.\n2BHK — 1200 sq.ft.\n3BHK — 1650 sq.ft.\n4BHK — 2400 sq.ft."}
              {...register("sizes")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-usps">USPs</Label>
            <Textarea
              id="project-usps"
              rows={4}
              placeholder={"e.g.\nClubhouse & pool\nMetro connectivity\nGated community"}
              {...register("usps")}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {activeProject ? "Save Changes" : "Add Project"}
          </Button>
        </form>

        {activeProject && (
          <div className="mt-4 border-t border-border pt-4">
            <ProjectMediaUploader project={activeProject} />
          </div>
        )}

        {activeProject && (
          <div className="mt-6 border-t border-border pt-4">
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isPending}
                >
                  Delete project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {activeProject.name}? Media files will also be
                    removed. This action cannot be undone.
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
