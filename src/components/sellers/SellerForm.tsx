"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useCreateSeller, useUpdateSeller } from "@/lib/queries/sellers";
import { useProjects } from "@/lib/queries/projects";
import { assignSplitPhones, mergeRemarksPhones } from "@/lib/phoneNumbers";
import type { Seller, SellerInsert } from "@/types";

const sellerSchema = z.object({
  owner_name: z.string().min(1, "Owner name is required"),
  contact_phone: z.string().optional(),
  alt_phone: z.string().optional(),
  email: z.string().optional(),
  project_id: z.string().optional(),
  tower: z.string().optional(),
  unit_number: z.string().optional(),
  floor: z.string().optional(),
  configuration: z.string().optional(),
  area_sqft: z.string().optional(),
  facing: z.string().optional(),
  parking: z.string().optional(),
  asking_price: z.string().optional(),
  available_for_sale: z.boolean(),
  remarks: z.string().optional(),
  follow_up_date: z.string().optional(),
});

type SellerFormValues = z.infer<typeof sellerSchema>;

const UNASSIGNED = "__unassigned__";

function toNumberOrNull(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const num = Number(raw.replace(/[,₹\s]/g, ""));
  return Number.isNaN(num) ? null : num;
}

function toTextOrNull(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function defaultsFromSeller(seller: Seller | null | undefined): SellerFormValues {
  return {
    owner_name: seller?.owner_name ?? "",
    contact_phone: seller?.contact_phone ?? "",
    alt_phone: seller?.alt_phone ?? "",
    email: seller?.email ?? "",
    project_id: seller?.project_id ?? UNASSIGNED,
    tower: seller?.tower ?? "",
    unit_number: seller?.unit_number ?? "",
    floor: seller?.floor != null ? String(seller.floor) : "",
    configuration: seller?.configuration ?? "",
    area_sqft: seller?.area_sqft != null ? String(seller.area_sqft) : "",
    facing: seller?.facing ?? "",
    parking: seller?.parking != null ? String(seller.parking) : "",
    asking_price: seller?.asking_price != null ? String(seller.asking_price) : "",
    available_for_sale: seller?.available_for_sale ?? false,
    remarks: seller?.remarks ?? "",
    follow_up_date: seller?.follow_up_date ?? "",
  };
}

interface SellerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller?: Seller | null;
}

