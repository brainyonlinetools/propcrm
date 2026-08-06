import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount >= 10_00_000) {
    return `₹${(amount / 10_00_000).toFixed(2)} Cr`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.length === 10 ? digits : digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (normalized.length === 10) {
    return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return phone;
}

/** Digits-only key for matching Indian numbers (last 10 digits). */
export function normalizePhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function phoneToWhatsApp(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function phoneToTel(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "d MMM yyyy");
}

export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "_")
    .replace(/^-+|-+$/g, "");
}

export const AGENT_NAME_KEY = "anand_prime_agent_name";

export function getAgentName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AGENT_NAME_KEY) ?? "";
}

export function setAgentName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AGENT_NAME_KEY, name);
}
