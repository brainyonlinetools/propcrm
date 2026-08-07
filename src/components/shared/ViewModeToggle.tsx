"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ListViewMode = "table" | "gallery";

interface ViewModeToggleProps {
  value: ListViewMode;
  onChange: (value: ListViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant={value === "table" ? "secondary" : "ghost"}
        size="icon"
        onClick={() => onChange("table")}
        aria-label="Table view"
        aria-pressed={value === "table"}
      >
        <Table2 />
      </Button>
      <Button
        type="button"
        variant={value === "gallery" ? "secondary" : "ghost"}
        size="icon"
        onClick={() => onChange("gallery")}
        aria-label="Gallery view"
        aria-pressed={value === "gallery"}
      >
        <LayoutGrid />
      </Button>
    </div>
  );
}
