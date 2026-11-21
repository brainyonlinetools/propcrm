import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LAKH = 1_00_000;
const CRORE = 1_00_00_000;

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount >= CRORE) {
    return `₹${trimZeros((amount / CRORE).toFixed(2))} Cr`;
  }
  if (amount >= LAKH) {
    return `₹${trimZeros((amount / LAKH).toFixed(2))} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

function trimZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

/**
 * Parse a rupee amount typed the way people quote prices: "28500000",
 * "2,85,00,000", "₹2.85 Cr", "85 L", "85 lakh". Returns null when the text
 * is blank or not a price.
 */
export function parsePrice(raw: string | null | undefined): number | null {
  const text = (raw ?? "").toLowerCase().replace(/[,₹\s]/g, "").replace(/^rs\.?/, "");
  if (!text) return null;
  const match = text.match(/^(\d+(?:\.\d+)?)(cr|crore|crores|l|lac|lacs|lakh|lakhs)?$/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!match[2]) return num;
  return Math.round(num * (match[2].startsWith("c") ? CRORE : LAKH));
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

/**
 * Display a lead budget. Plain numbers are treated as ₹ Cr (legacy format);
 * any other text ("2-3 Cr", "Flexible") is shown exactly as entered.
 */
export function formatBudget(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? `₹${value} Cr` : "";
  const text = String(value).trim();
  if (text === "") return "";
  return /^\d+(\.\d+)?$/.test(text) ? `₹${text} Cr` : text;
}
