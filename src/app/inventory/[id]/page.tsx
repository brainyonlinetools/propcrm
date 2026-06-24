"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynamicFieldRenderer } from "@/components/shared/DynamicFieldRenderer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StageBadge } from "@/components/shared/StatusBadge";
import { useInventoryItem, useUpdateInventory } from "@/lib/queries/inventory";
import { useLeadsByUnit } from "@/lib/queries/leads";
import { formatCurrency } from "@/lib/utils";
import type { InventoryStatus } from "@/types";

const STATUSES: InventoryStatus[] = ["available", "blocked", "booked", "sold"];

export default function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: unit, isLoading } = useInventoryItem(id);
  const { data: linkedLeads = [] } = useLeadsByUnit(id);
  const updateInventory = useUpdateInventory();
  const [customData, setCustomData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (unit) {
      setCustomData(unit.custom_data);
    }
  }, [unit]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Unit not found</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
    );
  }

  async function saveField(field: string, value: unknown) {
    try {
      await updateInventory.mutateAsync({ id, [field]: value });
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  async function saveCustomData() {
    try {
      await updateInventory.mutateAsync({ id, custom_data: customData });
      toast.success("Custom fields saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/inventory">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{unit.unit_number}</h1>
          {unit.projects && (
            <p className="text-sm text-muted-foreground">{unit.projects.name}</p>
          )}
        </div>
        <StatusBadge status={unit.status} />
      </div>

      <section className="flex flex-col gap-2">
        <Label>Status</Label>
        <Select
          value={unit.status}
          onValueChange={(v) => saveField("status", v as InventoryStatus)}
        >
          <SelectTrigger className="h-12 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Unit Details</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit_type">Unit Type</Label>
            <Input
              id="unit_type"
              className="h-12"
              defaultValue={unit.unit_type ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (unit.unit_type ?? "")) {
                  saveField("unit_type", e.target.value || null);
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="area">Area (sq.ft.)</Label>
              <Input
                id="area"
                type="number"
                className="h-12"
                defaultValue={unit.area_sqft ?? ""}
                onBlur={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  if (val !== unit.area_sqft) saveField("area_sqft", val);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                className="h-12"
                defaultValue={unit.price ?? ""}
                onBlur={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  if (val !== unit.price) saveField("price", val);
                }}
              />
            </div>
          </div>
          {unit.price != null && (
            <p className="text-sm text-muted-foreground">
              Display: {formatCurrency(unit.price)}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="acquired_date">Acquired Date</Label>
            <Input
              id="acquired_date"
              type="date"
              className="h-12"
              defaultValue={unit.acquired_date ?? ""}
              onBlur={(e) => {
                const val = e.target.value || null;
                if (val !== (unit.acquired_date ?? "")) {
                  saveField("acquired_date", val);
                }
              }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Custom Fields</h2>
        <DynamicFieldRenderer
          entityType="inventory"
          value={customData}
          onChange={(key, val) =>
            setCustomData((prev) => ({ ...prev, [key]: val }))
          }
          mode="edit"
        />
        <Button className="mt-4 w-full" onClick={saveCustomData}>
          Save Custom Fields
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Linked Leads</h2>
        {linkedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads linked to this unit</p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{lead.name}</span>
                {lead.pipeline_stages && (
                  <StageBadge
                    label={lead.pipeline_stages.label}
                    color={lead.pipeline_stages.color}
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
