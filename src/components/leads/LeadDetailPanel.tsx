"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { StageBadge } from "@/components/shared/StatusBadge";
import { CallButton } from "@/components/shared/CallButton";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";
import { LeadForm } from "@/components/leads/LeadForm";
import { TaskItem } from "@/components/tasks/TaskItem";
import { useDeleteLead, useLead, useUpdateLead } from "@/lib/queries/leads";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { useInventory } from "@/lib/queries/inventory";
import {
  useCreateLeadNote,
  useCreateTask,
  useLeadNotes,
  useLeadTasks,
} from "@/lib/queries/tasks";
import { formatPhone, formatDisplayDate, formatRelativeDate } from "@/lib/utils";
import { DEFAULT_TASK_REMINDER_TIME } from "@/lib/taskReminders";
import { NOTE_TYPE_CONFIG, type NoteType } from "@/types";

interface LeadDetailPanelProps {
  id: string;
  /** Hide back link when shown inside the desktop split pane. */
  embedded?: boolean;
  onDeleted?: () => void;
}

export function LeadDetailPanel({ id, embedded = false, onDeleted }: LeadDetailPanelProps) {
  const router = useRouter();
  const { data: lead, isLoading } = useLead(id);
  const { data: stages = [] } = usePipelineStages();
  const { data: notes = [] } = useLeadNotes(id);
  const { data: tasks = [] } = useLeadTasks(id);
  const { data: inventory = [] } = useInventory();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const createNote = useCreateLeadNote();
  const createTask = useCreateTask();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>("note");
  const [noteContent, setNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Lead not found</p>
        {!embedded && (
          <Button asChild variant="link" className="mt-2">
            <Link href="/leads">Back to leads</Link>
          </Button>
        )}
      </div>
    );
  }

  const linkedUnit = inventory.find((u) => u.id === lead.linked_unit_id);

  const additionalPhones: string[] = Array.isArray(lead.custom_data?.additional_phones)
    ? (lead.custom_data.additional_phones as unknown[]).filter(
        (p): p is string => typeof p === "string" && Boolean(p)
      )
    : [];
  const contactNumbers: { phone: string; label: string | null }[] = [
    ...(lead.phone ? [{ phone: lead.phone, label: null as string | null }] : []),
    ...(lead.alt_phone ? [{ phone: lead.alt_phone, label: "Alt" as string | null }] : []),
    ...additionalPhones.map((phone, i) => ({ phone, label: `Phone ${i + 3}` })),
  ];

  async function copyPhone(phone: string) {
    await navigator.clipboard.writeText(phone);
    toast.success("Phone copied");
  }

  async function handleStageChange(stageId: string) {
    try {
      await updateLead.mutateAsync({ id: lead!.id, stage_id: stageId });
      toast.success("Stage updated");
    } catch {
      toast.error("Failed to update stage");
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    try {
      await createNote.mutateAsync({
        lead_id: id,
        content: noteContent.trim(),
        note_type: noteType,
      });
      setNoteContent("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        lead_id: id,
        title: taskTitle.trim(),
        due_date: taskDue || null,
        due_time: taskDue ? (taskTime || DEFAULT_TASK_REMINDER_TIME) : null,
      });
      setTaskTitle("");
      setTaskDue("");
      setTaskTime("");
      toast.success("Task added");
    } catch {
      toast.error("Failed to add task");
    }
  }

  async function handleLinkUnit(unitId: string | null) {
    try {
      await updateLead.mutateAsync({ id: lead!.id, linked_unit_id: unitId });
      setUnitSearchOpen(false);
      toast.success(unitId ? "Unit linked" : "Unit unlinked");
    } catch {
      toast.error("Failed to update linked unit");
    }
  }

  async function handleDelete() {
    try {
      const result = await deleteLead.mutateAsync(id);
      toast.success(result.sheetCleared ? "Lead deleted from app and sheet" : "Lead deleted");
      if (result.warning) toast.warning(result.warning);
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/leads");
      }
    } catch {
      toast.error("Failed to delete lead");
    }
  }

  const isSheetTracked = lead.custom_data?.imported_from_sheet === true;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        {!embedded && (
          <Button asChild variant="ghost" size="icon">
            <Link href="/leads">
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{lead.name}</h1>
        <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
          <Pencil />
        </Button>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete lead">
              <Trash2 className="text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete lead?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {lead.name}? This action cannot be undone.
                {isSheetTracked && " Its row will also be removed from the connected sheet."}
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
      </div>

      <section className="flex flex-col gap-3">
        {contactNumbers.map(({ phone, label }, index) => (
          <div key={`${phone}-${index}`} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => copyPhone(phone)}
              className="flex items-center gap-2 text-left text-sm text-muted-foreground"
            >
              {label ? `${label} · ` : ""}
              {formatPhone(phone)}
              <Copy className="size-3.5" />
            </button>
            <div className="flex gap-2">
              <CallButton phone={phone} leadId={lead.id} className="flex-1" />
              <WhatsAppButton lead={lead} phone={phone} className="flex-1" />
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          {lead.pipeline_stages && (
            <StageBadge
              label={lead.pipeline_stages.label}
              color={lead.pipeline_stages.color}
            />
          )}
          <Select value={lead.stage_id ?? ""} onValueChange={handleStageChange}>
            <SelectTrigger className="h-9 w-full min-w-0 max-w-full gap-1 border-none px-2 text-xs shadow-none sm:w-auto">
              <SelectValue placeholder="Change stage" />
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
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <div className="mb-4 flex flex-col gap-2 text-sm">
          {lead.source && (
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span className="shrink-0 text-muted-foreground">Source</span>
              <span className="min-w-0 text-right break-words">{lead.source}</span>
            </div>
          )}
          {lead.project_interest && (
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span className="shrink-0 text-muted-foreground">Project Interest</span>
              <span className="min-w-0 text-right break-words">{lead.project_interest}</span>
            </div>
          )}
          {lead.acquired_date && (
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span className="shrink-0 text-muted-foreground">Lead Date</span>
              <span className="min-w-0 text-right break-words">
                {formatDisplayDate(lead.acquired_date)}
              </span>
            </div>
          )}
          {lead.email && (
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span className="shrink-0 text-muted-foreground">Email</span>
              <span className="min-w-0 text-right break-all">{lead.email}</span>
            </div>
          )}
        </div>
        <DynamicFieldRenderer
          entityType="lead"
          value={lead.custom_data}
          onChange={() => {}}
          mode="view"
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Linked Unit</h2>
        {linkedUnit ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/inventory/${linkedUnit.id}`}
              className="min-w-0 text-sm text-brand-accent break-words hover:underline"
            >
              {linkedUnit.unit_number} — {linkedUnit.projects?.name}
            </Link>
            <Button variant="ghost" size="sm" onClick={() => handleLinkUnit(null)}>
              Unlink
            </Button>
          </div>
        ) : (
          <Popover open={unitSearchOpen} onOpenChange={setUnitSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full">
                Search & link unit
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search units…" />
                <CommandList>
                  <CommandEmpty>No units found</CommandEmpty>
                  <CommandGroup>
                    {inventory.map((unit) => (
                      <CommandItem
                        key={unit.id}
                        value={`${unit.unit_number} ${unit.projects?.name}`}
                        onSelect={() => handleLinkUnit(unit.id)}
                      >
                        {unit.unit_number} — {unit.projects?.name ?? "No project"}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Tasks</h2>
        <div className="mb-3 flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} showLead={false} />
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks yet</p>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Input
            placeholder="Task title"
            className="h-12"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <Input
            type="date"
            className="h-12"
            value={taskDue}
            onChange={(e) => setTaskDue(e.target.value)}
          />
          {taskDue && (
            <div className="flex flex-col gap-1">
              <Input
                type="time"
                className="h-12"
                value={taskTime}
                placeholder="09:00"
                onChange={(e) => setTaskTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Reminder time (optional, defaults to 9:00 AM IST)
              </p>
            </div>
          )}
          <Button onClick={handleAddTask} disabled={!taskTitle.trim()}>
            Add Task
          </Button>
        </div>
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

      <LeadForm open={editOpen} onOpenChange={setEditOpen} lead={lead} />
    </div>
  );
}
