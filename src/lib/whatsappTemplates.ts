import { formatPhone, getAgentName, phoneToWhatsApp } from "@/lib/utils";
import type { FieldDefinition, Lead } from "@/types";

export const DEFAULT_WHATSAPP_TEMPLATE_BODY =
  "Hi {{name}}, this is {{agent}} from Anand Prime. Following up regarding your enquiry about {{project}}.";

const STATIC_VARIABLES = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "project", label: "Project" },
  { key: "source", label: "Source" },
  { key: "agent", label: "Agent" },
  { key: "stage", label: "Stage" },
] as const;

export function getWhatsAppTemplateVariables(fieldDefs: FieldDefinition[] = []) {
  const custom = fieldDefs
    .filter((f) => f.entity_type === "lead")
    .map((f) => ({ key: f.field_key, label: f.label }));
  return [...STATIC_VARIABLES, ...custom];
}

function formatCustomValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function getTemplateValue(lead: Lead, key: string): string {
  const normalized = key.toLowerCase();

  switch (normalized) {
    case "name":
      return lead.name;
    case "phone":
    case "mobile":
      return formatPhone(lead.phone) || "";
    case "email":
      return lead.email ?? "";
    case "project":
      return lead.project_interest ?? "our projects";
    case "source":
      return lead.source ?? "";
    case "agent":
      return getAgentName() || "your Anand Prime advisor";
    case "stage":
      return lead.pipeline_stages?.label ?? "";
    default: {
      const custom = lead.custom_data[key] ?? lead.custom_data[normalized];
      return formatCustomValue(custom);
    }
  }
}

export function renderWhatsAppTemplate(body: string, lead: Lead): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    getTemplateValue(lead, key)
  );
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const waPhone = phoneToWhatsApp(phone);
  if (!waPhone) return null;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}

export function truncateForNote(message: string, maxLength = 80): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}
