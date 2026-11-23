"use client";

import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";

const CHIPS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "+3 days", days: 3 },
  { label: "+1 week", days: 7 },
];

/** Quick date shortcuts for one-handed use. `value`/`onChange` use yyyy-MM-dd. */
export function DateChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CHIPS.map(({ label, days }) => {
        const v = format(addDays(new Date(), days), "yyyy-MM-dd");
        return (
          <Button
            key={label}
            type="button"
            variant={value === v ? "secondary" : "outline"}
            className="h-11 px-1 text-xs"
            onClick={() => onChange(v)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
