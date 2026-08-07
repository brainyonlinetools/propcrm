"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Upload, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UnitCard } from "@/components/inventory/UnitCard";
import { UnitDetailPanel } from "@/components/inventory/UnitDetailPanel";
import { UnitForm } from "@/components/inventory/UnitForm";
import { BulkImportSheet } from "@/components/shared/BulkImportSheet";
import { CollapsibleFilterSection } from "@/components/shared/CollapsibleFilterSection";
import {
  DetailEmptyState,
  MasterDetailLayout,
} from "@/components/shared/MasterDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import {
  ViewModeToggle,
  type ListViewMode,
} from "@/components/shared/ViewModeToggle";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { inventoryKey, useInventory } from "@/lib/queries/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import type { InventoryStatus } from "@/types";

const STATUSES: InventoryStatus[] = ["available", "blocked", "booked", "sold"];

export default function InventoryPage() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const [view, setView] = useState<ListViewMode>("table");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: units = [], isLoading, isError } = useInventory();

  const unitTypes = useMemo(
    () => [...new Set(units.map((u) => u.unit_type).filter(Boolean))] as string[],
    [units]
  );

  const projectNames = useMemo(
    () =>
      [
        ...new Set(
          units.map((u) => (u.custom_data?.project_name as string) ?? "").filter(Boolean)
        ),
      ] as string[],
    [units]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter((unit) => {
      const projectName =
        (unit.custom_data?.project_name as string) ?? unit.projects?.name ?? "";
      const matchesSearch =
        !q ||
        unit.unit_number.toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q);
      const matchesProject = !projectFilter || projectName === projectFilter;
      const matchesStatus = !statusFilter || unit.status === statusFilter;
      const matchesType = !typeFilter || unit.unit_type === typeFilter;
      return matchesSearch && matchesProject && matchesStatus && matchesType;
    });
  }, [units, search, projectFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (!isDesktop) return;
    if (selectedId && filtered.some((unit) => unit.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [isDesktop, filtered, selectedId]);

  const activeFilterCount = [statusFilter, projectFilter, typeFilter].filter(Boolean).length;
  const activeProjectLabel = projectFilter;
  const isGallery = view === "gallery";

  function clearFilters() {
    setStatusFilter(null);
    setProjectFilter(null);
    setTypeFilter(null);
  }

  function openUnit(unitId: string) {
    if (isDesktop) {
      setSelectedId(unitId);
      return;
    }
    router.push(`/inventory/${unitId}`);
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: inventoryKey });
  }

  const listHeader = (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Inventory</h1>
        <div className="flex shrink-0 items-center gap-1">
          <ViewModeToggle value={view} onChange={setView} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setImportOpen(true)}
            aria-label="Bulk import inventory"
          >
            <Upload />
          </Button>
        </div>
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
              {projectNames.map((name) => (
                <FilterChip
                  key={name}
                  label={name}
                  active={projectFilter === name}
                  onClick={() => setProjectFilter(projectFilter === name ? null : name)}
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
  );

  const listBody = (
    <PullToRefresh
      onRefresh={handleRefresh}
      className={cn("flex-1 px-4 py-4", isDesktop && "overflow-y-auto")}
    >
      {isLoading ? (
        <div
          className={cn(
            isGallery
              ? "grid grid-cols-1 gap-3 min-[380px]:grid-cols-2"
              : "overflow-x-auto"
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("rounded-lg", isGallery ? "h-56" : "h-12 w-full")}
            />
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
      ) : isGallery ? (
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-1">
          {filtered.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              onSelect={isDesktop ? () => setSelectedId(unit.id) : undefined}
              selected={isDesktop && selectedId === unit.id}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Unit
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Project
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Type
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Area
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Price
                </th>
                <th className="px-3 py-2.5 font-medium" scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((unit) => {
                const projectName =
                  (unit.custom_data?.project_name as string) ??
                  unit.projects?.name ??
                  "—";
                const isSelected = selectedId === unit.id;
                return (
                  <tr
                    key={unit.id}
                    className={cn(
                      "cursor-pointer border-b border-border last:border-b-0",
                      isDesktop && isSelected ? "bg-muted" : "hover:bg-muted/60"
                    )}
                    onClick={() => openUnit(unit.id)}
                  >
                    <td className="px-3 py-2.5 align-middle font-medium">
                      {unit.unit_number}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 align-middle text-muted-foreground">
                      {projectName}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-muted-foreground">
                      {unit.unit_type ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-muted-foreground">
                      {unit.area_sqft != null
                        ? `${unit.area_sqft.toLocaleString("en-IN")} sq.ft.`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 align-middle font-medium">
                      {formatCurrency(unit.price)}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <StatusBadge status={unit.status} className="shrink-0" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
      <UnitDetailPanel
        key={selectedId}
        id={selectedId}
        embedded
        onDeleted={() => setSelectedId(null)}
      />
    </div>
  ) : (
    <DetailEmptyState
      title="Select a unit"
      description="Choose a unit from the list to view pricing, owner details, and activity."
    />
  );

  return (
    <>
      <MasterDetailLayout split={isDesktop} list={listPane} detail={detailPane} />

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-card md:right-6 md:bottom-6"
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
    <div className="col-span-full flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
