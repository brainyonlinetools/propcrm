import { describe, expect, it } from "vitest";
import { splitOverdueToday } from "@/lib/todayList";

interface Item {
  id: string;
  date: string | null;
}

const items: Item[] = [
  { id: "today-b", date: "2026-10-09" },
  { id: "future", date: "2026-10-10" },
  { id: "overdue-b", date: "2026-10-08" },
  { id: "undated", date: null },
  { id: "today-a", date: "2026-10-09" },
  { id: "overdue-a", date: "2026-10-07" },
];

describe("splitOverdueToday", () => {
  it("partitions overdue vs due-today and drops future/undated items", () => {
    const { overdue, today } = splitOverdueToday(items, (i) => i.date, "2026-10-09");
    expect(overdue.map((i) => i.id).sort()).toEqual(["overdue-a", "overdue-b"]);
    expect(today.map((i) => i.id).sort()).toEqual(["today-a", "today-b"]);
  });

  it("sorts each bucket oldest-first", () => {
    const { overdue, today } = splitOverdueToday(items, (i) => i.date, "2026-10-09");
    expect(overdue.map((i) => i.id)).toEqual(["overdue-a", "overdue-b"]);
    expect(today.map((i) => i.id)).toEqual(["today-b", "today-a"]);
  });

  it("returns empty buckets when nothing is due", () => {
    const { overdue, today } = splitOverdueToday(items, (i) => i.date, "2026-10-01");
    expect(overdue).toEqual([]);
    expect(today).toEqual([]);
  });
});
