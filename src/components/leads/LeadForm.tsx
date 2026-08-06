"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
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
import {
  findLeadByPhone,
  useCreateLead,
  useLeads,
  useUpdateLead,
} from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { formatPhone, normalizePhoneKey } from "@/lib/utils";
import { LEAD_SOURCES, type Lead } from "@/types";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email",
    }),
  stage_id: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  project_interest: z.string().optional(),
  acquired_date: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

function todayDateInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
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

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead;
}

export function LeadForm({ open, onOpenChange, lead }: LeadFormProps) {
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
  const { data: stages = [] } = usePipelineStages();
  const { data: leads = [] } = useLeads();
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
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      stage_id: null,
      source: null,
      project_interest: "",
      acquired_date: todayDateInput(),
    },
  });

  const phoneValue = watch("phone");
  const stageId = watch("stage_id");
  const source = watch("source");

  useEffect(() => {
    if (!open) {
      setDuplicateLead(null);
      return;
    }

    if (lead) {
      reset({
        name: lead.name,
        phone: lead.phone ?? "",
        email: lead.email ?? "",
        stage_id: lead.stage_id ?? null,
        source: lead.source ?? null,
        project_interest: lead.project_interest ?? "",
        acquired_date: lead.acquired_date ?? "",
      });
      setCustomData(lead.custom_data ?? {});
      setDuplicateLead(null);
    } else {
      reset({
        name: "",
        phone: "",
        email: "",
        stage_id: stages[0]?.id ?? null,
        source: null,
        project_interest: "",
        acquired_date: todayDateInput(),
      });
      setCustomData({});
      setDuplicateLead(null);
    }
  }, [lead, open, reset, stages]);

  useEffect(() => {
    if (!open || lead) return;
    if (!stageId && stages[0]?.id) {
      setValue("stage_id", stages[0].id);
    }
  }, [open, lead, stageId, stages, setValue]);

  useEffect(() => {
    if (!open) return;
    const existing = findLeadByPhone(leads, phoneValue, lead?.id);
    setDuplicateLead(existing);
  }, [open, phoneValue, leads, lead?.id]);

  async function onSubmit(values: LeadFormValues) {
    const phone = values.phone?.trim() || null;
    if (phone && normalizePhoneKey(phone)) {
      const existing = findLeadByPhone(leads, phone, lead?.id);
      if (existing) {
        setDuplicateLead(existing);
        toast.warning("This phone number already exists");
        return;
      }
    }

    try {
      const payload = {
        name: values.name.trim(),
        phone,
        email: values.email?.trim() || null,
        stage_id: values.stage_id || stages[0]?.id || null,
        source: values.source || null,
        project_interest: values.project_interest?.trim() || null,
        acquired_date: values.acquired_date?.trim() || null,
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
    } catch (error) {
      const message = getErrorMessage(
        error,
        lead ? "Failed to update lead" : "Failed to add lead"
      );
      if (/duplicate|unique/i.test(message)) {
        const existing = findLeadByPhone(leads, phone, lead?.id);
        if (existing) {
          setDuplicateLead(existing);
          toast.warning("This phone number already exists");
          return;
        }
      }
      toast.error(message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>{lead ? "Edit Lead" : "Add Lead"}</SheetTitle>
          <SheetDescription>
            Phone numbers must be unique. Duplicate entries are blocked.
          </SheetDescription>
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
            {duplicateLead && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  This phone number already exists for{" "}
                  <Link
                    href={`/leads/${duplicateLead.id}`}
                    className="font-semibold underline underline-offset-2"
                    onClick={() => onOpenChange(false)}
                  >
                    {duplicateLead.name}
                  </Link>
                  {duplicateLead.phone ? ` (${formatPhone(duplicateLead.phone)})` : ""}.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="h-12" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Stage</Label>
            <Select
              value={stageId ?? undefined}
              onValueChange={(v) => setValue("stage_id", v, { shouldValidate: true })}
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
              value={source ?? undefined}
              onValueChange={(v) => setValue("source", v, { shouldValidate: true })}
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

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              createLead.isPending ||
              updateLead.isPending ||
              Boolean(duplicateLead)
            }
          >
            {lead ? "Save Changes" : "Add Lead"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
