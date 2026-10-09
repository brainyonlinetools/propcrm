"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare, ChevronRight, Settings } from "lucide-react";

const LINKS = [
  {
    href: "/tasks",
    label: "Tasks",
    description: "Follow-ups and reminders",
    icon: CheckSquare,
  },
  {
    href: "/calendar",
    label: "Calendar",
    description: "Tasks by due date",
    icon: CalendarDays,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Stages, fields, templates",
    icon: Settings,
  },
] as const;

export default function MorePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-lg font-semibold tracking-tight">More</h1>
      </header>

      <div className="flex-1 px-4 py-4">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {LINKS.map(({ href, label, description, icon: Icon }, i) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/60 ${
                i < LINKS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
