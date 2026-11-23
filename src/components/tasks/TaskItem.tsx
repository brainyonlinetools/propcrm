"use client";

import Link from "next/link";
import { format, isPast, parseISO, startOfDay } from "date-fns";
import { toast } from "sonner";
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
  function toggle(next: boolean) {
    const vars = { id: task.id, is_done: next, lead_id: task.lead_id };
    toggleTask.mutate(vars);
    // Shown immediately: the row may unmount as soon as the list updates.
    if (next) {
      toast("Task done", {
        action: {
          label: "Undo",
          onClick: () => toggleTask.mutate({ ...vars, is_done: false }),
        },
      });
    }
  }

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
      {/* 44px tap area around the 16px checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.is_done}
        aria-label={task.is_done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        className="-m-2 flex size-11 shrink-0 items-center justify-center"
        onClick={() => toggle(!task.is_done)}
      >
        <Checkbox checked={task.is_done} tabIndex={-1} className="pointer-events-none size-5" />
      </button>
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
