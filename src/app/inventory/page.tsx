"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Upload, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UnitCard } from "@/components/inventory/UnitCard";
import { UnitForm } from "@/components/inventory/UnitForm";
import { BulkImportSheet } from "@/components/shared/BulkImportSheet";
import { CollapsibleFilterSection } from "@/components/shared/CollapsibleFilterSection";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { inventoryKey, useInventory } from "@/lib/queries/inventory";
import { useProjects } from "@/lib/queries/projects";
import { cn } from "@/lib/utils";
import type { InventoryStatus } from "@/types";

const STATUSES: InventoryStatus[] = ["available", "blocked", "booked", "sold"];

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: units = [], isLoading, isError } = useInventory();
  const { data: projects = [] } = useProjects();

  const unitTypes = useMemo(
    () => [...new Set(units.map((u) => u.unit_type).filter(Boolean))] as string[],
    [units]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter((unit) => {
      const matchesSearch =
        !q ||
        unit.unit_number.toLowerCase().includes(q) ||
        (unit.projects?.name.toLowerCase().includes(q) ?? false);
      const matchesProject = !projectFilter || unit.project_id === projectFilter;
      const matchesStatus = !statusFilter || unit.status === statusFilter;
      const matchesType = !typeFilter || unit.unit_type === typeFilter;
      return matchesSearch && matchesProject && matchesStatus && matchesType;
    });
  }, [units, search, projectFilter, statusFilter, typeFilter]);

  const activeFilterCount = [statusFilter, projectFilter, typeFilter].filter(Boolean).length;
  const activeProjectLabel = projects.find((p) => p.id === projectFilter)?.name;

  function clearFilters() {
    setStatusFilter(null);
    setProjectFilter(null);
    setTypeFilter(null);
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: inventoryKey });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Inventory</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setImportOpen(true)}
            aria-label="Bulk import inventory"
          >
            <Upload />
          </Button>
        </div>

        <div className="relative mt-3">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search unit or project…"
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
                title="Status"
                summary={
                  statusFilter
                    ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)
                    : "All statuses"
                }
                hasActiveFilter={Boolean(statusFilter)}
              >
                <FilterChip label="All" active={!statusFilter} onClick={() => setStatusFilter(null)} />
                {STATUSES.map((s) => (
                  <FilterChip
                    key={s}
                    label={s.charAt(0).toUpperCase() + s.slice(1)}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(statusFilter === s ? null : s)}
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
                {projects.map((p) => (
                  <FilterChip
                    key={p.id}
                    label={p.name.split(" ").slice(-1)[0]}
                    active={projectFilter === p.id}
                    onClick={() => setProjectFilter(projectFilter === p.id ? null : p.id)}
                  />
                ))}
              </CollapsibleFilterSection>

              {unitTypes.length > 0 && (
                <CollapsibleFilterSection
                  title="Type"
                  summary={typeFilter ?? "All types"}
                  hasActiveFilter={Boolean(typeFilter)}
                >
                  <FilterChip
                    label="All types"
                    active={!typeFilter}
                    onClick={() => setTypeFilter(null)}
                  />
                  {unitTypes.map((t) => (
                    <FilterChip
                      key={t}
                      label={t}
                      active={typeFilter === t}
                      onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                    />
                  ))}
                </CollapsibleFilterSection>
              )}
            </div>
          )}
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load inventory"
            description="Check your Supabase connection and apply the migration."
            actionLabel="Try again"
            onAction={handleRefresh}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={units.length === 0 ? "No units listed" : "No matching units"}
            description={
              units.length === 0
                ? "Add units across Anand Prime Residences, Heights, and Vista."
                : "Try adjusting your filters."
            }
            actionLabel={units.length === 0 ? "Add Unit" : undefined}
            onAction={units.length === 0 ? () => setFormOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            {filtered.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        )}
      </PullToRefresh>

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-card"
        onClick={() => setFormOpen(true)}
        aria-label="Add unit"
      >
        <Plus />
      </Button>

      <UnitForm open={formOpen} onOpenChange={setFormOpen} />
      <BulkImportSheet
        entityType="inventory"
        open={importOpen}
        onOpenChange={setImportOpen}
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
    <div className="col-span-full flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
