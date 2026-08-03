import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { InventoryNote, LeadNote, NoteType, Task } from "@/types";
import { leadsKey } from "./leads";
import { inventoryKey } from "./inventory";

export const tasksKey = (includeDone: boolean) => ["tasks", { includeDone }] as const;
export const leadNotesKey = (leadId: string) => ["lead_notes", leadId] as const;
export const leadTasksKey = (leadId: string) => ["tasks", "lead", leadId] as const;
export const inventoryNotesKey = (inventoryId: string) => ["inventory_notes", inventoryId] as const;

export function useTasks(includeDone = false) {
  return useQuery({
    queryKey: tasksKey(includeDone),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(
          `
          *,
          leads(id, name)
        `
        )
        .order("due_date", { ascending: true, nullsFirst: false });

      if (!includeDone) {
        query = query.eq("is_done", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useLeadTasks(leadId: string) {
  return useQuery({
    queryKey: leadTasksKey(leadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("lead_id", leadId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    },
    enabled: Boolean(leadId),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Pick<Task, "lead_id" | "title" | "due_date" | "due_time">) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: leadTasksKey(data.lead_id) });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_done, lead_id }: { id: string; is_done: boolean; lead_id: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ is_done })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { data, lead_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: leadTasksKey(result.lead_id) });
    },
  });
}

export function useLeadNotes(leadId: string) {
  return useQuery({
    queryKey: leadNotesKey(leadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadNote[];
    },
    enabled: Boolean(leadId),
  });
}

export function useCreateLeadNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lead_id,
      content,
      note_type,
    }: {
      lead_id: string;
      content: string;
      note_type: NoteType;
    }) => {
      const { data, error } = await supabase
        .from("lead_notes")
        .insert({ lead_id, content, note_type })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leadNotesKey(data.lead_id) });
      queryClient.invalidateQueries({ queryKey: leadsKey });
    },
  });
}

export function useInventoryNotes(inventoryId: string) {
  return useQuery({
    queryKey: inventoryNotesKey(inventoryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_notes")
        .select("*")
        .eq("inventory_id", inventoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InventoryNote[];
    },
    enabled: Boolean(inventoryId),
  });
}

export function useCreateInventoryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inventory_id,
      content,
      note_type,
    }: {
      inventory_id: string;
      content: string;
      note_type: NoteType;
    }) => {
      const { data, error } = await supabase
        .from("inventory_notes")
        .insert({ inventory_id, content, note_type })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryNotesKey(data.inventory_id) });
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}
