"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SellerForm } from "@/components/sellers/SellerForm";
import {
  useCreateSellerNote,
  useDeleteSeller,
  useSeller,
  useSellerNotes,
  useUpdateSeller,
} from "@/lib/queries/sellers";
import { useInventory } from "@/lib/queries/inventory";
import {
  formatCurrency,
  formatDisplayDate,
  formatPhone,
  formatRelativeDate,
  phoneToTel,
  phoneToWhatsApp,
} from "@/lib/utils";
import { NOTE_TYPE_CONFIG, type NoteType } from "@/types";

interface SellerDetailPanelProps {
  id: string;
  embedded?: boolean;
  onDeleted?: () => void;
}

export function SellerDetailPanel({
  id,
  embedded = false,
  onDeleted,
}: SellerDetailPanelProps) {
  const router = useRouter();
  const { data: seller, isLoading } = useSeller(id);
  const { data: notes = [] } = useSellerNotes(id);
  const { data: units = [] } = useInventory();
  const updateSeller = useUpdateSeller();
  const deleteSeller = useDeleteSeller();
  const createNote = useCreateSellerNote();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>("note");
  const [noteContent, setNoteContent] = useState("");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Seller not found</p>
        {!embedded && (
          <Button asChild variant="link" className="mt-2">
            <Link href="/sellers">Back to sellers</Link>
          </Button>
        )}
      </div>
    );
  }

  const linkedUnit = units.find((u) => u.seller_id === seller.id) ?? null;
  const unitLabel = [seller.tower, seller.unit_number].filter(Boolean).join(" ") || null;

  async function handleToggleForSale(next: boolean) {
    try {
      const result = await updateSeller.mutateAsync({
        id,
        available_for_sale: next,
      });
      if (result.inventoryAction === "created") {
        toast.success("Unit listed in inventory");
      } else if (result.inventoryAction === "updated") {
        toast.success("Inventory listing updated");
      } else if (result.inventoryAction === "marked_sold") {
        toast.success("Inventory unit marked sold");
      } else {
        toast.success(next ? "Marked available for sale" : "Removed from sale");
      }
      if (result.warning) toast.warning(result.warning);
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDelete() {
    try {
      await deleteSeller.mutateAsync(id);
      toast.success("Seller deleted");
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/sellers");
      }
    } catch {
      toast.error("Failed to delete seller");
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    try {
      await createNote.mutateAsync({
        seller_id: id,
        content: noteContent.trim(),
        note_type: noteType,
      });
      setNoteContent("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  }

  async function logContact(noteTypeValue: NoteType, content: string) {
    try {
      await createNote.mutateAsync({
        seller_id: id,
        content,
        note_type: noteTypeValue,
      });
    } catch {
      // silent fail
    }
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Phone", value: seller.contact_phone ? formatPhone(seller.contact_phone) : null },
    { label: "Alternate phone", value: seller.alt_phone ? formatPhone(seller.alt_phone) : null },
    { label: "Email", value: seller.email },
    { label: "Project", value: seller.projects?.name ?? null },
    { label: "Tower / Block", value: seller.tower },
    { label: "Unit", value: seller.unit_number },
    { label: "Floor", value: seller.floor != null ? String(seller.floor) : null },
    { label: "Configuration", value: seller.configuration },
    {
      label: "Area",
      value: seller.area_sqft != null ? `${seller.area_sqft.toLocaleString("en-IN")} sq.ft.` : null,
    },
    { label: "Facing", value: seller.facing },
    { label: "Parking slots", value: seller.parking != null ? String(seller.parking) : null },
    {
      label: "Asking price",
      value: seller.asking_price != null ? formatCurrency(seller.asking_price) : null,
    },
    {
      label: "Follow-up",
      value: seller.follow_up_date ? formatDisplayDate(seller.follow_up_date) : null,
    },
    {
      label: "Last call",
      value: seller.last_called_at ? formatRelativeDate(seller.last_called_at) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        {!embedded && (
          <Button asChild variant="ghost" size="icon">
            <Link href="/sellers">
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{seller.owner_name}</h1>
          {(unitLabel || seller.projects?.name) && (
            <p className="truncate text-sm text-muted-foreground">
              {[unitLabel, seller.projects?.name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete seller">
              <Trash2 className="text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete seller?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {seller.owner_name}? A linked
                inventory unit is kept and unlinked. This cannot be undone.
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
        <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label="Edit seller">
          <Pencil />
        </Button>
      </div>

      <section className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <div>
          <p className="text-sm font-semibold">Available for sale</p>
          <p className="text-xs text-muted-foreground">
            {seller.available_for_sale
              ? "Listed in inventory and kept in sync."
              : "Turn on to copy this unit to inventory."}
          </p>
        </div>
        <Switch
          checked={seller.available_for_sale}
          onCheckedChange={handleToggleForSale}
          disabled={updateSeller.isPending}
          aria-label="Available for sale"
        />
      </section>

      {seller.contact_phone && (
        <div className="flex gap-2">
          <Button
            asChild
            className="flex-1"
            size="lg"
            variant="outline"
            onClick={() => logContact("call", "Call initiated")}
          >
            <a href={`tel:${phoneToTel(seller.contact_phone)}`}>
              <Phone data-icon="inline-start" />
              Call
            </a>
          </Button>
          <Button
            asChild
            className="flex-1"
            size="lg"
            onClick={() => logContact("whatsapp", "WhatsApp message sent")}
          >
            <a
              href={`https://wa.me/${phoneToWhatsApp(seller.contact_phone)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle data-icon="inline-start" />
              WhatsApp
            </a>
          </Button>
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Seller Details</h2>
        <div className="flex flex-col gap-2.5">
          {details
            .filter((d) => d.value)
            .map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="shrink-0 text-muted-foreground">{d.label}</span>
                <span className="truncate font-medium">{d.value}</span>
              </div>
            ))}
          {details.every((d) => !d.value) && (
            <p className="text-sm text-muted-foreground">No details added yet</p>
          )}
        </div>
      </section>

      {seller.remarks && (
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold">Remarks</h2>
          <p className="text-sm whitespace-pre-wrap">{seller.remarks}</p>
        </section>
      )}

      {linkedUnit && (
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold">Inventory Listing</h2>
          <Link
            href={`/inventory/${linkedUnit.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{linkedUnit.unit_number}</span>
            </span>
            <StatusBadge status={linkedUnit.status} className="shrink-0" />
          </Link>
        </section>
      )}

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
          <div className="flex flex-col gap-2">
            <Label htmlFor="seller-note" className="sr-only">
              Add a note
            </Label>
            <Input
              id="seller-note"
              placeholder="Add a note…"
              className="h-12"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            />
          </div>
          <Button onClick={handleAddNote} disabled={!noteContent.trim()}>
            Save Note
          </Button>
        </div>
      </section>

      <SellerForm open={editOpen} onOpenChange={setEditOpen} seller={seller} />
    </div>
  );
}
