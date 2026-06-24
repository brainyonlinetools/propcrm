import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { Lead, LeadInsert } from "@/types";

export const leadsKey = ["leads"] as const;
export const leadKey = (id: string) => ["leads", id] as const;

export function useLeads() {
  return useQuery({
    queryKey: leadsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          `
          *,
          pipeline_stages(id, label, color, sort_order)
        `
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const lead = row as Lead & { custom_data: unknown };
        return {
          ...lead,
          custom_data: (lead.custom_data as Record<string, unknown>) ?? {},
        };
      });
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKey(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          `
          *,
          pipeline_stages(id, label, color, sort_order)
        `
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const lead = data as Lead & { custom_data: unknown };
      return {
        ...lead,
        custom_data: (lead.custom_data as Record<string, unknown>) ?? {},
      };
    },
    enabled: Boolean(id),
  });
}

export function useLeadsByUnit(unitId: string) {
  return useQuery({
    queryKey: ["leads", "by_unit", unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, stage_id, pipeline_stages(label, color)")
        .eq("linked_unit_id", unitId);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        phone: string | null;
        stage_id: string | null;
        pipeline_stages: { label: string; color: string } | null;
      }>;
    },
    enabled: Boolean(unitId),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          ...lead,
          custom_data: (lead.custom_data ?? {}) as Json,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
    },
  });
}

export function useBulkCreateLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leads: LeadInsert[]) => {
      const { data, error } = await supabase
        .from("leads")
        .insert(
          leads.map((lead) => ({
            ...lead,
            custom_data: (lead.custom_data ?? {}) as Json,
          }))
        )
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<LeadInsert> & { id: string }) => {
      const { custom_data, ...rest } = updates;
      const { data, error } = await supabase
        .from("leads")
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
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: leadKey(data.id) });
    },
  });
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage_id }: { id: string; stage_id: string | null }) => {
      const { data, error } = await supabase
        .from("leads")
        .update({ stage_id })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, stage_id }) => {
      await queryClient.cancelQueries({ queryKey: leadsKey });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey);
      if (previous) {
        queryClient.setQueryData<Lead[]>(
          leadsKey,
          previous.map((lead) => (lead.id === id ? { ...lead, stage_id } : lead))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(leadsKey, context.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: leadKey(vars.id) });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
    },
  });
}
