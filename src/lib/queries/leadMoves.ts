import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/types";
import { leadsKey, leadKey, qualifiedLeadsKey } from "./leads";
import { inventoryKey } from "./inventory";

export interface MoveLeadsInput {
  ids: string[];
  stage_id: string;
  /** Required when moving to a lost / disqualified stage; cleared otherwise. */
  close_reason?: string | null;
  /** Follow-up created for the moved leads (active stages). */
  next_step?: {
    title: string;
    due_date: string;
    /** Skip leads that already have an open task (used for bulk moves). */
    onlyIfNoOpenTask?: boolean;
  };
  /** Linked inventory units to mark booked (used when a lead is won). */
  book_unit_ids?: string[];
}

export async function fetchOpenTaskLeadIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("tasks")
    .select("lead_id")
    .eq("is_done", false)
    .in("lead_id", ids);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.lead_id as string));
}

/**
 * The one place a lead's stage changes. Optionally records the close reason,
 * creates the next-step task, and books the linked unit. Stage history is
 * written by a database trigger, so every path is logged.
 */
export function useMoveLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MoveLeadsInput) => {
      const { ids, stage_id, close_reason, next_step, book_unit_ids } = input;
      if (ids.length === 0) return;

      const { error } = await supabase
        .from("leads")
        .update({ stage_id, close_reason: close_reason ?? null })
        .in("id", ids);
      if (error) throw error;

      if (next_step) {
        const skip = next_step.onlyIfNoOpenTask
          ? await fetchOpenTaskLeadIds(ids)
          : new Set<string>();
        const rows = ids
          .filter((id) => !skip.has(id))
          .map((lead_id) => ({
            lead_id,
            title: next_step.title,
            due_date: next_step.due_date,
            due_time: null,
          }));
        if (rows.length > 0) {
          const { error: taskError } = await supabase.from("tasks").insert(rows);
          if (taskError) throw taskError;
        }
      }

      if (book_unit_ids && book_unit_ids.length > 0) {
        const { error: unitError } = await supabase
          .from("inventory")
          .update({ status: "booked" })
          .in("id", book_unit_ids);
        if (unitError) throw unitError;
      }
    },
    onMutate: async ({ ids, stage_id, close_reason }) => {
      await queryClient.cancelQueries({ queryKey: leadsKey });
      const previous = queryClient.getQueryData<Lead[]>(leadsKey);
      if (previous) {
        const idSet = new Set(ids);
        queryClient.setQueryData<Lead[]>(
          leadsKey,
          previous.map((lead) =>
            idSet.has(lead.id)
              ? { ...lead, stage_id, close_reason: close_reason ?? null }
              : lead
          )
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(leadsKey, context.previous);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: qualifiedLeadsKey });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead_notes"] });
      if (vars.book_unit_ids?.length) {
        queryClient.invalidateQueries({ queryKey: inventoryKey });
      }
      for (const id of vars.ids) {
        queryClient.invalidateQueries({ queryKey: leadKey(id) });
      }
    },
  });
}
