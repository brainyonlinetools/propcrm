import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { WhatsAppTemplate } from "@/types";

export const whatsappTemplatesKey = ["whatsapp_templates"] as const;

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: whatsappTemplatesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });
}

export function useCreateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: Pick<WhatsAppTemplate, "name" | "body">) => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKey });
    },
  });
}

export function useUpdateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Pick<WhatsAppTemplate, "name" | "body" | "sort_order">> & { id: string }) => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKey });
    },
  });
}

export function useDeleteWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKey });
    },
  });
}
