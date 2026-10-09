import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { CallOutcome, Seller, SellerInsert, SellerNote } from "@/types";
import { CALL_OUTCOME_LABELS } from "@/types";
import { normalizePhoneKey } from "@/lib/utils";
import {
  mapSellerToInventoryInput,
  mapSellerToInventorySync,
} from "@/lib/sellerImport";
import { inventoryKey } from "./inventory";

export const sellersKey = ["sellers"] as const;
export const sellerKey = (id: string) => ["sellers", id] as const;
export const sellerNotesKey = (sellerId: string) =>
  ["seller_notes", sellerId] as const;

export type InventorySyncAction = "created" | "updated" | "marked_sold" | "none";

export interface SellerSaveResult {
  seller: Seller;
  inventoryAction: InventorySyncAction;
  warning?: string;
}

function normalizeSellerRow(row: Seller): Seller {
  return { ...row };
}

/** Keys the seller owns inside a linked unit's custom_data. */
const SELLER_MANAGED_CUSTOM_KEYS = ["tower", "floor", "facing", "car_parking"];

async function syncLinkedInventory(
  seller: Seller,
  mode: "ensure" | "retire",
  reactivate: boolean
): Promise<{ action: InventorySyncAction; warning?: string }> {
  const { data: linked, error: linkedError } = await supabase
    .from("inventory")
    .select("id, custom_data")
    .eq("seller_id", seller.id)
    .maybeSingle();
  if (linkedError) throw linkedError;

  if (mode === "retire") {
    if (!linked) return { action: "none" };
    const { error } = await supabase
      .from("inventory")
      .update({ status: "sold" })
      .eq("id", linked.id);
    if (error) throw error;
    return { action: "marked_sold" };
  }

  const mapped = mapSellerToInventoryInput(seller, seller.id);
  if (!mapped.inventory) return { action: "none", warning: mapped.error };

  if (!linked) {
    const { error } = await supabase.from("inventory").insert({
      ...mapped.inventory,
      custom_data: (mapped.inventory.custom_data ?? {}) as Json,
    });
    if (error) throw error;
    return { action: "created" };
  }

  const sync = mapSellerToInventorySync(seller);
  const existingCustom =
    (linked.custom_data as Record<string, unknown> | null) ?? {};
  const merged: Record<string, unknown> = { ...existingCustom };
  for (const key of SELLER_MANAGED_CUSTOM_KEYS) delete merged[key];
  Object.assign(merged, sync.custom_data);

  const { error } = await supabase
    .from("inventory")
    .update({
      project_id: sync.project_id,
      unit_number: sync.unit_number,
      unit_type: sync.unit_type,
      area_sqft: sync.area_sqft,
      price: sync.price,
      custom_data: merged as Json,
      ...(reactivate ? { status: "available" } : {}),
    })
    .eq("id", linked.id);
  if (error) throw error;
  return { action: "updated" };
}

function sellerMatchKey(
  projectId: string | null | undefined,
  unitNumber: string | null | undefined,
  phone: string | null | undefined
): string | null {
  const unit = unitNumber?.trim().toLowerCase();
  if (unit) return `${projectId ?? ""}|u:${unit}`;
  const phoneKey = normalizePhoneKey(phone);
  if (phoneKey) return `${projectId ?? ""}|p:${phoneKey}`;
  return null;
}

async function fetchSellerRow(id: string): Promise<Seller> {
  const { data, error } = await supabase
    .from("sellers")
    .select("*, projects(id, name, location)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeSellerRow(data as Seller);
}

export function useSellers() {
  return useQuery({
    queryKey: sellersKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("*, projects(id, name, location)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Seller[]).map(normalizeSellerRow);
    },
  });
}

export function useSeller(id: string) {
  return useQuery({
    queryKey: sellerKey(id),
    queryFn: () => fetchSellerRow(id),
    enabled: Boolean(id),
  });
}

export function useSellerNotes(sellerId: string) {
  return useQuery({
    queryKey: sellerNotesKey(sellerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_notes")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SellerNote[];
    },
    enabled: Boolean(sellerId),
  });
}

export function useCreateSellerNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      seller_id,
      content,
      note_type = "note",
    }: {
      seller_id: string;
      content: string;
      note_type?: SellerNote["note_type"];
    }) => {
      const { data, error } = await supabase
        .from("seller_notes")
        .insert({ seller_id, content, note_type })
        .select()
        .single();
      if (error) throw error;
      return data as SellerNote;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: sellerNotesKey(note.seller_id) });
      queryClient.invalidateQueries({ queryKey: sellersKey });
    },
  });
}

