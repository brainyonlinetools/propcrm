const KEY = "pendingCall";
const MAX_AGE_MS = 90 * 60 * 1000;

export interface PendingCall {
  leadId: string;
  phone: string;
  ts: number;
}

/** Remember that a call to this lead was just started, so we can ask for the outcome when the user returns to the app. */
export function markCallStarted(leadId: string, phone: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ leadId, phone, ts: Date.now() } satisfies PendingCall));
  } catch {
    /* storage unavailable */
  }
}

export function readPendingCall(): PendingCall | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingCall;
    if (!p.leadId || Date.now() - p.ts > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPendingCall() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
