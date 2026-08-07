import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type {
  Inventory,
  InventoryInsert,
  InventoryMedia,
  InventoryMediaInsert,
} from "@/types";

export const inventoryKey = ["inventory"] as const;
export const inventoryItemKey = (id: string) => ["inventory", id] as const;
export const inventoryByIdsKey = (ids: string[]) => ["inventory", "share", ids] as const;
export const inventoryMediaKey = (inventoryId: string) =>
  ["inventory_media", inventoryId] as const;

export const INVENTORY_MEDIA_BUCKET = "inventory-media";

function getInventoryMediaPublicUrl(storagePath: string): string {
  return supabase.storage
    .from(INVENTORY_MEDIA_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;
}

function normalizeMedia(media: InventoryMedia[] | null | undefined): InventoryMedia[] {
  return (media ?? [])
    .map((item) => ({
      ...item,
      public_url: getInventoryMediaPublicUrl(item.storage_path),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

function normalizeInventory(
  row: Inventory & { inventory_media?: InventoryMedia[] | null; custom_data: unknown }
): Inventory {
  return {
    ...row,
    custom_data: (row.custom_data as Record<string, unknown>) ?? {},
    inventory_media: normalizeMedia(row.inventory_media),
  };
}

function sanitizeFileName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "inventory-media";
}

function createStoragePath(inventoryId: string, file: File): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${inventoryId}/${id}-${sanitizeFileName(file.name)}`;
}

export function useInventory() {
  return useQuery({
    queryKey: inventoryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          *,
          projects(id, name, location),
          inventory_media(*)
        `
        )
        .order("acquired_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as (Inventory & {
        inventory_media?: InventoryMedia[] | null;
        custom_data: unknown;
      })[]).map(normalizeInventory);
    },
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: inventoryItemKey(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          *,
          projects(id, name, location)
        `
        )
        .eq("id", id)
        .single();
      if (error) throw error;

      const base = normalizeInventory(
        data as Inventory & {
          inventory_media?: InventoryMedia[] | null;
          custom_data: unknown;
        }
      );

      const { data: media, error: mediaError } = await supabase
        .from("inventory_media")
        .select("*")
        .eq("inventory_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      // Media table may not exist until migration 010 is applied.
      if (mediaError) {
        return { ...base, inventory_media: [] };
      }

      return {
        ...base,
        inventory_media: normalizeMedia(media as InventoryMedia[]),
      };
    },
    enabled: Boolean(id),
  });
}

export function useInventoryByIds(ids: string[]) {
  return useQuery({
    queryKey: inventoryByIdsKey(ids),
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          *,
          projects(id, name, location)
        `
        )
        .in("id", ids)
        .order("unit_number", { ascending: true });
      if (error) throw error;

      const units = ((data ?? []) as (Inventory & {
        inventory_media?: InventoryMedia[] | null;
        custom_data: unknown;
      })[]).map(normalizeInventory);

      const { data: media, error: mediaError } = await supabase
        .from("inventory_media")
        .select("*")
        .in("inventory_id", ids)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (mediaError || !media) {
        return units.map((unit) => ({ ...unit, inventory_media: [] }));
      }

      const mediaByUnit = new Map<string, InventoryMedia[]>();
      for (const item of normalizeMedia(media as InventoryMedia[])) {
        const list = mediaByUnit.get(item.inventory_id) ?? [];
        list.push(item);
        mediaByUnit.set(item.inventory_id, list);
      }

      return units.map((unit) => ({
        ...unit,
        inventory_media: mediaByUnit.get(unit.id) ?? [],
      }));
    },
    enabled: ids.length > 0,
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: InventoryInsert) => {
      const { data, error } = await supabase
        .from("inventory")
        .insert({
          ...item,
          custom_data: (item.custom_data ?? {}) as Json,
        })
        .select(
          `
          *,
          projects(id, name, location)
        `
        )
        .single();
      if (error) throw error;
      return normalizeInventory(
        data as Inventory & {
          inventory_media?: InventoryMedia[] | null;
          custom_data: unknown;
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}

export function useBulkCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: InventoryInsert[]) => {
      const { data, error } = await supabase
        .from("inventory")
        .insert(
          items.map((item) => ({
            ...item,
            custom_data: (item.custom_data ?? {}) as Json,
          }))
        )
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<InventoryInsert> & { id: string }) => {
      const { custom_data, ...rest } = updates;
      const { data, error } = await supabase
        .from("inventory")
        .update({
          ...rest,
          ...(custom_data !== undefined ? { custom_data: custom_data as Json } : {}),
        })
        .eq("id", id)
        .select(
          `
          *,
          projects(id, name, location)
        `
        )
        .single();
      if (error) throw error;
      return normalizeInventory(
        data as Inventory & {
          inventory_media?: InventoryMedia[] | null;
          custom_data: unknown;
        }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: inventoryItemKey(data.id) });
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: media, error: mediaError } = await supabase
        .from("inventory_media")
        .select("storage_path")
        .eq("inventory_id", id);

      if (!mediaError && media && media.length > 0) {
        const paths = media
          .map((item) => item.storage_path)
          .filter((path): path is string => Boolean(path));
        if (paths.length > 0) {
          await supabase.storage.from(INVENTORY_MEDIA_BUCKET).remove(paths);
        }
      }

      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.removeQueries({ queryKey: inventoryItemKey(id) });
      queryClient.removeQueries({ queryKey: inventoryMediaKey(id) });
    },
  });
}

