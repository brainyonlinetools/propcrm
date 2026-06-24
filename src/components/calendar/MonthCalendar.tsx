"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DayTaskMeta {
  count: number;
  hasOverdue: boolean;
}

interface MonthCalendarProps {
  month: Date;
  selected: Date;
  onSelectDay: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  taskMetaByDate: Map<string, DayTaskMeta>;
}

export function MonthCalendar({
  month,
  selected,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onToday,
  taskMetaByDate,
}: MonthCalendarProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" onClick={onPrevMonth} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <button
          type="button"
          onClick={onToday}
          className="text-sm font-semibold tracking-tight hover:text-brand-accent"
        >
          {format(month, "MMMM yyyy")}
        </button>
        <Button variant="ghost" size="icon-sm" onClick={onNextMonth} aria-label="Next month">
          <ChevronRight />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-[10px] font-medium text-muted-foreground uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const meta = taskMetaByDate.get(key);
          const inMonth = isSameMonth(day, month);
          const selectedDay = isSameDay(day, selected);
          const today = isToday(day);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && !selectedDay && "hover:bg-muted/60",
                selectedDay && "bg-primary text-primary-foreground",
                today && !selectedDay && "ring-1 ring-brand-accent"
              )}
            >
              <span className={cn("font-medium", today && !selectedDay && "text-brand-accent")}>
                {format(day, "d")}
              </span>
              {meta && meta.count > 0 && (
                <span className="mt-0.5 flex items-center gap-0.5">
                  {meta.hasOverdue ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        selectedDay ? "bg-primary-foreground" : "bg-destructive"
                      )}
                    />
                  ) : (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        selectedDay ? "bg-primary-foreground" : "bg-brand-accent"
                      )}
                    />
                  )}
                  {meta.count > 1 && (
                    <span
                      className={cn(
                        "text-[9px] leading-none",
                        selectedDay ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {meta.count}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function buildTaskMetaByDate(
  tasks: Array<{ due_date: string | null; is_done: boolean }>
): Map<string, DayTaskMeta> {
  const map = new Map<string, DayTaskMeta>();
  const today = startOfDay(new Date());

  for (const task of tasks) {
    if (!task.due_date || task.is_done) continue;
    const key = task.due_date;
    const existing = map.get(key) ?? { count: 0, hasOverdue: false };
    const dueDay = startOfDay(parseISO(task.due_date));
    const isOverdue = dueDay < today;
    map.set(key, {
      count: existing.count + 1,
      hasOverdue: existing.hasOverdue || isOverdue,
    });
  }

  return map;
}

export { addMonths, subMonths };
