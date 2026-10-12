import { randomUUID } from "node:crypto";
import type { Database, Json } from "@/types/database";
import type { InventoryStatus, PipelineStage, Project } from "@/types";

type LeadRowInsert = Database["public"]["Tables"]["leads"]["Insert"];
type UnitRowInsert = Database["public"]["Tables"]["inventory"]["Insert"];
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  appendSheetRows,
  readSheetTab,
  updateLeadStatusColumn,
  writeSheetCells,
  type SheetCellWrite,
} from "@/lib/googleSheets";
import {
  buildSheetTracking,
  canonicalFromAppLead,
  canonicalFromSheetRow,
  connectedInventoryTab,
  connectedLeadsTab,
  formatCanonicalFieldForSheet,
  formatCanonicalForSheet,
  formatInventoryForSheet,
  getSheetField,
  INVENTORY_SHEET_HEADERS,
  isBlankCanon,
  isRangedBudget,
  LEAD_CANONICAL_FIELDS,
  LEAD_FIELD_HEADERS,
  LEAD_FIELD_LABELS,
  LEAD_SHEET_HEADERS,
  mapConnectedInventoryRow,
  mapConnectedLeadRow,
  readSnapshot,
  resolveField,
  seedSheetSnapshot,
  type LeadCanonical,
  type LeadCanonicalField,
} from "@/lib/connectedSheetMapper";
import { assignSplitPhones, splitPhoneCell } from "@/lib/phoneNumbers";
import { normalizePhoneKey } from "@/lib/utils";

export type ConnectedSheetTab = "leads" | "inventory";

export interface LeadMergeStats {
  /** Leads updated from sheet edits. */
  appliedFromSheet: number;
  /** Sheet rows written from app edits. */
  writtenToSheet: number;
  /** Rows skipped outside the sheet grid. */
  skippedStale: number;
  /** Fields changed on both sides (app value kept). */
  conflicts: number;
  /** App-created leads appended as new sheet rows. */
  appended: number;
}

export interface TabSyncResult {
  created: number;
  repointed: number;
  warnings: string[];
  errors: string[];
  merge?: LeadMergeStats;
}

export interface WriteBackResult {
  synced: number;
  skipped: number;
  /** Rows skipped because the tracked sheet row no longer exists (deleted). */
  staleSkipped: number;
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
  name: string;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  source: string | null;
  stage_id: string | null;
  project_interest: string | null;
  acquired_date: string | null;
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
  /** Lead-column changes merged from the sheet (in addition to custom_data). */
  patch?: Partial<LeadRowInsert>;
}

/**
 * Apply one sheet-side canonical value to the app record. Returns false when
 * the value cannot be applied (unknown stage label), leaving the app record
 * and snapshot untouched.
 */
export function applySheetFieldToPatch(
  field: LeadCanonicalField,
  sheet: LeadCanonical,
  rawRow: Record<string, string>,
  appPhone: string,
  patch: Partial<LeadRowInsert>,
  merged: Record<string, unknown>,
  stages: PipelineStage[]
): boolean {
  const value = sheet[field];
  switch (field) {
    case "name":
      patch.name = value as string;
      return true;
    case "phone": {
      // Union sheet numbers with app-only numbers so manual additions in the
      // app survive a sheet-side phone edit.
      const appParts = appPhone.split(",").map((p) => p.trim()).filter(Boolean);
      const numbers = splitPhoneCell(getSheetField(rawRow, "Phone")).numbers;
      for (const part of appParts) {
        if (!numbers.includes(part)) numbers.push(part);
      }
      const assigned = assignSplitPhones(numbers.join(", "));
      patch.phone = assigned.primary;
      patch.alt_phone = assigned.alt;
      if (assigned.extras.length > 0) merged.additional_phones = assigned.extras;
      else delete merged.additional_phones;
      return true;
    }
    case "email":
      patch.email = value as string;
      return true;
    case "stage": {
      const stage = stages.find(
        (s) => s.label.toLowerCase() === String(value).toLowerCase()
      );
      if (!stage) return false;
      patch.stage_id = stage.id;
      return true;
    }
    case "source":
      patch.source = value as string;
      return true;
    case "leadType":
      merged.lead_type = value;
      return true;
    case "project":
      patch.project_interest = value as string;
      return true;
    case "budget": {
      merged.budget = value;
      const rawBudget = getSheetField(rawRow, "Budget");
      if (rawBudget && isRangedBudget(rawBudget)) merged.budget_raw = rawBudget;
      else delete merged.budget_raw;
      return true;
    }
    case "date":
      patch.acquired_date = value as string;
      return true;
    case "lastCall":
      merged.last_call_date = value;
      return true;
  }
}

