import { describe, expect, it } from "vitest";
import {
  buildTrackedRowMap,
  insertWithFallback,
  mapWithConcurrency,
} from "./connectedSheetSync";

describe("insertWithFallback", () => {
  it("inserts in chunks and reports every item as succeeded", async () => {
    const seen: number[][] = [];
    const { succeeded, failed } = await insertWithFallback(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (chunk) => {
        seen.push(chunk);
      },
      async () => {
        throw new Error("single insert should not run");
      }
    );
    expect(seen).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
    expect(succeeded).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(failed).toEqual([]);
  });

  it("retries a failed chunk row by row and isolates the bad row", async () => {
    const singles: number[] = [];
    const { succeeded, failed } = await insertWithFallback(
      [1, 2, 3],
      10,
      async () => {
        throw new Error("chunk boom");
      },
      async (item) => {
        singles.push(item);
        if (item === 2) throw new Error("row boom");
      }
    );
    expect(singles).toEqual([1, 2, 3]);
    expect(succeeded).toEqual([1, 3]);
    expect(failed).toEqual([{ item: 2, message: "row boom" }]);
  });

  it("handles empty input without calling insert", async () => {
    let calls = 0;
    const result = await insertWithFallback(
      [],
      500,
      async () => {
        calls++;
      },
      async () => {
        calls++;
      }
    );
    expect(calls).toBe(0);
    expect(result).toEqual({ succeeded: [], failed: [] });
  });
});

describe("mapWithConcurrency", () => {
  it("processes every item", async () => {
    const processed: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      processed.push(item);
    });
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

});

describe("buildTrackedRowMap", () => {
  it("indexes tracked rows for this sheet and tab only", () => {
    const map = buildTrackedRowMap(
      [
        { id: "a", custom_data: { sheet_id: "s1", sheet_tab: "Leads", sheet_row: 5 } },
        { id: "b", custom_data: { sheet_id: "s1", sheet_tab: "Leads", sheet_row: "x" } },
        { id: "c", custom_data: { sheet_id: "s1", sheet_tab: "Inventory", sheet_row: 5 } },
        { id: "d", custom_data: { sheet_id: "s2", sheet_tab: "Leads", sheet_row: 6 } },
        { id: "e", custom_data: null },
      ],
      "s1",
      "Leads"
    );
    expect(map).toEqual(new Map([[5, "a"]]));
  });

  it("keeps the first lead when two share a row", () => {
    const map = buildTrackedRowMap(
      [
        { id: "first", custom_data: { sheet_id: "s1", sheet_tab: "Leads", sheet_row: 9 } },
        { id: "second", custom_data: { sheet_id: "s1", sheet_tab: "Leads", sheet_row: 9 } },
      ],
      "s1",
      "Leads"
    );
    expect(map.get(9)).toBe("first");
  });
});

describe("mapWithConcurrency", () => {
  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    let done = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      done++;
    });
    expect(done).toBe(10);
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1);
  });
});
