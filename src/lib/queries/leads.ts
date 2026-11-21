import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { Lead, LeadInsert } from "@/types";
import { normalizePhoneKey } from "@/lib/utils";

export const leadsKey = ["leads"] as const;
export const qualifiedLeadsKey = ["leads", "qualified"] as const;
export const leadKey = (id: string) => ["leads", id] as const;

function getLeadSortTime(lead: Lead): number {
  const raw = lead.acquired_date ?? lead.created_at;
  if (!raw) return 0;
  const date = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function sortLeadsByDateDesc(leads: Lead[]): Lead[] {
  return leads.toSorted((a, b) => getLeadSortTime(b) - getLeadSortTime(a));
}

export function findLeadByPhone(
  leads: Lead[],
  phone: string | null | undefined,
  excludeId?: string
): Lead | null {
  const key = normalizePhoneKey(phone);
  if (!key) return null;
  return (
    leads.find(
      (lead) => lead.id !== excludeId && normalizePhoneKey(lead.phone) === key
    ) ?? null
  );
}

function normalizeLeadRow(row: Lead & { custom_data: unknown }): Lead {
  return {
    ...row,
    custom_data: (row.custom_data as Record<string, unknown>) ?? {},
  };
}

export function useLeads() {
  return useQuery({
    queryKey: leadsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          `
          *,
          pipeline_stages(id, label, color, sort_order, kind)
        `
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const leads = (data ?? []).map((row) =>
        normalizeLeadRow(row as Lead & { custom_data: unknown })
      );
      return sortLeadsByDateDesc(leads);
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
          pipeline_stages(id, label, color, sort_order, kind)
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
      queryClient.invalidateQueries({ queryKey: qualifiedLeadsKey });
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
      queryClient.invalidateQueries({ queryKey: qualifiedLeadsKey });
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
      queryClient.invalidateQueries({ queryKey: qualifiedLeadsKey });
      queryClient.invalidateQueries({ queryKey: leadKey(data.id) });
    },
  });
}

export function useBulkDeleteLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: qualifiedLeadsKey });
    },
  });
}

export interface DeleteLeadResult {
  deleted?: boolean;
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<DeleteLeadResult> => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as DeleteLeadResult & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to delete lead");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: qualifiedLeadsKey });
    },
  });
}
