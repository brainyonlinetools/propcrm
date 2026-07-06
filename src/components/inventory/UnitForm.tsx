"use client";

import { useEffect, useState } from "react";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DynamicFieldRenderer } from "@/components/shared/DynamicFieldRenderer";
import { useCreateInventory, useUpdateInventory } from "@/lib/queries/inventory";
import type { Inventory, InventoryStatus } from "@/types";

const unitSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required"),
  project_name: z.string().optional(),
  unit_type: z.string().optional(),
  area_sqft: z.string().optional(),
  price: z.string().optional(),
  status: z.enum(["available", "blocked", "booked", "sold"]),
  acquired_date: z.string().optional(),
  property_type: z.enum(["sale", "rent"]).optional(),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional(),
});

type UnitFormValues = z.infer<typeof unitSchema>;

const STATUSES: InventoryStatus[] = ["available", "blocked", "booked", "sold"];

interface UnitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Inventory;
}

export function UnitForm({ open, onOpenChange, unit }: UnitFormProps) {
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const createInventory = useCreateInventory();
  const updateInventory = useUpdateInventory();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { unit_number: "", status: "available" },
  });

  useEffect(() => {
    if (unit) {
      reset({
        unit_number: unit.unit_number,
        unit_type: unit.unit_type ?? "",
        area_sqft: unit.area_sqft?.toString() ?? "",
        price: unit.price?.toString() ?? "",
        status: unit.status,
        acquired_date: unit.acquired_date ?? undefined,
        project_name: (unit.custom_data?.project_name as string) ?? "",
        property_type: (unit.custom_data?.property_type as "sale" | "rent") ?? undefined,
        owner_name: (unit.custom_data?.owner_name as string) ?? "",
        owner_phone: (unit.custom_data?.owner_phone as string) ?? "",
      });
      setCustomData(unit.custom_data ?? {});
    } else {
      reset({ unit_number: "", status: "available" });
      setCustomData({});
    }
  }, [unit, open, reset]);

  async function onSubmit(values: UnitFormValues) {
    try {
      const payload = {
        unit_number: values.unit_number,
        unit_type: values.unit_type || null,
        area_sqft: values.area_sqft ? Number(values.area_sqft) : null,
        price: values.price ? Number(values.price) : null,
        status: values.status,
        acquired_date: values.acquired_date || null,
        custom_data: {
          ...customData,
          ...(values.project_name ? { project_name: values.project_name } : {}),
          ...(values.property_type ? { property_type: values.property_type } : {}),
          ...(values.owner_name ? { owner_name: values.owner_name } : {}),
          ...(values.owner_phone ? { owner_phone: values.owner_phone } : {}),
        },
      };

      if (unit) {
        await updateInventory.mutateAsync({ id: unit.id, ...payload });
        toast.success("Unit updated");
      } else {
        await createInventory.mutateAsync(payload);
        toast.success("Unit added");
      }
      onOpenChange(false);
    } catch {
      toast.error(unit ? "Failed to update unit" : "Failed to add unit");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>{unit ? "Edit Unit" : "Add Unit"}</SheetTitle>
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
            <Input id="project_name" className="h-12" placeholder="e.g. Anand Prime Residences" {...register("project_name")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Property Type</Label>
            <Select
              value={watch("property_type") ?? ""}
              onValueChange={(v) => setValue("property_type", v as "sale" | "rent")}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner_name">Owner Name</Label>
                <Input id="owner_name" className="h-12" placeholder="Owner's name" {...register("owner_name")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner_phone">Owner Phone</Label>
                <Input id="owner_phone" type="tel" className="h-12" placeholder="Owner's phone number" {...register("owner_phone")} />
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

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={createInventory.isPending || updateInventory.isPending}
          >
            {unit ? "Save Changes" : "Add Unit"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
