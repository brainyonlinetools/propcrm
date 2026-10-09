import { randomUUID } from "node:crypto";
import type { Database, Json } from "@/types/database";
import type { InventoryStatus, PipelineStage, Project } from "@/types";

type LeadRowInsert = Database["public"]["Tables"]["leads"]["Insert"];
type UnitRowInsert = Database["public"]["Tables"]["inventory"]["Insert"];
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { readSheetTab, updateLeadStatusColumn } from "@/lib/googleSheets";
import {
  buildSheetTracking,
  connectedInventoryTab,
  connectedLeadsTab,
  mapConnectedInventoryRow,
  mapConnectedLeadRow,
} from "@/lib/connectedSheetMapper";
import { normalizePhoneKey } from "@/lib/utils";

export type ConnectedSheetTab = "leads" | "inventory";

export interface TabSyncResult {
  created: number;
  repointed: number;
  warnings: string[];
  errors: string[];
}

export interface WriteBackResult {
  synced: number;
  skipped: number;
}

export interface ConnectedSheetSyncResult {
  leads: TabSyncResult;
  inventory: TabSyncResult;
  writeBack: { leads: WriteBackResult; inventory: WriteBackResult };
}

function emptyTabResult(): TabSyncResult {
  return { created: 0, repointed: 0, warnings: [], errors: [] };
}

// Bulk sheets (1000+ rows) exceed serverless timeouts with one round-trip
// per row, so creates go out in chunks and per-row writes run concurrently.
const INSERT_CHUNK_SIZE = 500;
const WRITE_CONCURRENCY = 10;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface FallbackFailure<T> {
  item: T;
  message: string;
}

/**
 * Insert in chunks for speed; when a chunk fails, retry it row by row so
 * one bad row can't sink the whole chunk.
 */
export async function insertWithFallback<T>(
  items: T[],
  chunkSize: number,
  insertChunk: (chunk: T[]) => Promise<void>,
  insertSingle: (item: T) => Promise<void>
): Promise<{ succeeded: T[]; failed: FallbackFailure<T>[] }> {
  const succeeded: T[] = [];
  const failed: FallbackFailure<T>[] = [];
  for (const chunk of chunkArray(items, chunkSize)) {
    try {
      await insertChunk(chunk);
      succeeded.push(...chunk);
    } catch {
      for (const item of chunk) {
        try {
          await insertSingle(item);
          succeeded.push(item);
        } catch (err) {
          failed.push({
            item,
            message: err instanceof Error ? err.message : "Insert failed",
          });
        }
      }
    }
  }
  return { succeeded, failed };
}

/**
 * Index already-imported sheet rows by row number for one sheet/tab.
 * Used so rows without any contact info (which can never match by
 * phone/email) still re-sync idempotently instead of duplicating.
 */
export function buildTrackedRowMap(
  existing: { id: string; custom_data: unknown }[],
  sheetId: string,
  sheetTab: string
): Map<number, string> {
  const map = new Map<number, string>();
  for (const lead of existing) {
    const tracking = lead.custom_data as Record<string, unknown> | null;
    const row = tracking?.sheet_row;
    if (
      tracking?.sheet_id === sheetId &&
      tracking?.sheet_tab === sheetTab &&
      typeof row === "number" &&
      !map.has(row)
    ) {
      map.set(row, lead.id);
    }
  }
  return map;
}

/** Run per-row writes with bounded parallelism. */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  const workers = Math.max(1, Math.min(limit, items.length));
  let next = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < items.length) {
        const index = next++;
        await fn(items[index], index);
      }
    })
  );
}

function mergeTracking(existing: unknown, tracking: Record<string, unknown>) {
  const base =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...tracking };
}

interface ExistingLead {
  id: string;
  phone: string | null;
  email: string | null;
  custom_data: unknown;
}

interface PendingLeadCreate {
  id: string;
  sheetRow: number;
  lead: LeadRowInsert;
  note: string | null;
  ref: ExistingLead;
}

interface RepointUpdate {
  id: string;
  sheetRow: number;
  customData: Record<string, unknown>;
}

interface ExistingUnit {
  id: string;
  project_id: string | null;
  unit_number: string;
  custom_data: unknown;
}

interface PendingUnitCreate {
  id: string;
  sheetRow: number;
  unit: UnitRowInsert;
  note: string | null;
  ref: ExistingUnit;
}

