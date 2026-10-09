export interface ManualSyncTabSummary {
  created: number;
  repointed: number;
  writtenBack: number;
  warnings: string[];
  errors: string[];
}

export interface ManualSyncResponse {
  ok?: boolean;
  error?: string;
  leads?: ManualSyncTabSummary;
  inventory?: ManualSyncTabSummary;
}

export async function triggerSheetSync(
  tabs: ("leads" | "inventory")[]
): Promise<ManualSyncResponse> {
  const res = await fetch("/api/cron/sync-sheet-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabs }),
  });
  try {
    return (await res.json()) as ManualSyncResponse;
  } catch {
    return { error: `Sync failed (HTTP ${res.status})` };
  }
}

export function describeTabSync(label: string, summary: ManualSyncTabSummary): string {
  const parts = [`${summary.created} new`, `${summary.repointed} matched`];
  if (summary.writtenBack > 0) {
    parts.push(`${summary.writtenBack} updated in sheet`);
  }
  return `${label}: ${parts.join(", ")}`;
}
