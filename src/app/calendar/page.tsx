"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  subMonths,
} from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TaskItem } from "@/components/tasks/TaskItem";
import {
  MonthCalendar,
  buildTaskMetaByDate,
} from "@/components/calendar/MonthCalendar";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { useTasks } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading, isError } = useTasks(false);

  const taskMetaByDate = useMemo(() => buildTaskMetaByDate(tasks), [tasks]);

  const selectedDayTasks = useMemo(() => {
    return tasks.filter(
      (task) => task.due_date && isSameDay(parseISO(task.due_date), selected)
    );
  }, [tasks, selected]);

  const upcomingTasks = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addMonths(start, 1);
    return tasks
      .filter((task) => {
        if (!task.due_date || task.is_done) return false;
        const due = parseISO(task.due_date);
        return (
          isWithinInterval(due, { start, end }) &&
          due >= start &&
          !isSameDay(due, selected)
        );
      })
      .sort((a, b) => {
        if (!a.due_date || !b.due_date) return 0;
        return a.due_date.localeCompare(b.due_date);
      });
  }, [tasks, selected]);

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !task.due_date && !task.is_done),
    [tasks]
  );

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  function goToToday() {
    const today = startOfDay(new Date());
    setMonth(today);
    setSelected(today);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
        <p className="text-xs text-muted-foreground">Upcoming tasks & follow-ups</p>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="text-base font-semibold">Could not load calendar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your Supabase connection.
            </p>
            <Button className="mt-4" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <MonthCalendar
              month={month}
              selected={selected}
              onSelectDay={setSelected}
              onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setMonth((m) => addMonths(m, 1))}
              onToday={goToToday}
              taskMetaByDate={taskMetaByDate}
            />

            <DayTaskSection
              title={isSameDay(selected, new Date()) ? "Today" : format(selected, "EEEE, d MMM")}
              tasks={selectedDayTasks}
              emptyMessage="No follow-ups scheduled for this day."
            />

            {upcomingTasks.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Next 30 days
                </h2>
                <div className="flex flex-col gap-2">
                  {groupTasksByDate(upcomingTasks).map(({ date, items }) => (
                    <div key={date}>
                      <button
                        type="button"
                        onClick={() => {
                          const d = parseISO(date);
                          setSelected(d);
                          setMonth(d);
                        }}
                        className={cn(
                          "mb-1.5 text-xs font-medium",
                          isSameDay(parseISO(date), selected)
                            ? "text-brand-accent"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {format(parseISO(date), "EEE, d MMM")}
                      </button>
                      <div className="flex flex-col gap-2">
                        {items.map((task) => (
                          <TaskItem key={task.id} task={task} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {unscheduledTasks.length > 0 && (
              <DayTaskSection
                title="Unscheduled"
                tasks={unscheduledTasks}
                emptyMessage=""
              />
            )}

            {tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <h2 className="text-base font-semibold">No follow-ups yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Schedule tasks from a lead&apos;s detail page to see them here.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/leads">View leads</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

function DayTaskSection({
  title,
  tasks,
  emptyMessage,
}: {
  title: string;
  tasks: Task[];
  emptyMessage: string;
}) {
  if (tasks.length === 0 && !emptyMessage) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}

function groupTasksByDate(tasks: Task[]): Array<{ date: string; items: Task[] }> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const existing = groups.get(task.due_date) ?? [];
    existing.push(task);
    groups.set(task.due_date, existing);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}
