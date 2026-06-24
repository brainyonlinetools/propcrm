"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, LayoutGrid, List, Plus, Search, Upload, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadCard } from "@/components/leads/LeadCard";
import { LeadKanban } from "@/components/leads/LeadKanban";
import { LeadForm } from "@/components/leads/LeadForm";
import { BatchStageChangeSheet } from "@/components/leads/BatchStageChangeSheet";
import { BatchWhatsAppSheet } from "@/components/leads/BatchWhatsAppSheet";
import { BulkImportSheet } from "@/components/shared/BulkImportSheet";
import { CollapsibleFilterSection } from "@/components/shared/CollapsibleFilterSection";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { leadsKey, useLeads } from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { cn } from "@/lib/utils";
import { DISQUALIFIED_STAGE_LABEL, isArchivedLead } from "@/types";

type ViewMode = "list" | "kanban";
type LeadViewFilter = "active" | "archived";

export default function LeadsPage() {
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
  const [batchOpen, setBatchOpen] = useState(false);
  const [stageChangeOpen, setStageChangeOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, isError } = useLeads();
  const { data: stages = [] } = usePipelineStages();

  const sources = useMemo(
    () => [...new Set(leads.map((l) => l.source).filter(Boolean))] as string[],
    [leads]
  );

  const projectInterests = useMemo(
    () => [...new Set(leads.map((l) => l.project_interest).filter(Boolean))] as string[],
    [leads]
  );

  const visibleStages = useMemo(
    () =>
      viewFilter === "archived"
        ? stages
        : stages.filter((s) => s.label !== DISQUALIFIED_STAGE_LABEL),
    [stages, viewFilter]
  );

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const archived = isArchivedLead(lead);
      if (viewFilter === "active" && archived) return false;
      if (viewFilter === "archived" && !archived) return false;

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
  }, [leads, search, stageFilter, sourceFilter, projectFilter, viewFilter]);

  const activeFilterCount = [
    viewFilter !== "active" ? viewFilter : null,
    stageFilter,
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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
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
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List />
            </Button>
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("kanban")}
              aria-label="Kanban view"
            >
              <LayoutGrid />
            </Button>
          </div>
        </div>

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
            <div className="mt-1 rounded-md border border-border bg-card px-3">
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

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load leads"
            description="Check your Supabase connection and run the migration in supabase/migrations/001_initial_schema.sql"
            actionLabel="Try again"
            onAction={handleRefresh}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              leads.length === 0
                ? "No leads yet"
                : viewFilter === "archived"
                  ? "No archived leads"
                  : "No matching leads"
            }
            description={
              leads.length === 0
                ? "Add your first enquiry from Golf Course Road, DLF, or Sector 62 walk-ins."
                : viewFilter === "archived"
                  ? "Leads marked as Disqualified appear here."
                  : "Try adjusting your search or filters."
            }
            actionLabel={leads.length === 0 ? "Add Lead" : undefined}
            onAction={leads.length === 0 ? () => setFormOpen(true) : undefined}
          />
        ) : view === "list" ? (
          <div className="flex flex-col gap-3">
            {filtered.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selectionMode={selectionMode}
                selected={selectedIds.has(lead.id)}
                onToggleSelect={toggleLeadSelection}
              />
            ))}
          </div>
        ) : (
          <LeadKanban leads={filtered} stages={visibleStages} className="-mx-4 px-4" />
        )}
      </PullToRefresh>

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-card"
        onClick={() => setFormOpen(true)}
        aria-label="Add lead"
      >
        <Plus />
      </Button>

      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            <p className="text-sm font-medium">
              {selectedIds.size} selected
            </p>
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
    </div>
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