export function useLogSellerCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      seller_id,
      outcome,
      note,
      follow_up_date,
    }: {
      seller_id: string;
      outcome: CallOutcome;
      note?: string;
      follow_up_date?: string | null;
    }) => {
      const content = note?.trim() || `Call: ${CALL_OUTCOME_LABELS[outcome]}`;
      const { error: noteError } = await supabase.from("seller_notes").insert({
        seller_id,
        content,
        note_type: "call",
      });
      if (noteError) throw noteError;

      const { error: sellerError } = await supabase
        .from("sellers")
        .update({
          last_call_outcome: outcome,
          last_called_at: new Date().toISOString(),
          ...(outcome === "callback" && follow_up_date ? { follow_up_date } : {}),
        })
        .eq("id", seller_id);
      if (sellerError) throw sellerError;
      return fetchSellerRow(seller_id);
    },
    onSuccess: (seller) => {
      queryClient.invalidateQueries({ queryKey: sellerNotesKey(seller.id) });
      queryClient.invalidateQueries({ queryKey: sellersKey });
      queryClient.invalidateQueries({ queryKey: sellerKey(seller.id) });
    },
  });
}

export function useCreateSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (seller: SellerInsert): Promise<SellerSaveResult> => {
      const { data, error } = await supabase
        .from("sellers")
        .insert(seller)
        .select()
        .single();
      if (error) throw error;
      const created = normalizeSellerRow(data as Seller);

      if (!created.available_for_sale) {
        return { seller: created, inventoryAction: "none" };
      }
      const sync = await syncLinkedInventory(created, "ensure", true);
      return {
        seller: created,
        inventoryAction: sync.action,
        warning: sync.warning,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellersKey });
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}

export interface BulkUpsertSellersResult {
  created: number;
  updated: number;
  inventorySynced: number;
  warnings: string[];
}

export function useBulkUpsertSellers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: SellerInsert[]): Promise<BulkUpsertSellersResult> => {
      const { data: existing, error: existingError } = await supabase
        .from("sellers")
        .select("id, project_id, unit_number, contact_phone, available_for_sale");
      if (existingError) throw existingError;

      const byKey = new Map<string, (typeof existing)[number]>();
      for (const row of existing ?? []) {
        const key = sellerMatchKey(row.project_id, row.unit_number, row.contact_phone);
        if (key && !byKey.has(key)) byKey.set(key, row);
      }

      let created = 0;
      let updated = 0;
      let inventorySynced = 0;
      const warnings: string[] = [];

      for (const item of items) {
        const key = sellerMatchKey(item.project_id, item.unit_number, item.contact_phone);
        const match = key ? byKey.get(key) : undefined;

        if (!match) {
          const { data, error } = await supabase
            .from("sellers")
            .insert(item)
            .select()
            .single();
          if (error) throw error;
          created++;
          const row = normalizeSellerRow(data as Seller);
          if (row.available_for_sale) {
            const sync = await syncLinkedInventory(row, "ensure", true);
            if (sync.action !== "none") inventorySynced++;
            if (sync.warning) warnings.push(`${row.owner_name}: ${sync.warning}`);
          }
          const newKey = sellerMatchKey(row.project_id, row.unit_number, row.contact_phone);
          if (newKey) byKey.set(newKey, row);
          continue;
        }

        const wasAvailable = match.available_for_sale ?? false;
        const { data, error } = await supabase
          .from("sellers")
          .update(item)
          .eq("id", match.id)
          .select()
          .single();
        if (error) throw error;
        updated++;
        const row = normalizeSellerRow(data as Seller);
        if (row.available_for_sale) {
          const sync = await syncLinkedInventory(row, "ensure", !wasAvailable);
          if (sync.action !== "none") inventorySynced++;
          if (sync.warning) warnings.push(`${row.owner_name}: ${sync.warning}`);
        } else if (wasAvailable) {
          const sync = await syncLinkedInventory(row, "retire", false);
          if (sync.action !== "none") inventorySynced++;
        }
        match.available_for_sale = row.available_for_sale;
      }

      return { created, updated, inventorySynced, warnings };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellersKey });
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}

export function useUpdateSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<SellerInsert> & { id: string }): Promise<SellerSaveResult> => {
      const before = await fetchSellerRow(id);

      const { data, error } = await supabase
        .from("sellers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const seller = normalizeSellerRow(data as Seller);

      const turnedOn = !before.available_for_sale && seller.available_for_sale;
      const turnedOff = before.available_for_sale && !seller.available_for_sale;

      if (turnedOff) {
        const sync = await syncLinkedInventory(seller, "retire", false);
        return { seller, inventoryAction: sync.action };
      }
      if (seller.available_for_sale) {
        const sync = await syncLinkedInventory(seller, "ensure", turnedOn);
        return {
          seller,
          inventoryAction: sync.action,
          warning: sync.warning,
        };
      }
      return { seller, inventoryAction: "none" };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: sellersKey });
      queryClient.invalidateQueries({ queryKey: sellerKey(result.seller.id) });
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
  });
}

export function useDeleteSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Linked inventory units are unlinked (seller_id → null) by FK and kept.
      const { error } = await supabase.from("sellers").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: sellersKey });
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.removeQueries({ queryKey: sellerKey(id) });
    },
  });
}