export function useInventoryMedia(inventoryId: string) {
  return useQuery({
    queryKey: inventoryMediaKey(inventoryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_media")
        .select("*")
        .eq("inventory_id", inventoryId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        // Migration 010 may not be applied yet.
        if (error.code === "42P01" || error.message?.includes("inventory_media")) {
          return [];
        }
        throw error;
      }
      return normalizeMedia(data as InventoryMedia[]);
    },
    enabled: Boolean(inventoryId),
  });
}

export function useUploadInventoryMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inventoryId,
      file,
      caption,
      sortOrder = 0,
    }: {
      inventoryId: string;
      file: File;
      caption?: string | null;
      sortOrder?: number;
    }) => {
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const storagePath = createStoragePath(inventoryId, file);

      const { error: uploadError } = await supabase.storage
        .from(INVENTORY_MEDIA_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const metadata: InventoryMediaInsert = {
        inventory_id: inventoryId,
        storage_path: storagePath,
        media_type: mediaType,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        caption: caption?.trim() || null,
        sort_order: sortOrder,
      };

      const { data, error } = await supabase
        .from("inventory_media")
        .insert(metadata)
        .select()
        .single();
      if (error) throw error;
      return normalizeMedia([data as InventoryMedia])[0];
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: inventoryItemKey(media.inventory_id) });
      queryClient.invalidateQueries({ queryKey: inventoryMediaKey(media.inventory_id) });
    },
  });
}

export function useUpdateInventoryMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      inventory_id,
      caption,
      sort_order,
    }: Pick<InventoryMedia, "id" | "inventory_id"> &
      Partial<Pick<InventoryMedia, "caption" | "sort_order">>) => {
      const { data, error } = await supabase
        .from("inventory_media")
        .update({ caption, sort_order })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return normalizeMedia([data as InventoryMedia])[0] ?? { inventory_id };
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: inventoryItemKey(media.inventory_id) });
      queryClient.invalidateQueries({ queryKey: inventoryMediaKey(media.inventory_id) });
    },
  });
}

export function useDeleteInventoryMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (media: InventoryMedia) => {
      const { error: storageError } = await supabase.storage
        .from(INVENTORY_MEDIA_BUCKET)
        .remove([media.storage_path]);
      if (storageError) throw storageError;

      const { error } = await supabase.from("inventory_media").delete().eq("id", media.id);
      if (error) throw error;
      return media;
    },
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: inventoryItemKey(media.inventory_id) });
      queryClient.invalidateQueries({ queryKey: inventoryMediaKey(media.inventory_id) });
    },
  });
}
