"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LeadCard } from "@/components/leads/LeadCard";
import { useUpdateLeadStage } from "@/lib/queries/leads";
import type { Lead, PipelineStage } from "@/types";

interface LeadKanbanProps {
  leads: Lead[];
  stages: PipelineStage[];
  className?: string;
}

export function LeadKanban({ leads, stages, className }: LeadKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const updateStage = useUpdateLeadStage();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeLead = leads.find((l) => l.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const stageId = String(over.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage_id === stageId) return;

    try {
      await updateStage.mutateAsync({ id: leadId, stage_id: stageId });
    } catch {
      toast.error("Failed to update stage");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("flex gap-3 overflow-x-auto pb-4", className)}>
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage_id === stage.id);
          return (
            <KanbanColumn key={stage.id} stage={stage} leads={stageLeads} />
          );
        })}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="w-72 rotate-2 opacity-90">
            <LeadCard lead={activeLead} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  stage,
  leads,
}: {
  stage: PipelineStage;
  leads: Lead[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[min(100%,18rem)] shrink-0 flex-col gap-2 rounded-lg bg-secondary/50 p-2 ${
        isOver ? "ring-2 ring-brand-accent" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-1 py-1">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="text-sm font-medium">{stage.label}</h3>
        <span className="text-xs text-muted-foreground">({leads.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id });

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? "opacity-40" : ""}
    >
      <LeadCard lead={lead} />
    </div>
  );
}
