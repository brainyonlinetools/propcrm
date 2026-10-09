"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckSquare, LayoutGrid, List, PhoneCall, Plus, RefreshCw, Search, Upload, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadCard } from "@/components/leads/LeadCard";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { LeadKanban } from "@/components/leads/LeadKanban";
import { LeadForm } from "@/components/leads/LeadForm";
import { BatchStageChangeSheet } from "@/components/leads/BatchStageChangeSheet";
import { BatchWhatsAppSheet } from "@/components/leads/BatchWhatsAppSheet";
import { BulkImportSheet } from "@/components/shared/BulkImportSheet";
import { CollapsibleFilterSection } from "@/components/shared/CollapsibleFilterSection";
import { ContactListRow } from "@/components/shared/ContactListRow";
import {
  DetailEmptyState,
  MasterDetailLayout,
} from "@/components/shared/MasterDetailLayout";
import { StageBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { CallQueueSheet, type CallQueueContact } from "@/components/shared/CallQueueSheet";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { leadsKey, useLeads } from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { useCreateLeadNote, useCreateTask } from "@/lib/queries/tasks";
import { describeTabSync, triggerSheetSync } from "@/lib/sheetSyncClient";
import { cn, formatDisplayDate, formatPhone, formatRelativeDate } from "@/lib/utils";
import {
  CALL_OUTCOME_LABELS,
  DISQUALIFIED_STAGE_LABEL,
  isArchivedLead,
  type CallOutcome,
} from "@/types";

type ViewMode = "list" | "kanban";
type LeadViewFilter = "active" | "archived";
type LeadTab = "raw" | "pipeline";

export default function LeadsPage() {
  const isDesktop = useIsDesktop();
  const [leadTab, setLeadTab] = useState<LeadTab>("raw");
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<LeadViewFilter>("active");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [stageChangeOpen, setStageChangeOpen] = useState(false);
  const [callQueueOpen, setCallQueueOpen] = useState(false);
  const [callQueue, setCallQueue] = useState<CallQueueContact[]>([]);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const createLeadNote = useCreateLeadNote();
  const createTask = useCreateTask();

  const { data: leads = [], isLoading, isError } = useLeads();
  const { data: stages = [] } = usePipelineStages();

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order),
    [stages]
  );
  const rawStageId = sortedStages[0]?.id ?? null;

  const rawLeads = useMemo(
    () => leads.filter((lead) => lead.stage_id === rawStageId || lead.stage_id == null),
    [leads, rawStageId]
  );

  const pipelineLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (lead.stage_id == null || lead.stage_id === rawStageId) return false;
        const archived = isArchivedLead(lead);
        if (viewFilter === "active" && archived) return false;
        if (viewFilter === "archived" && !archived) return false;
        return true;
      }),
    [leads, rawStageId, viewFilter]
  );

  const sourceLeads = leadTab === "raw" ? rawLeads : pipelineLeads;

  const sources = useMemo(
    () => [...new Set(sourceLeads.map((l) => l.source).filter(Boolean))] as string[],
    [sourceLeads]
  );

  const projectInterests = useMemo(
    () =>
      [...new Set(sourceLeads.map((l) => l.project_interest).filter(Boolean))] as string[],
    [sourceLeads]
  );

  const visibleStages = useMemo(() => {
    const rest = sortedStages.filter((s) => s.id !== rawStageId);
    if (viewFilter === "archived") return rest;
    return rest.filter((s) => s.label !== DISQUALIFIED_STAGE_LABEL);
  }, [sortedStages, rawStageId, viewFilter]);

  const filtered = useMemo(() => {
    return sourceLeads.filter((lead) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        (lead.phone?.includes(q) ?? false) ||
        (lead.email?.toLowerCase().includes(q) ?? false);
      const matchesStage = !stageFilter || lead.stage_id === stageFilter;
      const matchesSource = !sourceFilter || lead.source === sourceFilter;
      const matchesProject =
        !projectFilter || lead.project_interest === projectFilter;
      return matchesSearch && matchesStage && matchesSource && matchesProject;
    });
  }, [sourceLeads, search, stageFilter, sourceFilter, projectFilter]);

  const listView = view === "list" || leadTab === "raw";
  const splitMode = isDesktop && listView && !selectionMode;

  useEffect(() => {
    if (!splitMode) return;
    if (selectedId && filtered.some((lead) => lead.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [splitMode, filtered, selectedId]);

  const activeFilterCount = [
    leadTab === "pipeline" && viewFilter !== "active" ? viewFilter : null,
    leadTab === "pipeline" ? stageFilter : null,
    sourceFilter,
    projectFilter,
  ].filter(Boolean).length;
  const activeStageLabel = stages.find((s) => s.id === stageFilter)?.label;
  const activeProjectLabel = projectFilter;

  function clearFilters() {
    setViewFilter("active");
    setStageFilter(null);
    setSourceFilter(null);
    setProjectFilter(null);
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: leadsKey });
  }

  function handleLeadTabChange(value: string) {
    const nextTab = value as LeadTab;
    setLeadTab(nextTab);
    setView("list");
    setViewFilter("active");
    setStageFilter(null);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelectionMode() {
    setSelectionMode((active) => {
      if (!active) setView("list");
      if (active) setSelectedIds(new Set());
      return !active;
    });
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((lead) => lead.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedLeads = useMemo(
    () => filtered.filter((lead) => selectedIds.has(lead.id)),
    [filtered, selectedIds]
  );

  function handleBatchComplete() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleSyncNow() {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await triggerSheetSync(["leads"]);
      if (result.error || !result.leads) {
        toast.error(result.error ?? "Sheet sync failed");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: leadsKey });
      toast.success(describeTabSync("Sheet sync", result.leads));
      for (const warning of result.leads.warnings.slice(0, 2)) {
        toast.warning(warning);
      }
      for (const error of result.leads.errors.slice(0, 2)) {
        toast.error(error);
      }
    } catch {
      toast.error("Sheet sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function startCalling() {
    const source =
      selectionMode && selectedLeads.length > 0 ? selectedLeads : filtered;
    const contacts: CallQueueContact[] = source.flatMap((lead) => {
      const base =
        [lead.pipeline_stages?.label, lead.project_interest]
          .filter(Boolean)
          .join(" · ") || null;
      const additional: string[] = Array.isArray(lead.custom_data?.additional_phones)
        ? (lead.custom_data.additional_phones as unknown[]).filter(
            (p): p is string => typeof p === "string" && Boolean(p)
          )
        : [];
      const numbers: { phone: string; tag: string | null }[] = [];
      if (lead.phone) numbers.push({ phone: lead.phone, tag: null });
      if (lead.alt_phone) numbers.push({ phone: lead.alt_phone, tag: "Alt" });
      additional.forEach((phone, i) =>
        numbers.push({ phone, tag: `Phone ${i + 3}` })
      );
      const seen = new Set<string>();
      return numbers
        .filter(({ phone }) => {
          if (seen.has(phone)) return false;
          seen.add(phone);
          return true;
        })
        .map(({ phone, tag }, i) => ({
          id: `${lead.id}:${i}`,
          recordId: lead.id,
          name: lead.name,
          phone,
          subtitle: [base, tag].filter(Boolean).join(" · ") || null,
        }));
    });
    if (contacts.length === 0) {
      toast.error("No contacts with phone numbers in this list");
      return;
    }
    setCallQueue(contacts);
    setCallQueueOpen(true);
  }

  async function handleCallOutcome(
    contact: CallQueueContact,
    outcome: CallOutcome,
    opts?: { note?: string; followUpDate?: string }
  ) {
    const label = CALL_OUTCOME_LABELS[outcome];
    try {
      await createLeadNote.mutateAsync({
        lead_id: contact.recordId,
        content: opts?.note
          ? `Call (${label}) ${contact.phone}: ${opts.note}`
          : `Call (${label}) ${contact.phone}`,
        note_type: "call",
      });
      if (outcome === "callback" && opts?.followUpDate) {
        await createTask.mutateAsync({
          lead_id: contact.recordId,
          title: `Call back ${contact.name}`,
          due_date: opts.followUpDate,
          due_time: null,
        });
      }
      toast.success(`${contact.name} — ${label}`);
    } catch {
      toast.error(`Failed to log call for ${contact.name}`);
      throw new Error("call-log-failed");
    }
  }

  const listHeader = (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
        <div className="flex shrink-0 gap-1">
          <Button
            variant={selectionMode ? "secondary" : "ghost"}
            size="icon"
            onClick={toggleSelectionMode}
            aria-label={selectionMode ? "Exit selection mode" : "Select leads for bulk actions"}
          >
            <CheckSquare />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setImportOpen(true)}
            aria-label="Bulk import leads"
          >
            <Upload />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSyncNow}
            disabled={syncing}
            aria-label="Sync now with Google Sheet"
          >
            <RefreshCw className={cn(syncing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={startCalling}
            aria-label="Start calling"
          >
            <PhoneCall />
          </Button>
          <Button
            variant={listView ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List />
          </Button>
          <Button
            variant={view === "kanban" && leadTab === "pipeline" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setView("kanban")}
            disabled={leadTab === "raw"}
            aria-label="Kanban view"
          >
            <LayoutGrid />
          </Button>
        </div>
      </div>

      <Tabs value={leadTab} onValueChange={handleLeadTabChange} className="mt-3">
        <TabsList className="grid h-10 w-full grid-cols-2">
          <TabsTrigger value="raw">
            Raw Leads
            {rawLeads.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {rawLeads.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            Pipeline
            {pipelineLeads.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {pipelineLeads.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative mt-3">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, phone, email…"
          className="h-12 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
          aria-expanded={filtersOpen}
        >
          <span className="font-medium">
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              filtersOpen && "rotate-180"
            )}
          />
        </button>

        {filtersOpen && (
          <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-card px-3 md:max-h-80">
            {activeFilterCount > 0 && (
              <div className="flex justify-end border-b border-border py-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                  Clear all
                </button>
              </div>
            )}

            {leadTab === "pipeline" && (
              <CollapsibleFilterSection
                title="View"
                summary={viewFilter === "archived" ? "Archived" : "Active"}
                hasActiveFilter={viewFilter !== "active"}
              >
                <FilterChip
                  label="Active"
                  active={viewFilter === "active"}
                  onClick={() => setViewFilter("active")}
                />
                <FilterChip
                  label="Archived"
                  active={viewFilter === "archived"}
                  onClick={() => setViewFilter("archived")}
                />
              </CollapsibleFilterSection>
            )}

            {leadTab === "pipeline" && (
              <CollapsibleFilterSection
                title="Stage"
                summary={activeStageLabel ?? "All stages"}
                hasActiveFilter={Boolean(stageFilter)}
              >
                <FilterChip
                  label="All stages"
                  active={!stageFilter}
                  onClick={() => setStageFilter(null)}
                />
                {visibleStages.map((s) => (
                  <FilterChip
                    key={s.id}
                    label={s.label}
                    active={stageFilter === s.id}
                    onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
                  />
                ))}
              </CollapsibleFilterSection>
            )}

            <CollapsibleFilterSection
              title="Source"
              summary={sourceFilter ?? "All sources"}
              hasActiveFilter={Boolean(sourceFilter)}
            >
              <FilterChip
                label="All sources"
                active={!sourceFilter}
                onClick={() => setSourceFilter(null)}
              />
              {sources.map((s) => (
                <FilterChip
                  key={s}
                  label={s}
                  active={sourceFilter === s}
                  onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
                />
              ))}
            </CollapsibleFilterSection>

            <CollapsibleFilterSection
              title="Project"
              summary={activeProjectLabel ?? "All projects"}
              hasActiveFilter={Boolean(projectFilter)}
            >
              <FilterChip
                label="All projects"
                active={!projectFilter}
                onClick={() => setProjectFilter(null)}
              />
              {projectInterests.map((name) => (
                <FilterChip
                  key={name}
                  label={name}
                  active={projectFilter === name}
                  onClick={() =>
                    setProjectFilter(projectFilter === name ? null : name)
                  }
                />
              ))}
            </CollapsibleFilterSection>
          </div>
        )}
      </div>
    </header>
  );

  const listBody = (
    <PullToRefresh
      onRefresh={handleRefresh}
      className={cn("flex-1", splitMode ? "overflow-y-auto" : "px-4 py-4")}
    >
      {isLoading ? (
        <div className={cn("flex flex-col gap-3", splitMode ? "p-3" : "")}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn("w-full rounded-lg", splitMode ? "h-16" : "h-28")} />
          ))}
        </div>
      ) : isError ? (
        <div className={splitMode ? "p-4" : undefined}>
          <EmptyState
            title="Could not load leads"
            description="Check your Supabase connection and run the migration in supabase/migrations/001_initial_schema.sql"
            actionLabel="Try again"
            onAction={handleRefresh}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className={splitMode ? "p-4" : undefined}>
          <EmptyState
            title={
              leadTab === "raw"
                ? sourceLeads.length === 0
                  ? "No raw leads"
                  : "No matching leads"
                : sourceLeads.length === 0
                  ? viewFilter === "archived"
                    ? "No archived leads"
                    : "No leads in pipeline"
                  : "No matching leads"
            }
            description={
              leadTab === "raw"
                ? sourceLeads.length === 0
                  ? "New enquiries land here. Qualify them to move them into the pipeline."
                  : "Try adjusting your search or filters."
                : sourceLeads.length === 0
                  ? viewFilter === "archived"
                    ? "Leads marked as Disqualified appear here."
                    : "Move raw leads into a pipeline stage to start working them."
                  : "Try adjusting your search or filters."
            }
            actionLabel={sourceLeads.length === 0 && leadTab === "raw" ? "Add Lead" : undefined}
            onAction={
              sourceLeads.length === 0 && leadTab === "raw" ? () => setFormOpen(true) : undefined
            }
          />
        </div>
      ) : listView ? (
        splitMode ? (
          <div className="flex flex-col bg-card">
            {filtered.map((lead) => (
              <ContactListRow
                key={lead.id}
                name={lead.name}
                subtitle={
                  lead.phone
                    ? formatPhone(lead.phone)
                    : (lead.project_interest ?? lead.source ?? undefined)
                }
                meta={
                  leadTab === "pipeline"
                    ? formatRelativeDate(lead.updated_at)
                    : formatDisplayDate(lead.acquired_date ?? lead.created_at)
                }
                badge={
                  lead.pipeline_stages ? (
                    <StageBadge
                      label={lead.pipeline_stages.label}
                      color={lead.pipeline_stages.color}
                    />
                  ) : undefined
                }
                selected={selectedId === lead.id}
                onClick={() => setSelectedId(lead.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selectionMode={selectionMode}
                selected={selectedIds.has(lead.id)}
                onToggleSelect={toggleLeadSelection}
                showLastActivity={leadTab === "pipeline"}
              />
            ))}
          </div>
        )
      ) : (
        <LeadKanban
          leads={filtered}
          stages={visibleStages}
          className={splitMode ? undefined : "-mx-4 px-4"}
        />
      )}
    </PullToRefresh>
  );

  const listPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      {listHeader}
      {listBody}
    </div>
  );

  const detailPane = selectedId ? (
    <div className="h-full overflow-y-auto bg-background">
      <LeadDetailPanel
        key={selectedId}
        id={selectedId}
        embedded
        onDeleted={() => setSelectedId(null)}
      />
    </div>
  ) : (
    <DetailEmptyState
      title="Select a lead"
      description="Choose a contact from the list to see their details, notes, and tasks."
    />
  );

  return (
    <>
      <MasterDetailLayout split={splitMode} list={listPane} detail={detailPane} />

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-card md:right-6 md:bottom-6"
        onClick={() => setFormOpen(true)}
        aria-label="Add lead"
      >
        <Plus />
      </Button>

      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:bottom-0 md:left-16">
          <div className="mx-auto flex max-w-lg flex-col gap-2 md:max-w-none">
            <p className="text-sm font-medium">{selectedIds.size} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={selectAllVisible}>
                Select all
              </Button>
              <Button variant="outline" className="h-10 flex-1" onClick={clearSelection}>
                Clear
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="h-10 flex-1" onClick={() => setStageChangeOpen(true)}>
                Change stage
              </Button>
              <Button variant="secondary" className="h-10 flex-1" onClick={() => setBatchOpen(true)}>
                WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      <LeadForm open={formOpen} onOpenChange={setFormOpen} />
      <BulkImportSheet
        entityType="lead"
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <BatchStageChangeSheet
        leads={selectedLeads}
        open={stageChangeOpen}
        onOpenChange={setStageChangeOpen}
        onComplete={handleBatchComplete}
      />
      <BatchWhatsAppSheet
        leads={selectedLeads}
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onComplete={handleBatchComplete}
      />
      <CallQueueSheet
        open={callQueueOpen}
        onOpenChange={setCallQueueOpen}
        title={leadTab === "raw" ? "Calling raw leads" : "Calling pipeline leads"}
        contacts={callQueue}
        onLogOutcome={handleCallOutcome}
      />
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
