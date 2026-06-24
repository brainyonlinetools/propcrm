import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { Inventory, InventoryInsert } from "@/types";

export const inventoryKey = ["inventory"] as const;
export const inventoryItemKey = (id: string) => ["inventory", id] as const;

export function useInventory() {
  return useQuery({
    queryKey: inventoryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          *,
          projects(id, name, location)
        `
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const item = row as Inventory & { custom_data: unknown };
        return {
          ...item,
          custom_data: (item.custom_data as Record<string, unknown>) ?? {},
        };
      });
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
      const item = data as Inventory & { custom_data: unknown };
      return {
        ...item,
        custom_data: (item.custom_data as Record<string, unknown>) ?? {},
      };
    },
    enabled: Boolean(id),
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
        .select()
        .single();
      if (error) throw error;
      return data;
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
        .select()
        .single();
      if (error) throw error;
      return data;
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
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}
