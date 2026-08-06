"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Pencil, Phone, Share2, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DynamicFieldRenderer } from "@/components/shared/DynamicFieldRenderer";
import { StageBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { InventoryMediaUploader } from "@/components/inventory/InventoryMediaUploader";
import { InventoryShareSheet } from "@/components/inventory/InventoryShareSheet";
import { UnitForm } from "@/components/inventory/UnitForm";
import { useDeleteInventory, useInventoryItem, useUpdateInventory } from "@/lib/queries/inventory";
import { useLeadsByUnit } from "@/lib/queries/leads";
import { useCreateInventoryNote, useInventoryNotes } from "@/lib/queries/tasks";
import { formatCurrency, formatRelativeDate, phoneToTel, phoneToWhatsApp } from "@/lib/utils";
import { NOTE_TYPE_CONFIG, type InventoryStatus, type NoteType } from "@/types";

const STATUSES: InventoryStatus[] = ["available", "blocked", "booked", "sold"];

interface UnitDetailPanelProps {
  id: string;
  embedded?: boolean;
  onDeleted?: () => void;
}

export function UnitDetailPanel({
  id,
  embedded = false,
  onDeleted,
}: UnitDetailPanelProps) {
  const router = useRouter();
  const { data: unit, isLoading } = useInventoryItem(id);
  const { data: linkedLeads = [] } = useLeadsByUnit(id);
  const { data: notes = [] } = useInventoryNotes(id);
  const updateInventory = useUpdateInventory();
  const deleteInventory = useDeleteInventory();
  const createNote = useCreateInventoryNote();
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [noteType, setNoteType] = useState<NoteType>("note");
  const [noteContent, setNoteContent] = useState("");

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
        {!embedded && (
          <Button asChild variant="link" className="mt-2">
            <Link href="/inventory">Back to inventory</Link>
          </Button>
        )}
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

  async function handleDelete() {
    try {
      await deleteInventory.mutateAsync(id);
      toast.success("Unit deleted");
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/inventory");
      }
    } catch {
      toast.error("Failed to delete unit");
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    try {
      await createNote.mutateAsync({
        inventory_id: id,
        content: noteContent.trim(),
        note_type: noteType,
      });
      setNoteContent("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  }

  async function logOwnerCall() {
    try {
      await createNote.mutateAsync({
        inventory_id: id,
        content: "Call initiated to owner",
        note_type: "call",
      });
    } catch {
      // silent fail
    }
  }

  async function logOwnerWhatsApp() {
    try {
      await createNote.mutateAsync({
        inventory_id: id,
        content: "WhatsApp message sent to owner",
        note_type: "whatsapp",
      });
    } catch {
      // silent fail
    }
  }

  const ownerPhone = unit.custom_data?.owner_phone as string | undefined;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        {!embedded && (
          <Button asChild variant="ghost" size="icon">
            <Link href="/inventory">
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{unit.unit_number}</h1>
          {(unit.custom_data?.project_name ?? unit.projects?.name) && (
            <p className="truncate text-sm text-muted-foreground">
              {(unit.custom_data?.project_name as string) ?? unit.projects?.name}
            </p>
          )}
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete unit">
              <Trash2 className="text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete unit?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {unit.unit_number}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShareOpen(true)}
          aria-label="Share unit"
        >
          <Share2 />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label="Edit unit">
          <Pencil />
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={unit.status} />
        </div>
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
          {Boolean(unit.custom_data?.property_type) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Property Type</span>
              <span className="font-medium capitalize">{String(unit.custom_data.property_type)}</span>
            </div>
          )}

          {Boolean(unit.custom_data?.project_name) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium">{String(unit.custom_data.project_name)}</span>
            </div>
          )}

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
        <InventoryMediaUploader unit={unit} />
      </section>

      {(Boolean(unit.custom_data?.owner_name) || Boolean(ownerPhone)) && (
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold">Owner Details</h2>
          <div className="flex flex-col gap-2 text-sm">
            {Boolean(unit.custom_data?.owner_name) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{String(unit.custom_data.owner_name)}</span>
              </div>
            )}
            {Boolean(ownerPhone) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{ownerPhone}</span>
              </div>
            )}
          </div>
          {ownerPhone && (
            <div className="mt-3 flex gap-2">
              <Button asChild className="flex-1" size="lg" variant="outline" onClick={logOwnerCall}>
                <a href={`tel:${phoneToTel(ownerPhone)}`}>
                  <Phone data-icon="inline-start" />
                  Call
                </a>
              </Button>
              <Button asChild className="flex-1" size="lg" onClick={logOwnerWhatsApp}>
                <a
                  href={`https://wa.me/${phoneToWhatsApp(ownerPhone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle data-icon="inline-start" />
                  WhatsApp
                </a>
              </Button>
            </div>
          )}
        </section>
      )}

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
        <h2 className="mb-3 text-sm font-semibold">Activity</h2>
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-2 border-b border-border pb-3 last:border-0">
              <span className="text-base">{NOTE_TYPE_CONFIG[note.note_type].icon}</span>
              <div className="flex-1">
                <p className="text-sm">{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeDate(note.created_at)}
                </p>
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex gap-2">
            {(Object.keys(NOTE_TYPE_CONFIG) as NoteType[]).map((type) => (
              <Button
                key={type}
                type="button"
                variant={noteType === type ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setNoteType(type)}
              >
                {NOTE_TYPE_CONFIG[type].icon}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Add a note…"
            className="h-12"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
          />
          <Button onClick={handleAddNote} disabled={!noteContent.trim()}>
            Save Note
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Linked Leads</h2>
        {linkedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads linked to this unit</p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3"
              >
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between text-sm hover:opacity-80"
                >
                  <span className="font-medium">{lead.name}</span>
                  {lead.pipeline_stages && (
                    <StageBadge
                      label={lead.pipeline_stages.label}
                      color={lead.pipeline_stages.color}
                    />
                  )}
                </Link>
                {lead.phone && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={`tel:${phoneToTel(lead.phone)}`}>
                      <Phone data-icon="inline-start" />
                      Call
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <UnitForm open={editOpen} onOpenChange={setEditOpen} unit={unit} />
      <InventoryShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        units={[unit]}
      />
    </div>
  );
}
