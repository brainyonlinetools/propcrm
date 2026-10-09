import type { Json } from "@/types/database";
import type { InventoryStatus, PipelineStage, Project } from "@/types";
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

interface ExistingUnit {
  id: string;
  project_id: string | null;
  unit_number: string;
  custom_data: unknown;
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

    const phoneKey = normalizePhoneKey(mapped.lead.phone);
    const email = mapped.lead.email?.toLowerCase() ?? null;
    const match =
      (phoneKey ? byPhone.get(phoneKey) : undefined) ??
      (email ? byEmail.get(email) : undefined) ??
      null;

    if (!match) {
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...mapped.lead, custom_data: (mapped.lead.custom_data ?? {}) as Json })
        .select("id")
        .single();
      if (error) {
        result.errors.push(`${tab} row ${sheetRow}: ${error.message}`);
        continue;
      }
      if (mapped.note) {
        await supabase
          .from("lead_notes")
          .insert({ lead_id: data.id, content: mapped.note, note_type: "note" });
      }
      result.created++;
      const created: ExistingLead = { id: data.id, phone: mapped.lead.phone ?? null, email: mapped.lead.email ?? null, custom_data: mapped.lead.custom_data };
      if (phoneKey && !byPhone.has(phoneKey)) byPhone.set(phoneKey, created);
      if (email && !byEmail.has(email)) byEmail.set(email, created);
      continue;
    }

    // Re-point row tracking only; never overwrite CRM edits from the sheet.
    const merged = mergeTracking(match.custom_data, buildSheetTracking(sheetId, tab, sheetRow));
    const { error } = await supabase
      .from("leads")
      .update({ custom_data: merged as Json })
      .eq("id", match.id);
    if (error) {
      result.errors.push(`${tab} row ${sheetRow}: ${error.message}`);
    } else {
      result.repointed++;
    }
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
      const { data, error } = await supabase
        .from("inventory")
        .insert({ ...mapped.unit, custom_data: (mapped.unit.custom_data ?? {}) as Json })
        .select("id")
        .single();
      if (error) {
        result.errors.push(`${tab} row ${sheetRow}: ${error.message}`);
        continue;
      }
      if (mapped.note) {
        await supabase
          .from("inventory_notes")
          .insert({ inventory_id: data.id, content: mapped.note, note_type: "note" });
      }
      result.created++;
      byUnit.set(key, {
        id: data.id,
        project_id: mapped.unit.project_id ?? null,
        unit_number: mapped.unit.unit_number,
        custom_data: mapped.unit.custom_data,
      });
      continue;
    }

    const merged = mergeTracking(match.custom_data, buildSheetTracking(sheetId, tab, sheetRow));
    const { error } = await supabase
      .from("inventory")
      .update({ custom_data: merged as Json })
      .eq("id", match.id);
    if (error) {
      result.errors.push(`${tab} row ${sheetRow}: ${error.message}`);
    } else {
      result.repointed++;
    }
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
    for (const { leadId } of updates) {
      const lead = (leads as TrackedLead[]).find((l) => l.id === leadId);
      await supabase
        .from("leads")
        .update({ custom_data: { ...(lead?.custom_data ?? {}), sheet_status_synced_at: syncedAt } as Json })
        .eq("id", leadId);
    }
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
    for (const { unitId } of updates) {
      const unit = (units as TrackedUnit[]).find((u) => u.id === unitId);
      await supabase
        .from("inventory")
        .update({ custom_data: { ...(unit?.custom_data ?? {}), sheet_status_synced_at: syncedAt } as Json })
        .eq("id", unitId);
    }
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