export function SellerForm({ open, onOpenChange, seller = null }: SellerFormProps) {
  const { data: projects = [] } = useProjects();
  const createSeller = useCreateSeller();
  const updateSeller = useUpdateSeller();
  const isEditing = Boolean(seller);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SellerFormValues>({
    resolver: zodResolver(sellerSchema),
    defaultValues: defaultsFromSeller(seller),
  });

  useEffect(() => {
    if (open) reset(defaultsFromSeller(seller));
  }, [open, seller, reset]);

  const availableForSale = watch("available_for_sale");
  const projectId = watch("project_id");
  const isPending = createSeller.isPending || updateSeller.isPending;

  async function onSubmit(values: SellerFormValues) {
    const assigned = assignSplitPhones(values.contact_phone, values.alt_phone);
    const payload: SellerInsert = {
      owner_name: values.owner_name.trim(),
      contact_phone: assigned.primary,
      alt_phone: assigned.alt,
      email: toTextOrNull(values.email)?.toLowerCase() ?? null,
      project_id:
        !values.project_id || values.project_id === UNASSIGNED ? null : values.project_id,
      tower: toTextOrNull(values.tower),
      unit_number: toTextOrNull(values.unit_number),
      floor: toNumberOrNull(values.floor),
      configuration: toTextOrNull(values.configuration),
      area_sqft: toNumberOrNull(values.area_sqft),
      facing: toTextOrNull(values.facing),
      parking: toNumberOrNull(values.parking),
      asking_price: toNumberOrNull(values.asking_price),
      available_for_sale: values.available_for_sale,
      remarks: mergeRemarksPhones(values.remarks, assigned.extras),
      follow_up_date: toTextOrNull(values.follow_up_date),
    };
    for (const fragment of assigned.dropped) {
      toast.warning(`Ignored "${fragment}" (not a phone number)`);
    }

    try {
      const result = isEditing
        ? await updateSeller.mutateAsync({ ...payload, id: seller!.id })
        : await createSeller.mutateAsync(payload);

      if (result.inventoryAction === "created") {
        toast.success(isEditing ? "Seller saved — unit listed in inventory" : "Seller added — unit listed in inventory");
      } else if (result.inventoryAction === "marked_sold") {
        toast.success("Seller saved — inventory unit marked sold");
      } else {
        toast.success(isEditing ? "Seller saved" : "Seller added");
      }
      if (result.warning) toast.warning(result.warning);
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? "Failed to save seller" : "Failed to add seller");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl px-0"
      >
        <SheetHeader className="shrink-0 px-4">
          <SheetTitle>{isEditing ? "Edit seller" : "Add seller"}</SheetTitle>
          <SheetDescription>
            Owner and unit details. Turn on Available for sale to list the unit in
            inventory.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-owner">Owner name *</Label>
            <Input
              id="seller-owner"
              className="h-12"
              placeholder="Ramesh Agarwal"
              {...register("owner_name")}
            />
            {errors.owner_name && (
              <p className="text-xs text-destructive">{errors.owner_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-phone">Contact phone</Label>
              <Input
                id="seller-phone"
                className="h-12"
                inputMode="tel"
                placeholder="9876543210"
                {...register("contact_phone")}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple numbers with commas
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-alt-phone">Alternate phone</Label>
              <Input
                id="seller-alt-phone"
                className="h-12"
                inputMode="tel"
                placeholder="Optional"
                {...register("alt_phone")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-email">Email</Label>
            <Input
              id="seller-email"
              className="h-12"
              inputMode="email"
              placeholder="Optional"
              {...register("email")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Project</Label>
            <Select
              value={projectId || UNASSIGNED}
              onValueChange={(v) => setValue("project_id", v)}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-tower">Tower / Block</Label>
              <Input id="seller-tower" className="h-12" placeholder="A" {...register("tower")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-unit">Unit number</Label>
              <Input
                id="seller-unit"
                className="h-12"
                placeholder="A-1204"
                {...register("unit_number")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-floor">Floor</Label>
              <Input
                id="seller-floor"
                className="h-12"
                inputMode="numeric"
                placeholder="12"
                {...register("floor")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-config">Configuration</Label>
              <Input
                id="seller-config"
                className="h-12"
                placeholder="3BHK"
                {...register("configuration")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-area">Area (sq.ft.)</Label>
              <Input
                id="seller-area"
                className="h-12"
                inputMode="numeric"
                placeholder="1850"
                {...register("area_sqft")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-facing">Facing</Label>
              <Input
                id="seller-facing"
                className="h-12"
                placeholder="East"
                {...register("facing")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-parking">Parking slots</Label>
              <Input
                id="seller-parking"
                className="h-12"
                inputMode="numeric"
                placeholder="2"
                {...register("parking")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seller-price">Asking price (₹)</Label>
              <Input
                id="seller-price"
                className="h-12"
                inputMode="numeric"
                placeholder="28500000"
                {...register("asking_price")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div>
              <Label htmlFor="seller-for-sale">Available for sale</Label>
              <p className="text-xs text-muted-foreground">
                Copies this unit to inventory and keeps it in sync.
              </p>
            </div>
            <Switch
              id="seller-for-sale"
              checked={availableForSale}
              onCheckedChange={(v) => setValue("available_for_sale", v)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-followup">Follow-up date</Label>
            <Input
              id="seller-followup"
              type="date"
              className="h-12"
              {...register("follow_up_date")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-remarks">Remarks</Label>
            <Textarea
              id="seller-remarks"
              placeholder="Owner reachable after 6pm…"
              {...register("remarks")}
            />
          </div>

          <Button type="submit" size="lg" className="w-full shrink-0" disabled={isPending}>
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Add seller"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
