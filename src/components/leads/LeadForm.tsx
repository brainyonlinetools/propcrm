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
import { useCreateLead, useUpdateLead } from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { LEAD_SOURCES, type Lead } from "@/types";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  stage_id: z.string().optional(),
  source: z.string().optional(),
  project_interest: z.string().optional(),
  acquired_date: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead;
}

export function LeadForm({ open, onOpenChange, lead }: LeadFormProps) {
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const { data: stages = [] } = usePipelineStages();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  useEffect(() => {
    if (lead) {
      reset({
        name: lead.name,
        phone: lead.phone ?? "",
        email: lead.email ?? "",
        stage_id: lead.stage_id ?? undefined,
        source: lead.source ?? undefined,
        project_interest: lead.project_interest ?? undefined,
        acquired_date: lead.acquired_date ?? undefined,
      });
      setCustomData(lead.custom_data ?? {});
    } else {
      reset({ name: "", phone: "", email: "" });
      setCustomData({});
    }
  }, [lead, open, reset]);

  async function onSubmit(values: LeadFormValues) {
    try {
      const payload = {
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        stage_id: values.stage_id || stages[0]?.id || null,
        source: values.source || null,
        project_interest: values.project_interest || null,
        acquired_date: values.acquired_date || null,
        custom_data: customData,
      };

      if (lead) {
        await updateLead.mutateAsync({ id: lead.id, ...payload });
        toast.success("Lead updated");
      } else {
        await createLead.mutateAsync(payload);
        toast.success("Lead added");
      }
      onOpenChange(false);
    } catch {
      toast.error(lead ? "Failed to update lead" : "Failed to add lead");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>{lead ? "Edit Lead" : "Add Lead"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" className="h-12" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" className="h-12" {...register("phone")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="h-12" {...register("email")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Stage</Label>
            <Select
              value={watch("stage_id") ?? ""}
              onValueChange={(v) => setValue("stage_id", v)}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Source</Label>
            <Select
              value={watch("source") ?? ""}
              onValueChange={(v) => setValue("source", v)}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project_interest">Project Interest</Label>
            <Input
              id="project_interest"
              className="h-12"
              placeholder="e.g. Anand Prime Residences"
              {...register("project_interest")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="acquired_date">Lead Date</Label>
            <Input
              id="acquired_date"
              type="date"
              className="h-12"
              {...register("acquired_date")}
            />
          </div>

          <DynamicFieldRenderer
            entityType="lead"
            value={customData}
            onChange={(key, val) =>
              setCustomData((prev) => ({ ...prev, [key]: val }))
            }
            mode="edit"
          />

          <Button type="submit" size="lg" className="w-full" disabled={createLead.isPending || updateLead.isPending}>
            {lead ? "Save Changes" : "Add Lead"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
