/**
 * Partition dated follow-ups into overdue vs due-today buckets.
 * Dates are `YYYY-MM-DD` strings, so plain string comparison applies.
 * Undated and future items are excluded; buckets sort oldest-first.
 */
export function splitOverdueToday<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  today: string
): { overdue: T[]; today: T[] } {
  const overdue: T[] = [];
  const dueToday: T[] = [];

  for (const item of items) {
    const date = getDate(item);
    if (!date) continue;
    if (date < today) overdue.push(item);
    else if (date === today) dueToday.push(item);
  }

  const byDate = (a: T, b: T) => (getDate(a) as string).localeCompare(getDate(b) as string);
  overdue.sort(byDate);
  dueToday.sort(byDate);

  return { overdue, today: dueToday };
}