function unitMatchKey(projectId: string | null | undefined, unitNumber: string | null | undefined) {
  return `${projectId ?? ""}|${(unitNumber ?? "").trim().toLowerCase()}`;
}

export async function syncLeadsFromSheet(): Promise<TabSyncResult> {
  const result = emptyTabResult();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID");
  const tab = connectedLeadsTab();
  const supabase = createSupabaseAdmin();

  const [{ data: stages, error: stagesError }, { data: existing, error: existingError }, rows] =
    await Promise.all([
      supabase.from("pipeline_stages").select("id, label, color, sort_order").order("sort_order"),
      supabase.from("leads").select("id, phone, email, custom_data"),
      readSheetTab(tab),
    ]);
  if (stagesError) throw stagesError;
  if (existingError) throw existingError;

  const byPhone = new Map<string, ExistingLead>();
  const byEmail = new Map<string, ExistingLead>();
  for (const lead of (existing ?? []) as ExistingLead[]) {
    const phoneKey = normalizePhoneKey(lead.phone);
    if (phoneKey && !byPhone.has(phoneKey)) byPhone.set(phoneKey, lead);
    const email = lead.email?.toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, lead);
  }

  const pending = new Map<string, PendingLeadCreate>();
  const repoints: RepointUpdate[] = [];
  const trackedByRow = buildTrackedRowMap((existing ?? []) as ExistingLead[], sheetId, tab);

  for (const { sheetRow, row } of rows) {
    const mapped = mapConnectedLeadRow(row, {
      sheetRow,
      sheetId,
      sheetTab: tab,
      stages: (stages ?? []) as PipelineStage[],
    });
    if (!mapped.lead) {
      result.errors.push(`${tab} row ${sheetRow}: ${mapped.error}`);
      continue;
    }
    for (const warning of mapped.warnings) {
      result.warnings.push(`${tab} row ${sheetRow}: ${warning}`);
    }

    if (!mapped.lead.phone && !mapped.lead.email && trackedByRow.has(sheetRow)) {
      result.repointed++;
      continue;
    }

    const phoneKey = normalizePhoneKey(mapped.lead.phone);
    const email = mapped.lead.email?.toLowerCase() ?? null;
    const match =
      (phoneKey ? byPhone.get(phoneKey) : undefined) ??
      (email ? byEmail.get(email) : undefined) ??
      null;

    if (!match) {
      // Client-generated id so later rows can match this lead (and its
      // notes can reference it) before the chunk is flushed.
      const id = randomUUID();
      const lead: LeadRowInsert = {
        ...mapped.lead,
        id,
        custom_data: (mapped.lead.custom_data ?? {}) as Json,
      };
      const ref: ExistingLead = {
        id,
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        custom_data: lead.custom_data,
      };
      pending.set(id, { id, sheetRow, lead, note: mapped.note, ref });
      trackedByRow.set(sheetRow, id);
      if (phoneKey && !byPhone.has(phoneKey)) byPhone.set(phoneKey, ref);
      if (email && !byEmail.has(email)) byEmail.set(email, ref);
      continue;
    }

    // Re-point row tracking only; never overwrite CRM edits from the sheet.
    const merged = mergeTracking(match.custom_data, buildSheetTracking(sheetId, tab, sheetRow));
    const unflushed = pending.get(match.id);
    if (unflushed) {
      unflushed.lead.custom_data = merged as Json;
      unflushed.ref.custom_data = merged;
      result.repointed++;
    } else {
      repoints.push({ id: match.id, sheetRow, customData: merged });
    }
  }

  await mapWithConcurrency(repoints, WRITE_CONCURRENCY, async (repoint) => {
    const { error } = await supabase
      .from("leads")
      .update({ custom_data: repoint.customData as Json })
      .eq("id", repoint.id);
    if (error) {
      result.errors.push(`${tab} row ${repoint.sheetRow}: ${error.message}`);
    } else {
      result.repointed++;
    }
  });

  const { succeeded, failed } = await insertWithFallback(
    [...pending.values()],
    INSERT_CHUNK_SIZE,
    async (chunk) => {
      const { error } = await supabase.from("leads").insert(chunk.map((c) => c.lead));
      if (error) throw new Error(error.message);
    },
    async (item) => {
      const { error } = await supabase.from("leads").insert(item.lead);
      if (error) throw new Error(error.message);
    }
  );
  result.created += succeeded.length;
  for (const failure of failed) {
    result.errors.push(`${tab} row ${failure.item.sheetRow}: ${failure.message}`);
  }

  const notes = succeeded.flatMap((c) =>
    c.note ? [{ lead_id: c.id, content: c.note, note_type: "note" as const }] : []
  );
  if (notes.length > 0) {
    await supabase.from("lead_notes").insert(notes);
  }

  return result;
}

