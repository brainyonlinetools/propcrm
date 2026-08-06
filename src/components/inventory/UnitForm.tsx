"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DynamicFieldRenderer } from "@/components/shared/DynamicFieldRenderer";
import { InventoryMediaUploader } from "@/components/inventory/InventoryMediaUploader";
import { useCreateInventory, useUpdateInventory } from "@/lib/queries/inventory";
import { useProjects } from "@/lib/queries/projects";
import type { Inventory, InventoryStatus } from "@/types";

const unitSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required"),
  project_name: z.string().optional(),
  unit_type: z.string().optional(),
  area_sqft: z.string().optional(),
  price: z.string().optional(),
  status: z.enum(["available", "blocked", "booked", "sold"]),
  acquired_date: z.string().optional(),
  property_type: z.enum(["sale", "rent"]).optional().nullable(),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional(),
});

type UnitFormValues = z.infer<typeof unitSchema>;

const STATUSES: InventoryStatus[] = ["available", "blocked", "booked", "sold"];

function parseOptionalNumber(raw: string | undefined, label: string): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

interface UnitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Inventory | null;
  onSaved?: (unit: Inventory) => void;
}

export function UnitForm({ open, onOpenChange, unit, onSaved }: UnitFormProps) {
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [savedUnit, setSavedUnit] = useState<Inventory | null>(null);
  const createInventory = useCreateInventory();
  const updateInventory = useUpdateInventory();
  const { data: projects = [] } = useProjects();
  const activeUnit = savedUnit ?? unit ?? null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unit_number: "",
      project_name: "",
      unit_type: "",
      area_sqft: "",
      price: "",
      status: "available",
      acquired_date: "",
      property_type: null,
      owner_name: "",
      owner_phone: "",
    },
  });

  useEffect(() => {
    if (!open) {
      setSavedUnit(null);
      return;
    }

    if (unit) {
      setSavedUnit(null);
      reset({
        unit_number: unit.unit_number,
        unit_type: unit.unit_type ?? "",
        area_sqft: unit.area_sqft?.toString() ?? "",
        price: unit.price?.toString() ?? "",
        status: unit.status,
        acquired_date: unit.acquired_date ?? "",
        project_name: (unit.custom_data?.project_name as string) ?? unit.projects?.name ?? "",
        property_type:
          (unit.custom_data?.property_type as "sale" | "rent" | undefined) ?? null,
        owner_name: (unit.custom_data?.owner_name as string) ?? "",
        owner_phone: (unit.custom_data?.owner_phone as string) ?? "",
      });
      setCustomData(unit.custom_data ?? {});
    } else if (!savedUnit) {
      reset({
        unit_number: "",
        project_name: "",
        unit_type: "",
        area_sqft: "",
        price: "",
        status: "available",
        acquired_date: "",
        property_type: null,
        owner_name: "",
        owner_phone: "",
      });
      setCustomData({});
    }
  }, [unit, open, reset, savedUnit]);

  const projectOptions = useMemo(
    () => projects.map((project) => project.name).sort((a, b) => a.localeCompare(b)),
    [projects]
  );

  async function onSubmit(values: UnitFormValues) {
    try {
      const area_sqft = parseOptionalNumber(values.area_sqft, "Area");
      const price = parseOptionalNumber(values.price, "Price");
      const projectName = values.project_name?.trim() || "";
      const matchedProject = projectName
        ? projects.find((project) => project.name.toLowerCase() === projectName.toLowerCase())
        : null;

      const nextCustomData: Record<string, unknown> = { ...customData };
      delete nextCustomData.owner_name;
      delete nextCustomData.owner_phone;
      delete nextCustomData.project_name;
      delete nextCustomData.property_type;

      if (projectName) nextCustomData.project_name = projectName;
      if (values.property_type) nextCustomData.property_type = values.property_type;
      if (values.owner_name?.trim()) nextCustomData.owner_name = values.owner_name.trim();
      if (values.owner_phone?.trim()) nextCustomData.owner_phone = values.owner_phone.trim();

      const payload = {
        unit_number: values.unit_number.trim(),
        project_id: matchedProject?.id ?? activeUnit?.project_id ?? null,
        unit_type: values.unit_type?.trim() || null,
        area_sqft,
        price,
        status: values.status,
        acquired_date: values.acquired_date?.trim() || null,
        custom_data: nextCustomData,
      };

      if (activeUnit) {
        const updated = await updateInventory.mutateAsync({ id: activeUnit.id, ...payload });
        setSavedUnit(updated);
        onSaved?.(updated);
        toast.success("Unit updated");
      } else {
        const created = await createInventory.mutateAsync(payload);
        setSavedUnit(created);
        onSaved?.(created);
        toast.success("Unit added — you can upload photos & videos now");
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, activeUnit ? "Failed to update unit" : "Failed to add unit")
      );
    }
  }

  const propertyType = watch("property_type");
  const isPending = createInventory.isPending || updateInventory.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>{activeUnit ? "Edit Unit" : "Add Unit"}</SheetTitle>
          <SheetDescription>
            {activeUnit
              ? "Update unit details and media for client sharing."
              : "Add the unit first, then upload photos and videos."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit_number">Unit Number *</Label>
            <Input id="unit_number" className="h-12" {...register("unit_number")} />
            {errors.unit_number && (
              <p className="text-xs text-destructive">{errors.unit_number.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project_name">Project Name</Label>
            <Input
              id="project_name"
              className="h-12"
              list="inventory-project-names"
              placeholder="e.g. Anand Prime Residences"
              {...register("project_name")}
            />
            <datalist id="inventory-project-names">
              {projectOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Property Type</Label>
            <Select
              value={propertyType ?? undefined}
              onValueChange={(v) =>
                setValue("property_type", v as "sale" | "rent", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
              </SelectContent>
            </Select>
            {errors.property_type && (
              <p className="text-xs text-destructive">{String(errors.property_type.message)}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="unit_type">Unit Type</Label>
            <Input id="unit_type" className="h-12" placeholder="e.g. 3BHK" {...register("unit_type")} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="area_sqft">Area (sq.ft.)</Label>
              <Input id="area_sqft" type="number" className="h-12" {...register("area_sqft")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input id="price" type="number" className="h-12" {...register("price")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select
              value={watch("status")}
              onValueChange={(v) => setValue("status", v as InventoryStatus)}
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="acquired_date">Acquired Date</Label>
            <Input
              id="acquired_date"
              type="date"
              className="h-12"
              {...register("acquired_date")}
            />
          </div>

          <div className="border-t border-border pt-2">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Owner Details</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Owner info stays internal and is never included when sharing.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner_name">Owner Name</Label>
                <Input
                  id="owner_name"
                  className="h-12"
                  placeholder="Owner's name"
                  {...register("owner_name")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner_phone">Owner Phone</Label>
                <Input
                  id="owner_phone"
                  type="tel"
                  className="h-12"
                  placeholder="Owner's phone number"
                  {...register("owner_phone")}
                />
              </div>
            </div>
          </div>

          <DynamicFieldRenderer
            entityType="inventory"
            value={customData}
            onChange={(key, val) =>
              setCustomData((prev) => ({ ...prev, [key]: val }))
            }
            mode="edit"
          />

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {activeUnit ? "Save Changes" : "Add Unit"}
          </Button>

          {activeUnit && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          )}
        </form>

        {activeUnit && (
          <div className="mt-4 border-t border-border pt-4">
            <InventoryMediaUploader unit={activeUnit} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
