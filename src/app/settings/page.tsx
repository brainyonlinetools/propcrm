"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { FolderKanban, GripVertical, Moon, Plus, Sun, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  useCreateFieldDefinition,
  useDeleteFieldDefinition,
  useFieldDefinitions,
  useReorderFieldDefinitions,
  useUpdateFieldDefinition,
} from "@/lib/queries/fieldDefinitions";
import {
  useCreatePipelineStage,
  useDeletePipelineStage,
  usePipelineStages,
  useReorderPipelineStages,
  useUpdatePipelineStage,
} from "@/lib/queries/pipelineStages";
import {
  useCreateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  useUpdateWhatsAppTemplate,
  useWhatsAppTemplates,
} from "@/lib/queries/whatsappTemplates";
import { getAgentName, setAgentName, slugify } from "@/lib/utils";
import { getWhatsAppTemplateVariables } from "@/lib/whatsappTemplates";
import type { EntityType, FieldDefinition, FieldType } from "@/types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi-select" },
  { value: "date", label: "Date" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "textarea", label: "Textarea" },
  { value: "boolean", label: "Yes/No" },
];

export default function SettingsPage() {
  const [agentName, setAgentNameState] = useState(getAgentName);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  function handleAgentNameSave(value: string) {
    setAgentNameState(value);
    setAgentName(value);
    toast.success("Agent name saved");
  }

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-xs text-muted-foreground">
              {theme === "system"
                ? "Following system preference"
                : isDark
                  ? "Dark mode — ink on canvas-soft"
                  : "Light mode — canvas-soft background"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </section>

      <Tabs defaultValue="lead-fields">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="lead-fields" className="px-1 text-xs sm:text-sm">
            Lead Fields
          </TabsTrigger>
          <TabsTrigger value="inventory-fields" className="px-1 text-xs sm:text-sm">
            Inventory
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="px-1 text-xs sm:text-sm">
            Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lead-fields" className="mt-4">
          <FieldDefinitionsManager entityType="lead" />
        </TabsContent>

        <TabsContent value="inventory-fields" className="mt-4">
          <FieldDefinitionsManager entityType="inventory" />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4 flex flex-col gap-6">
          <PipelineManager />
          <ProjectsLinkCard />
          <section className="rounded-lg border border-border bg-card p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Agent Name</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Used in WhatsApp message pre-fill on lead detail.
            </p>
            <Input
              className="h-12"
              placeholder="Your name"
              value={agentName}
              onChange={(e) => handleAgentNameSave(e.target.value)}
            />
          </section>
          <WhatsAppTemplatesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FieldDefinitionsManager({ entityType }: { entityType: EntityType }) {
  const { data: fields = [] } = useFieldDefinitions(entityType);
  const createField = useCreateFieldDefinition();
  const updateField = useUpdateFieldDefinition();
  const deleteField = useDeleteFieldDefinition();
  const reorderFields = useReorderFieldDefinitions();

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function handleAdd() {
    if (!label.trim()) return;
    try {
      await createField.mutateAsync({
        entity_type: entityType,
        field_key: slugify(label),
        label: label.trim(),
        field_type: fieldType,
        options:
          fieldType === "select" || fieldType === "multiselect"
            ? options.split(",").map((o) => o.trim()).filter(Boolean)
            : null,
        is_required: isRequired,
        show_in_card: true,
        sort_order: fields.length,
      });
      setLabel("");
      setOptions("");
      setIsRequired(false);
      setShowAdd(false);
      toast.success("Field added");
    } catch {
      toast.error("Failed to add field");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex);
    await reorderFields.mutateAsync({
      entityType,
      orderedIds: reordered.map((f) => f.id),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.map((field) => (
            <SortableFieldRow
              key={field.id}
              field={field}
              entityType={entityType}
              onUpdate={(updates) =>
                updateField.mutateAsync({ id: field.id, entityType, ...updates })
              }
              onDelete={() =>
                deleteField.mutateAsync({ id: field.id, entityType })
              }
            />
          ))}
        </SortableContext>
      </DndContext>

      {showAdd ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Label</Label>
              <Input className="h-12" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(fieldType === "select" || fieldType === "multiselect") && (
              <div className="flex flex-col gap-2">
                <Label>Options (comma-separated)</Label>
                <Input
                  className="h-12"
                  placeholder="Option 1, Option 2"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              Required
            </label>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={!label.trim()}>
                Save Field
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)}>
          <Plus data-icon="inline-start" />
          Add Field
        </Button>
      )}
    </div>
  );
}

function SortableFieldRow({
  field,
  entityType,
  onUpdate,
  onDelete,
}: {
  field: FieldDefinition;
  entityType: EntityType;
  onUpdate: (updates: Partial<FieldDefinition>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-card sm:flex-nowrap"
    >
      <button type="button" className="touch-target shrink-0" {...attributes} {...listeners}>
        <GripVertical className="text-muted-foreground" />
      </button>
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="truncate text-sm font-medium">{field.label}</p>
        <p className="text-xs text-muted-foreground">{field.field_type}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <label className="flex items-center gap-1 text-xs">
          <Switch
            checked={field.is_required}
            onCheckedChange={(v) => onUpdate({ is_required: v })}
          />
          Req
        </label>
        <label className="flex items-center gap-1 text-xs">
          <Switch
            checked={field.show_in_card}
            onCheckedChange={(v) => onUpdate({ show_in_card: v })}
          />
          Card
        </label>
        <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Trash2 className="text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{field.label}&quot; from {entityType} forms. Existing data in custom_data will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await onDelete();
                  toast.success("Field deleted");
                } catch {
                  toast.error("Failed to delete field");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

function PipelineManager() {
  const { data: stages = [] } = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const updateStage = useUpdatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const reorderStages = useReorderPipelineStages();
  const [newLabel, setNewLabel] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function handleAddStage() {
    if (!newLabel.trim()) return;
    try {
      await createStage.mutateAsync({
        label: newLabel.trim(),
        color: "#888888",
        sort_order: stages.length,
      });
      setNewLabel("");
      toast.success("Stage added");
    } catch {
      toast.error("Failed to add stage");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(stages, oldIndex, newIndex);
    await reorderStages.mutateAsync(reordered.map((s) => s.id));
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold">Pipeline Stages</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {stages.map((stage) => (
              <SortableStageRow
                key={stage.id}
                stage={stage}
                onUpdate={(updates) => updateStage.mutateAsync({ id: stage.id, ...updates })}
                onDelete={() => deleteStage.mutateAsync(stage.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          className="h-12 flex-1"
          placeholder="New stage name"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Button className="shrink-0" onClick={handleAddStage} disabled={!newLabel.trim()}>
          Add
        </Button>
      </div>
    </section>
  );
}

function SortableStageRow({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: { id: string; label: string; color: string };
  onUpdate: (updates: { label?: string; color?: string }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stage.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 sm:flex-nowrap"
    >
      <button type="button" className="shrink-0" {...attributes} {...listeners}>
        <GripVertical className="text-muted-foreground" />
      </button>
      <input
        type="color"
        value={stage.color}
        onChange={(e) => onUpdate({ color: e.target.value })}
        className="size-8 shrink-0 cursor-pointer rounded border border-border"
      />
      <Input
        className="h-9 min-w-0 flex-1 basis-full sm:basis-auto"
        defaultValue={stage.label}
        onBlur={(e) => {
          if (e.target.value !== stage.label) onUpdate({ label: e.target.value });
        }}
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Trash2 className="text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              Stages with assigned leads cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await onDelete();
                  toast.success("Stage deleted");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to delete stage");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectsLinkCard() {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Projects</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage project details, photos, videos, and sharing from the Projects page.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">
            <FolderKanban data-icon="inline-start" />
            Open
          </Link>
        </Button>
      </div>
    </section>
  );
}

function WhatsAppTemplatesManager() {
  const { data: templates = [] } = useWhatsAppTemplates();
  const { data: leadFields = [] } = useFieldDefinitions("lead");
  const createTemplate = useCreateWhatsAppTemplate();
  const updateTemplate = useUpdateWhatsAppTemplate();
  const deleteTemplate = useDeleteWhatsAppTemplate();

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [activeBodyId, setActiveBodyId] = useState<string | null>(null);

  const variables = getWhatsAppTemplateVariables(leadFields);

  async function handleAdd() {
    if (!name.trim() || !body.trim()) return;
    try {
      await createTemplate.mutateAsync({ name: name.trim(), body: body.trim() });
      setName("");
      setBody("");
      toast.success("Template added");
    } catch {
      toast.error("Failed to add template");
    }
  }

  function insertVariable(token: string, target: "new" | string) {
    const insertion = `{{${token}}}`;
    if (target === "new") {
      setBody((prev) => prev + insertion);
      return;
    }
    const textarea = document.getElementById(`wa-template-body-${target}`) as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const next = current.slice(0, start) + insertion + current.slice(end);
    textarea.value = next;
    updateTemplate.mutate({ id: target, body: next });
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h2 className="mb-1 text-sm font-semibold">WhatsApp Templates</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Saved messages for batch and single-lead WhatsApp. Tap a variable to insert it.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {variables.map((variable) => (
          <button
            key={variable.key}
            type="button"
            onClick={() => insertVariable(variable.key, activeBodyId ?? "new")}
            className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {`{{${variable.key}}}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            <Input
              className="h-9"
              defaultValue={template.name}
              onBlur={(e) => {
                if (e.target.value !== template.name) {
                  updateTemplate.mutate({ id: template.id, name: e.target.value });
                }
              }}
            />
            <Textarea
              id={`wa-template-body-${template.id}`}
              className="min-h-24"
              defaultValue={template.body}
              onFocus={() => setActiveBodyId(template.id)}
              onBlur={(e) => {
                if (e.target.value !== template.body) {
                  updateTemplate.mutate({ id: template.id, body: e.target.value });
                }
              }}
            />
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Trash2 className="text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete template?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This template will be removed from batch WhatsApp options.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteTemplate.mutateAsync(template.id);
                          toast.success("Template deleted");
                        } catch {
                          toast.error("Failed to delete template");
                        }
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <Input
          className="h-12"
          placeholder="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          className="min-h-24"
          placeholder="Hi {{name}}, this is {{agent}} from Anand Prime..."
          value={body}
          onFocus={() => setActiveBodyId(null)}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button onClick={handleAdd} disabled={!name.trim() || !body.trim()}>
          Add Template
        </Button>
      </div>
    </section>
  );
}