export async function syncInventoryFromSheet(): Promise<TabSyncResult> {
  const result = emptyTabResult();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID");
  const tab = connectedInventoryTab();
  const supabase = createSupabaseAdmin();

  const [{ data: projects, error: projectsError }, { data: existing, error: existingError }, rows] =
    await Promise.all([
      supabase.from("projects").select("id, name"),
      supabase.from("inventory").select("id, project_id, unit_number, custom_data"),
      readSheetTab(tab),
    ]);
  if (projectsError) throw projectsError;
  if (existingError) throw existingError;

  const byUnit = new Map<string, ExistingUnit>();
  for (const unit of (existing ?? []) as ExistingUnit[]) {
    const key = unitMatchKey(unit.project_id, unit.unit_number);
    if (!byUnit.has(key)) byUnit.set(key, unit);
  }

  const pending = new Map<string, PendingUnitCreate>();
  const repoints: RepointUpdate[] = [];

  for (const { sheetRow, row } of rows) {
    const mapped = mapConnectedInventoryRow(row, {
      sheetRow,
      sheetId,
      sheetTab: tab,
      projects: (projects ?? []) as Project[],
    });
    if (!mapped.unit) {
      result.errors.push(`${tab} row ${sheetRow}: ${mapped.error}`);
      continue;
    }
    for (const warning of mapped.warnings) {
      result.warnings.push(`${tab} row ${sheetRow}: ${warning}`);
    }

    const key = unitMatchKey(mapped.unit.project_id, mapped.unit.unit_number);
    const match = byUnit.get(key) ?? null;

    if (!match) {
      const id = randomUUID();
      const unit: UnitRowInsert = {
        ...mapped.unit,
        id,
        custom_data: (mapped.unit.custom_data ?? {}) as Json,
      };
      const ref: ExistingUnit = {
        id,
        project_id: unit.project_id ?? null,
        unit_number: unit.unit_number,
        custom_data: unit.custom_data,
      };
      pending.set(id, { id, sheetRow, unit, note: mapped.note, ref });
      byUnit.set(key, ref);
      continue;
    }

    const merged = mergeTracking(match.custom_data, buildSheetTracking(sheetId, tab, sheetRow));
    const unflushed = pending.get(match.id);
    if (unflushed) {
      unflushed.unit.custom_data = merged as Json;
      unflushed.ref.custom_data = merged;
      result.repointed++;
    } else {
      repoints.push({ id: match.id, sheetRow, customData: merged });
    }
  }

  await mapWithConcurrency(repoints, WRITE_CONCURRENCY, async (repoint) => {
    const { error } = await supabase
      .from("inventory")
      .update({ custom_data: repoint.customData as Json })
      .eq("id", repoint.id);
    if (error) {
      result.errors.push(`${tab} row ${repoint.sheetRow}: ${error.message}`);
    } else {
      result.repointed++;
    }
  });

  const { succeeded, failed } = await insertWithFallback(
    [...pending.values()],
    INSERT_CHUNK_SIZE,
    async (chunk) => {
      const { error } = await supabase.from("inventory").insert(chunk.map((c) => c.unit));
      if (error) throw new Error(error.message);
    },
    async (item) => {
      const { error } = await supabase.from("inventory").insert(item.unit);
      if (error) throw new Error(error.message);
    }
  );
  result.created += succeeded.length;
  for (const failure of failed) {
    result.errors.push(`${tab} row ${failure.item.sheetRow}: ${failure.message}`);
  }

  const notes = succeeded.flatMap((c) =>
    c.note ? [{ inventory_id: c.id, content: c.note, note_type: "note" as const }] : []
  );
  if (notes.length > 0) {
    await supabase.from("inventory_notes").insert(notes);
  }

  return result;
}

interface TrackedLead {
  id: string;
  custom_data: Record<string, unknown> | null;
  pipeline_stages: { label: string } | null;
}

interface TrackedUnit {
  id: string;
  status: InventoryStatus;
  custom_data: Record<string, unknown> | null;
}

