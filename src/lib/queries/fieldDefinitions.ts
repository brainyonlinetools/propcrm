import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { EntityType, FieldDefinition } from "@/types";

export const fieldDefinitionsKey = (entityType: EntityType) =>
  ["field_definitions", entityType] as const;

export function useFieldDefinitions(entityType: EntityType) {
  return useQuery({
    queryKey: fieldDefinitionsKey(entityType),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_definitions")
        .select("*")
        .eq("entity_type", entityType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        options: Array.isArray(row.options)
          ? (row.options as string[])
          : row.options
            ? (JSON.parse(String(row.options)) as string[])
            : null,
      })) as FieldDefinition[];
    },
  });
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (field: Omit<FieldDefinition, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("field_definitions")
        .insert({
          entity_type: field.entity_type,
          field_key: field.field_key,
          label: field.label,
          field_type: field.field_type,
          options: field.options as Json | null,
          is_required: field.is_required,
          show_in_card: field.show_in_card,
          sort_order: field.sort_order,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: fieldDefinitionsKey(variables.entity_type),
      });
    },
  });
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      entityType,
      ...updates
    }: {
      id: string;
      entityType: EntityType;
      label?: string;
      is_required?: boolean;
      show_in_card?: boolean;
      sort_order?: number;
      options?: string[] | null;
    }) => {
      const { data, error } = await supabase
        .from("field_definitions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { data, entityType };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: fieldDefinitionsKey(result.entityType),
      });
    },
  });
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityType }: { id: string; entityType: EntityType }) => {
      const { error } = await supabase.from("field_definitions").delete().eq("id", id);
      if (error) throw error;
      return entityType;
    },
    onSuccess: (entityType) => {
      queryClient.invalidateQueries({ queryKey: fieldDefinitionsKey(entityType) });
    },
  });
}

export function useReorderFieldDefinitions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entityType,
      orderedIds,
    }: {
      entityType: EntityType;
      orderedIds: string[];
    }) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from("field_definitions").update({ sort_order: index }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      return entityType;
    },
    onSuccess: (entityType) => {
      queryClient.invalidateQueries({ queryKey: fieldDefinitionsKey(entityType) });
    },
  });
}
