"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const AVATAR_TONES = [
  "bg-emerald-600 text-white",
  "bg-sky-600 text-white",
  "bg-violet-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-teal-600 text-white",
  "bg-indigo-600 text-white",
  "bg-orange-600 text-white",
] as const;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function avatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

interface ContactListRowProps {
  name: string;
  subtitle?: string | null;
  meta?: ReactNode;
  badge?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ContactListRow({
  name,
  subtitle,
  meta,
  badge,
  selected = false,
  onClick,
  className,
}: ContactListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors",
        selected ? "bg-muted" : "hover:bg-muted/60",
        className
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          avatarTone(name)
        )}
        aria-hidden
      >
        {initialsFromName(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {meta ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{meta}</span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          {subtitle ? (
            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          ) : (
            <span />
          )}
          {badge}
        </span>
      </span>
    </button>
  );
}