async function writeBackLeadStages(): Promise<WriteBackResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID ?? "";
  const tab = connectedLeadsTab();
  const supabase = createSupabaseAdmin();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, custom_data, pipeline_stages(label)")
    .filter("custom_data->>imported_from_sheet", "eq", "true")
    .filter("custom_data->>sheet_id", "eq", sheetId)
    .filter("custom_data->>sheet_tab", "eq", tab);
  if (error) throw error;

  const updates: { row: number; status: string; leadId: string }[] = [];
  let skipped = 0;
  for (const lead of (leads ?? []) as TrackedLead[]) {
    const customData = lead.custom_data ?? {};
    const sheetRow = customData.sheet_row;
    const stageLabel = lead.pipeline_stages?.label;
    if (typeof sheetRow !== "number" || !stageLabel) {
      skipped++;
      continue;
    }
    updates.push({ row: sheetRow, status: stageLabel, leadId: lead.id });
  }

  if (updates.length > 0) {
    await updateLeadStatusColumn(
      updates.map(({ row, status }) => ({ row, status })),
      { sheetName: tab, statusColumn: "Stage" }
    );
    const syncedAt = new Date().toISOString();
    await mapWithConcurrency(updates, WRITE_CONCURRENCY, async ({ leadId }) => {
      const lead = (leads as TrackedLead[]).find((l) => l.id === leadId);
      await supabase
        .from("leads")
        .update({ custom_data: { ...(lead?.custom_data ?? {}), sheet_status_synced_at: syncedAt } as Json })
        .eq("id", leadId);
    });
  }

  return { synced: updates.length, skipped };
}

async function writeBackInventoryStatuses(): Promise<WriteBackResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID ?? "";
  const tab = connectedInventoryTab();
  const supabase = createSupabaseAdmin();

  const { data: units, error } = await supabase
    .from("inventory")
    .select("id, status, custom_data")
    .filter("custom_data->>imported_from_sheet", "eq", "true")
    .filter("custom_data->>sheet_id", "eq", sheetId)
    .filter("custom_data->>sheet_tab", "eq", tab);
  if (error) throw error;

  const updates: { row: number; status: string; unitId: string }[] = [];
  let skipped = 0;
  for (const unit of (units ?? []) as TrackedUnit[]) {
    const sheetRow = unit.custom_data?.sheet_row;
    if (typeof sheetRow !== "number" || !unit.status) {
      skipped++;
      continue;
    }
    updates.push({ row: sheetRow, status: unit.status, unitId: unit.id });
  }

  if (updates.length > 0) {
    await updateLeadStatusColumn(
      updates.map(({ row, status }) => ({ row, status })),
      { sheetName: tab, statusColumn: "Status" }
    );
    const syncedAt = new Date().toISOString();
    await mapWithConcurrency(updates, WRITE_CONCURRENCY, async ({ unitId }) => {
      const unit = (units as TrackedUnit[]).find((u) => u.id === unitId);
      await supabase
        .from("inventory")
        .update({ custom_data: { ...(unit?.custom_data ?? {}), sheet_status_synced_at: syncedAt } as Json })
        .eq("id", unitId);
    });
  }

  return { synced: updates.length, skipped };
}

export async function runConnectedSheetSync(
  tabs: ConnectedSheetTab[] = ["leads", "inventory"]
): Promise<ConnectedSheetSyncResult> {
  const result: ConnectedSheetSyncResult = {
    leads: emptyTabResult(),
    inventory: emptyTabResult(),
    writeBack: { leads: { synced: 0, skipped: 0 }, inventory: { synced: 0, skipped: 0 } },
  };

  if (tabs.includes("leads")) {
    try {
      result.leads = await syncLeadsFromSheet();
    } catch (err) {
      result.leads.errors.push(err instanceof Error ? err.message : "Leads sync failed");
    }
    try {
      result.writeBack.leads = await writeBackLeadStages();
    } catch (err) {
      result.leads.errors.push(
        `Write-back failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  if (tabs.includes("inventory")) {
    try {
      result.inventory = await syncInventoryFromSheet();
    } catch (err) {
      result.inventory.errors.push(err instanceof Error ? err.message : "Inventory sync failed");
    }
    try {
      result.writeBack.inventory = await writeBackInventoryStatuses();
    } catch (err) {
      result.inventory.errors.push(
        `Write-back failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  return result;
}