interface ExistingUnit {
  id: string;
  project_id: string | null;
  unit_number: string;
  unit_type: string | null;
  area_sqft: number | null;
  price: number | null;
  status: InventoryStatus;
  acquired_date: string | null;
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
      supabase
        .from("leads")
        .select(
          "id, name, phone, alt_phone, email, source, stage_id, project_interest, acquired_date, custom_data"
        ),
      readSheetTab(tab),
    ]);
  if (stagesError) throw stagesError;
  if (existingError) throw existingError;

  const stagesList = (stages ?? []) as PipelineStage[];
  const nowIso = new Date().toISOString();
  const merge: LeadMergeStats = {
    appliedFromSheet: 0,
    writtenToSheet: 0,
    skippedStale: 0,
    conflicts: 0,
    appended: 0,
  };
  const cells: SheetCellWrite[] = [];
  const appliedLeadIds = new Set<string>();
  const repointedIds = new Set<string>();

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
  let skippedNonLeads = 0;

  for (const { sheetRow, row } of rows) {
    const mapped = mapConnectedLeadRow(row, {
      sheetRow,
      sheetId,
      sheetTab: tab,
      stages: stagesList,
    });
    if (mapped.skipped) {
      skippedNonLeads++;
      continue;
    }
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
      const customData = {
        ...((mapped.lead.custom_data ?? {}) as Record<string, unknown>),
      };
      const lead: LeadRowInsert = {
        ...mapped.lead,
        id,
        custom_data: customData as Json,
      };
      // New leads start fully synced: snapshot equals the imported values.
      customData.sheet_snapshot = canonicalFromAppLead(
        {
          name: lead.name,
          phone: lead.phone ?? null,
          alt_phone: lead.alt_phone ?? null,
          email: lead.email ?? null,
          source: lead.source ?? null,
          stage_id: lead.stage_id ?? null,
          project_interest: lead.project_interest ?? null,
          acquired_date: lead.acquired_date ?? null,
          custom_data: customData,
        },
        stagesList
      );
      customData.sheet_snapshot_at = nowIso;
      const ref: ExistingLead = {
        id,
        name: lead.name,
        phone: lead.phone ?? null,
        alt_phone: lead.alt_phone ?? null,
        email: lead.email ?? null,
        source: lead.source ?? null,
        stage_id: lead.stage_id ?? null,
        project_interest: lead.project_interest ?? null,
        acquired_date: lead.acquired_date ?? null,
        custom_data: lead.custom_data,
      };
      pending.set(id, { id, sheetRow, lead, note: mapped.note, ref });
      trackedByRow.set(sheetRow, id);
      if (phoneKey && !byPhone.has(phoneKey)) byPhone.set(phoneKey, ref);
      if (email && !byEmail.has(email)) byEmail.set(email, ref);
      continue;
    }

    // Re-point row tracking, then three-way merge the row against the app
    // record using the last-synced snapshot.
    const merged = mergeTracking(match.custom_data, buildSheetTracking(sheetId, tab, sheetRow));
    const unflushed = pending.get(match.id);
    if (unflushed) {
      unflushed.lead.custom_data = merged as Json;
      unflushed.ref.custom_data = merged;
      result.repointed++;
      continue;
    }
    repointedIds.add(match.id);

    const sheetCanon = canonicalFromSheetRow(row, stagesList);
    const appCanon = canonicalFromAppLead(match, stagesList);
    const stored = readSnapshot(match.custom_data);
    const seeded = !stored;
    const snapshot = stored ?? seedSheetSnapshot(sheetCanon, appCanon);
    const nextSnap: LeadCanonical = { ...snapshot };
    const patch: Partial<LeadRowInsert> = {};
    let patched = false;
    let cellsForLead = 0;

    for (const field of LEAD_CANONICAL_FIELDS) {
      const action = resolveField(snapshot[field], sheetCanon[field], appCanon[field]);
      if (action === "none") continue;
      if (action === "toApp") {
        // Blank sheet cells never wipe app values; unappliable values
        // (unknown stage labels) leave the record and snapshot untouched.
        if (isBlankCanon(sheetCanon[field])) continue;
        const applied = applySheetFieldToPatch(
          field,
          sheetCanon,
          row,
          appCanon.phone,
          patch,
          merged,
          stagesList
        );
        if (!applied) continue;
        patched = true;
        appliedLeadIds.add(match.id);
        nextSnap[field] = sheetCanon[field] as never;
        if (seeded) {
          result.warnings.push(
            `${tab} row ${sheetRow}: ${LEAD_FIELD_LABELS[field]} set from sheet ` +
              `("${appCanon[field] ?? ""}" → "${sheetCanon[field] ?? ""}")`
          );
        }
        continue;
      }
      // toSheet or conflict: an uninitialized app stage never wipes the sheet.
      if (field === "stage" && appCanon.stage == null) continue;
      cells.push({
        row: sheetRow,
        header: LEAD_FIELD_HEADERS[field],
        value: formatCanonicalFieldForSheet(field, appCanon),
      });
      cellsForLead++;
      if (field === "budget") delete merged.budget_raw;
      nextSnap[field] = appCanon[field] as never;
      if (action === "conflict") {
        merge.conflicts++;
        result.warnings.push(
          `${tab} row ${sheetRow}: ${LEAD_FIELD_LABELS[field]} changed on both sides, kept app value`
        );
      }
    }
    if (cellsForLead > 0 || patched || seeded) {
      merged.sheet_snapshot = nextSnap;
      merged.sheet_snapshot_at = nowIso;
    }
    repoints.push({
      id: match.id,
      sheetRow,
      customData: merged,
      patch: patched ? patch : undefined,
    });
  }

  if (skippedNonLeads > 0) {
    result.warnings.push(
      `${tab}: skipped ${skippedNonLeads} non-lead row(s) (headers/empty)`
    );
  }

  await mapWithConcurrency(repoints, WRITE_CONCURRENCY, async (repoint) => {
    const { error } = await supabase
      .from("leads")
      .update({ ...repoint.patch, custom_data: repoint.customData as Json })
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

  merge.appliedFromSheet = appliedLeadIds.size;

  try {
    const written = await writeSheetCells(tab, cells);
    merge.writtenToSheet = written.writtenRows;
    merge.skippedStale = written.skippedRows.length;
    if (written.skippedRows.length > 0) {
      result.warnings.push(
        `Skipped write-back for ${written.skippedRows.length} row(s) deleted from the sheet`
      );
    }
  } catch (err) {
    result.errors.push(
      `Write-back failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  try {
    const maxSheetRow = rows.reduce((max, r) => Math.max(max, r.sheetRow), 1);
    merge.appended = await appendUntrackedLeads(
      supabase,
      sheetId,
      tab,
      (existing ?? []) as ExistingLead[],
      repointedIds,
      stagesList,
      maxSheetRow + 1
    );
  } catch (err) {
    result.errors.push(
      `Sheet append failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  result.merge = merge;
  return result;
}

/**
 * Append app-created leads (never tracked to any sheet row) to the bottom of
 * the tab, then record their tracking + snapshot so the next sync merges
 * instead of duplicating. Leads already matched to a sheet row this run are
 * excluded via repointedIds.
 */
async function appendUntrackedLeads(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  sheetId: string,
  tab: string,
  existing: ExistingLead[],
  repointedIds: Set<string>,
  stages: PipelineStage[],
  startRow: number
): Promise<number> {
  const candidates = existing.filter((lead) => {
    const tracking = lead.custom_data as Record<string, unknown> | null;
    return tracking?.sheet_id == null && !repointedIds.has(lead.id);
  });
  if (candidates.length === 0) return 0;

  const rows = candidates.map((lead) => {
    const cells = formatCanonicalForSheet(canonicalFromAppLead(lead, stages));
    const raw = (lead.custom_data as Record<string, unknown> | null)?.budget_raw;
    if (typeof raw === "string" && raw) cells.Budget = raw;
    return LEAD_SHEET_HEADERS.map((header) => cells[header] ?? "");
  });
  await appendSheetRows(tab, startRow, rows);

  const syncedAt = new Date().toISOString();
  await mapWithConcurrency(candidates, WRITE_CONCURRENCY, async (lead, index) => {
    const custom = mergeTracking(
      lead.custom_data,
      buildSheetTracking(sheetId, tab, startRow + index)
    );
    custom.sheet_snapshot = canonicalFromAppLead(lead, stages);
    custom.sheet_snapshot_at = syncedAt;
    const { error } = await supabase
      .from("leads")
      .update({ custom_data: custom as Json })
      .eq("id", lead.id);
    if (error) throw new Error(error.message);
  });
  return candidates.length;
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
      supabase
        .from("inventory")
        .select(
          "id, project_id, unit_number, unit_type, area_sqft, price, status, acquired_date, custom_data"
        ),
      readSheetTab(tab),
    ]);
  if (projectsError) throw projectsError;
  if (existingError) throw existingError;

  const projectsList = (projects ?? []) as Project[];
  const merge: LeadMergeStats = {
    appliedFromSheet: 0,
    writtenToSheet: 0,
    skippedStale: 0,
    conflicts: 0,
    appended: 0,
  };
  const repointedIds = new Set<string>();

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
      projects: projectsList,
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
        unit_type: unit.unit_type ?? null,
        area_sqft: unit.area_sqft ?? null,
        price: unit.price ?? null,
        status: (unit.status ?? "available") as InventoryStatus,
        acquired_date: unit.acquired_date ?? null,
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
      repointedIds.add(match.id);
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

  try {
    const maxSheetRow = rows.reduce((max, r) => Math.max(max, r.sheetRow), 1);
    merge.appended = await appendUntrackedUnits(
      supabase,
      sheetId,
      tab,
      (existing ?? []) as ExistingUnit[],
      repointedIds,
      projectsList,
      maxSheetRow + 1
    );
  } catch (err) {
    result.errors.push(
      `Sheet append failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  result.merge = merge;
  return result;
}

/**
 * Append app-created units (never tracked to any sheet row) to the bottom of
 * the tab, then record their tracking so the next sync matches instead of
 * duplicating. Units already matched to a sheet row this run are excluded
 * via repointedIds.
 */
async function appendUntrackedUnits(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  sheetId: string,
  tab: string,
  existing: ExistingUnit[],
  repointedIds: Set<string>,
  projects: Project[],
  startRow: number
): Promise<number> {
  const candidates = existing.filter((unit) => {
    const tracking = unit.custom_data as Record<string, unknown> | null;
    return tracking?.sheet_id == null && !repointedIds.has(unit.id);
  });
  if (candidates.length === 0) return 0;

  const rows = candidates.map((unit) => {
    const cells = formatInventoryForSheet(unit, projects);
    return INVENTORY_SHEET_HEADERS.map((header) => cells[header] ?? "");
  });
  await appendSheetRows(tab, startRow, rows);

  await mapWithConcurrency(candidates, WRITE_CONCURRENCY, async (unit, index) => {
    const custom = mergeTracking(
      unit.custom_data,
      buildSheetTracking(sheetId, tab, startRow + index)
    );
    const { error } = await supabase
      .from("inventory")
      .update({ custom_data: custom as Json })
      .eq("id", unit.id);
    if (error) throw new Error(error.message);
  });
  return candidates.length;
}

interface TrackedUnit {
  id: string;
  status: InventoryStatus;
  custom_data: Record<string, unknown> | null;
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
    const { updated, skippedRows } = await updateLeadStatusColumn(
      updates.map(({ row, status }) => ({ row, status })),
      { sheetName: tab, statusColumn: "Status" }
    );
    const skippedSet = new Set(skippedRows);
    const written = updates.filter((update) => !skippedSet.has(update.row));
    const syncedAt = new Date().toISOString();
    await mapWithConcurrency(written, WRITE_CONCURRENCY, async ({ unitId }) => {
      const unit = (units as TrackedUnit[]).find((u) => u.id === unitId);
      await supabase
        .from("inventory")
        .update({ custom_data: { ...(unit?.custom_data ?? {}), sheet_status_synced_at: syncedAt } as Json })
        .eq("id", unitId);
    });
    return { synced: updated, skipped: skipped + skippedRows.length, staleSkipped: skippedRows.length };
  }

  return { synced: 0, skipped, staleSkipped: 0 };
}

export async function runConnectedSheetSync(
  tabs: ConnectedSheetTab[] = ["leads", "inventory"]
): Promise<ConnectedSheetSyncResult> {
  const result: ConnectedSheetSyncResult = {
    leads: emptyTabResult(),
    inventory: emptyTabResult(),
    writeBack: {
      leads: { synced: 0, skipped: 0, staleSkipped: 0 },
      inventory: { synced: 0, skipped: 0, staleSkipped: 0 },
    },
  };

  if (tabs.includes("leads")) {
    try {
      result.leads = await syncLeadsFromSheet();
      // The leads merge writes app edits to the sheet inline (replacing the
      // old stage-only write-back), so stats come straight from the merge.
      const merge = result.leads.merge;
      result.writeBack.leads = {
        synced: merge?.writtenToSheet ?? 0,
        skipped: 0,
        staleSkipped: merge?.skippedStale ?? 0,
      };
    } catch (err) {
      result.leads.errors.push(err instanceof Error ? err.message : "Leads sync failed");
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
      if (result.writeBack.inventory.staleSkipped > 0) {
        result.inventory.warnings.push(
          `Skipped write-back for ${result.writeBack.inventory.staleSkipped} row(s) deleted from the sheet`
        );
      }
    } catch (err) {
      result.inventory.errors.push(
        `Write-back failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  return result;
}
