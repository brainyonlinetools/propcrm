"use client";

import Link from "next/link";
import { format, isPast, parseISO, startOfDay } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { useToggleTask } from "@/lib/queries/tasks";
import { formatTaskDueTime } from "@/lib/taskReminders";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskItemProps {
  task: Task;
  showLead?: boolean;
}

export function TaskItem({ task, showLead = true }: TaskItemProps) {
  const toggleTask = useToggleTask();
  const isOverdue =
    task.due_date &&
    !task.is_done &&
    isPast(startOfDay(parseISO(task.due_date))) &&
    startOfDay(parseISO(task.due_date)) < startOfDay(new Date());

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-card",
        isOverdue && "border-destructive/40 bg-destructive/5"
      )}
    >
      <Checkbox
        checked={task.is_done}
        onCheckedChange={(checked) =>
          toggleTask.mutate({
            id: task.id,
            is_done: Boolean(checked),
            lead_id: task.lead_id,
          })
        }
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={cn(
            "text-sm font-medium",
            task.is_done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {showLead && task.leads && (
          <Link
            href={`/leads/${task.leads.id}`}
            className="text-xs text-brand-accent hover:underline"
          >
            {task.leads.name}
          </Link>
        )}
        {task.due_date && (
          <p
            className={cn(
              "text-xs",
              isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
            )}
          >
            {isOverdue ? "Overdue · " : ""}
            {format(parseISO(task.due_date), "d MMM yyyy")}
            {" · "}
            {formatTaskDueTime(task.due_time)} IST
          </p>
        )}
      </div>
    </div>
  );
}
