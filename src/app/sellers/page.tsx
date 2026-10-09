"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PhoneCall, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SellerDetailPanel } from "@/components/sellers/SellerDetailPanel";
import { SellerForm } from "@/components/sellers/SellerForm";
import { SellerImportSheet } from "@/components/sellers/SellerImportSheet";
import { InventoryBrowser } from "@/components/inventory/InventoryBrowser";
import { ContactListRow } from "@/components/shared/ContactListRow";
import {
  DetailEmptyState,
  MasterDetailLayout,
} from "@/components/shared/MasterDetailLayout";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { CallQueueSheet, type CallQueueContact } from "@/components/shared/CallQueueSheet";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { sellersKey, useLogSellerCall, useSellers } from "@/lib/queries/sellers";
import { useProjects } from "@/lib/queries/projects";
import { cn, formatCurrency, formatPhone } from "@/lib/utils";
import { CALL_OUTCOME_LABELS, type CallOutcome } from "@/types";

type SellersTab = "sellers" | "inventory";

const UNASSIGNED = "__unassigned__";

export default function SellersPage() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const [tab, setTab] = useState<SellersTab>("sellers");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callQueueOpen, setCallQueueOpen] = useState(false);
  const [callQueue, setCallQueue] = useState<CallQueueContact[]>([]);
  const queryClient = useQueryClient();
  const logSellerCall = useLogSellerCall();

  const { data: sellers = [], isLoading, isError } = useSellers();
  const { data: projects = [] } = useProjects();

  const projectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const s of sellers) {
      if (s.project_id) counts.set(s.project_id, (counts.get(s.project_id) ?? 0) + 1);
      else unassigned++;
    }
    return { counts, unassigned };
  }, [sellers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellers.filter((s) => {
      if (projectFilter === UNASSIGNED && s.project_id !== null) return false;
      if (projectFilter && projectFilter !== UNASSIGNED && s.project_id !== projectFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.owner_name.toLowerCase().includes(q) ||
        (s.contact_phone?.includes(q) ?? false) ||
        (s.unit_number?.toLowerCase().includes(q) ?? false) ||
        (s.remarks?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [sellers, search, projectFilter]);

  useEffect(() => {
    if (!isDesktop) return;
    if (selectedId && filtered.some((s) => s.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [isDesktop, filtered, selectedId]);

  function openSeller(sellerId: string) {
    if (isDesktop) {
      setSelectedId(sellerId);
      return;
    }
    router.push(`/sellers/${sellerId}`);
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: sellersKey });
  }

  function startCalling() {
    const contacts: CallQueueContact[] = filtered
      .filter((s) => s.contact_phone || s.alt_phone)
      .map((s) => ({
        id: s.id,
        name: s.owner_name,
        phone: (s.contact_phone ?? s.alt_phone) as string,
        subtitle:
          [s.unit_number, s.projects?.name].filter(Boolean).join(" · ") || null,
      }));
    if (contacts.length === 0) {
      toast.error("No seller contacts with phone numbers in this list");
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
      await logSellerCall.mutateAsync({
        seller_id: contact.id,
        outcome,
        note: opts?.note
          ? `Call (${label}): ${opts.note}`
          : undefined,
        follow_up_date: opts?.followUpDate ?? null,
      });
      toast.success(`${contact.name} — ${label}`);
    } catch {
      toast.error(`Failed to log call for ${contact.name}`);
      throw new Error("call-log-failed");
    }
  }

  const listHeader = (
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Sellers</h1>
        {tab === "sellers" && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setImportOpen(true)}
              aria-label="Import sellers"
            >
              <Upload />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startCalling}
              aria-label="Start calling"
            >
              <PhoneCall />
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SellersTab)}
        className="mt-3 w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sellers">Seller Data</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "sellers" && (
        <>
          <div className="relative mt-3">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search owner, phone, or unit…"
              className="h-12 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <FilterChip
              label={`All (${sellers.length})`}
              active={!projectFilter}
              onClick={() => setProjectFilter(null)}
            />
            {projects
              .filter((p) => projectCounts.counts.has(p.id))
              .map((p) => (
                <FilterChip
                  key={p.id}
                  label={`${p.name} (${projectCounts.counts.get(p.id)})`}
                  active={projectFilter === p.id}
                  onClick={() => setProjectFilter(projectFilter === p.id ? null : p.id)}
                />
              ))}
            {projectCounts.unassigned > 0 && (
              <FilterChip
                label={`Unassigned (${projectCounts.unassigned})`}
                active={projectFilter === UNASSIGNED}
                onClick={() =>
                  setProjectFilter(projectFilter === UNASSIGNED ? null : UNASSIGNED)
                }
              />
            )}
          </div>
        </>
      )}
    </header>
  );

  const listBody = (
    <PullToRefresh
      onRefresh={handleRefresh}
      className={cn("flex-1 px-4 py-4", isDesktop && "overflow-y-auto")}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <h2 className="text-base font-semibold">Could not load sellers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your Supabase connection and apply migration 012.
          </p>
          <Button className="mt-4" onClick={handleRefresh}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <h2 className="text-base font-semibold">
            {sellers.length === 0 ? "No sellers yet" : "No matching sellers"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {sellers.length === 0
              ? "Add sellers manually or import a project-wise list."
              : "Try adjusting your search or project filter."}
          </p>
          {sellers.length === 0 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => setFormOpen(true)}>Add Seller</Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                Import
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {filtered.map((seller) => {
            const projectName = seller.projects?.name;
            const subtitle = [
              seller.unit_number,
              seller.configuration,
              projectName,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <ContactListRow
                key={seller.id}
                name={seller.owner_name}
                subtitle={subtitle || formatPhone(seller.contact_phone)}
                meta={
                  seller.asking_price != null
                    ? formatCurrency(seller.asking_price)
                    : undefined
                }
                badge={
                  seller.available_for_sale ? (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      For sale
                    </span>
                  ) : undefined
                }
                selected={isDesktop && selectedId === seller.id}
                onClick={() => openSeller(seller.id)}
                className="last:border-b-0"
              />
            );
          })}
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
      <SellerDetailPanel
        key={selectedId}
        id={selectedId}
        embedded
        onDeleted={() => setSelectedId(null)}
      />
    </div>
  ) : (
    <DetailEmptyState
      title="Select a seller"
      description="Choose a seller to view owner details, call or message them, and manage their listing."
    />
  );

  if (tab === "inventory") {
    return (
      <div className="flex min-h-dvh flex-col">
        {listHeader}
        <div className="min-h-0 flex-1">
          <InventoryBrowser />
        </div>
      </div>
    );
  }

  return (
    <>
      <MasterDetailLayout split={isDesktop} list={listPane} detail={detailPane} />

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-card md:right-6 md:bottom-6"
        onClick={() => setFormOpen(true)}
        aria-label="Add seller"
      >
        <Plus />
      </Button>

      <SellerForm open={formOpen} onOpenChange={setFormOpen} />
      <SellerImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultProjectId={projectFilter && projectFilter !== UNASSIGNED ? projectFilter : null}
      />
      <CallQueueSheet
        open={callQueueOpen}
        onOpenChange={setCallQueueOpen}
        title="Calling sellers"
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
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}
