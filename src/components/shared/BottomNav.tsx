"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, CheckSquare, FolderKanban, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/share") || pathname.startsWith("/~offline")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 transition-colors",
                isActive ? "text-brand-accent" : "text-mute"
              )}
            >
              <Icon className={cn("size-5 shrink-0", isActive && "text-brand-accent")} />
              <span
                className={cn(
                  "w-full truncate text-center text-[10px] font-medium",
                  isActive ? "text-brand-accent" : "text-mute"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
