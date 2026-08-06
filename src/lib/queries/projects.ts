import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Project, ProjectInsert, ProjectMedia, ProjectMediaInsert, ProjectStatus } from "@/types";

export const projectsKey = ["projects"] as const;
export const projectKey = (id: string) => ["projects", id] as const;
export const projectsByIdsKey = (ids: string[]) => ["projects", "share", ids] as const;
export const projectMediaKey = (projectId: string) => ["project_media", projectId] as const;

export const PROJECT_MEDIA_BUCKET = "project-media";

function getProjectMediaPublicUrl(storagePath: string): string {
  return supabase.storage.from(PROJECT_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function normalizeMedia(media: ProjectMedia[] | null | undefined): ProjectMedia[] {
  return (media ?? [])
    .map((item) => ({
      ...item,
      public_url: getProjectMediaPublicUrl(item.storage_path),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

function normalizeProject(row: Project & { project_media?: ProjectMedia[] | null }): Project {
  return {
    ...row,
    status: (row.status as ProjectStatus | null) ?? null,
    project_media: normalizeMedia(row.project_media),
  };
}

function sanitizeFileName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "project-media";
}

function createStoragePath(projectId: string, file: File): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${projectId}/${id}-${sanitizeFileName(file.name)}`;
}

export function useProjects() {
  return useQuery({
    queryKey: projectsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_media(*)")
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as (Project & { project_media?: ProjectMedia[] | null })[]).map(normalizeProject);
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKey(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_media(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return normalizeProject(data as Project & { project_media?: ProjectMedia[] | null });
    },
    enabled: Boolean(id),
  });
}

export function useProjectsByIds(ids: string[]) {
  return useQuery({
    queryKey: projectsByIdsKey(ids),
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_media(*)")
        .in("id", ids)
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as (Project & { project_media?: ProjectMedia[] | null })[]).map(normalizeProject);
    },
    enabled: ids.length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await supabase
        .from("projects")
        .insert(project)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<ProjectInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
      queryClient.invalidateQueries({ queryKey: projectKey(data.id) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: media, error: mediaError } = await supabase
        .from("project_media")
        .select("storage_path")
        .eq("project_id", id);
      if (mediaError) throw mediaError;

      const paths = (media ?? [])
        .map((item) => item.storage_path)
        .filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(PROJECT_MEDIA_BUCKET)
          .remove(paths);
        if (storageError) throw storageError;
      }

      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
      queryClient.removeQueries({ queryKey: projectKey(id) });
      queryClient.removeQueries({ queryKey: projectMediaKey(id) });
    },
  });
}

export function useProjectMedia(projectId: string) {
  return useQuery({
    queryKey: projectMediaKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_media")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return normalizeMedia(data as ProjectMedia[]);
    },
    enabled: Boolean(projectId),
  });
}

export function useUploadProjectMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      caption,
      sortOrder = 0,
    }: {
      projectId: string;
      file: File;
      caption?: string | null;
      sortOrder?: number;
    }) => {
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const storagePath = createStoragePath(projectId, file);

      const { error: uploadError } = await supabase.storage
        .from(PROJECT_MEDIA_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const metadata: ProjectMediaInsert = {
        project_id: projectId,
        storage_path: storagePath,
        media_type: mediaType,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        caption: caption?.trim() || null,
        sort_order: sortOrder,
      };

      const { data, error } = await supabase
        .from("project_media")
        .insert(metadata)
        .select()
        .single();
      if (error) throw error;
      return normalizeMedia([data as ProjectMedia])[0];
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
      queryClient.invalidateQueries({ queryKey: projectKey(media.project_id) });
      queryClient.invalidateQueries({ queryKey: projectMediaKey(media.project_id) });
    },
  });
}

export function useUpdateProjectMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      project_id,
      caption,
      sort_order,
    }: Pick<ProjectMedia, "id" | "project_id"> & Partial<Pick<ProjectMedia, "caption" | "sort_order">>) => {
      const { data, error } = await supabase
        .from("project_media")
        .update({ caption, sort_order })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return normalizeMedia([data as ProjectMedia])[0] ?? { project_id };
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
      queryClient.invalidateQueries({ queryKey: projectKey(media.project_id) });
      queryClient.invalidateQueries({ queryKey: projectMediaKey(media.project_id) });
    },
  });
}

export function useDeleteProjectMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (media: ProjectMedia) => {
      const { error: storageError } = await supabase.storage
        .from(PROJECT_MEDIA_BUCKET)
        .remove([media.storage_path]);
      if (storageError) throw storageError;

      const { error } = await supabase.from("project_media").delete().eq("id", media.id);
      if (error) throw error;
      return media;
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
      queryClient.invalidateQueries({ queryKey: projectKey(media.project_id) });
      queryClient.invalidateQueries({ queryKey: projectMediaKey(media.project_id) });
    },
  });
}
