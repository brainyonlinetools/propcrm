export type EntityType = "lead" | "inventory";

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "date"
  | "phone"
  | "url"
  | "textarea"
  | "boolean";

export type InventoryStatus = "available" | "blocked" | "booked" | "sold";

export type NoteType = "note" | "call" | "visit" | "whatsapp";

export interface FieldDefinition {
  id: string;
  entity_type: EntityType;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  show_in_card: boolean;
  sort_order: number;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface Project {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  stage_id: string | null;
  source: string | null;
  project_interest: string | null;
  linked_unit_id: string | null;
  acquired_date: string | null;
  custom_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  pipeline_stages?: PipelineStage | null;
}

export interface Inventory {
  id: string;
  project_id: string | null;
  unit_number: string;
  unit_type: string | null;
  area_sqft: number | null;
  price: number | null;
  status: InventoryStatus;
  acquired_date: string | null;
  custom_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  projects?: Project | null;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  note_type: NoteType;
  created_at: string;
}

export interface InventoryNote {
  id: string;
  inventory_id: string;
  content: string;
  note_type: NoteType;
  created_at: string;
}

export interface Task {
  id: string;
  lead_id: string;
  title: string;
  due_date: string | null;
  is_done: boolean;
  created_at: string;
  leads?: Pick<Lead, "id" | "name"> | null;
}

export interface LeadInsert {
  name: string;
  phone?: string | null;
  email?: string | null;
  stage_id?: string | null;
  source?: string | null;
  project_interest?: string | null;
  linked_unit_id?: string | null;
  acquired_date?: string | null;
  custom_data?: Record<string, unknown>;
}

export interface InventoryInsert {
  project_id?: string | null;
  unit_number: string;
  unit_type?: string | null;
  area_sqft?: number | null;
  price?: number | null;
  status?: InventoryStatus;
  acquired_date?: string | null;
  custom_data?: Record<string, unknown>;
}

export const DISQUALIFIED_STAGE_LABEL = "Disqualified";

export function isArchivedLead(lead: Pick<Lead, "pipeline_stages">): boolean {
  return lead.pipeline_stages?.label === DISQUALIFIED_STAGE_LABEL;
}

export const LEAD_SOURCES = ["Meta", "Google", "Reference", "Walk-in", "99acres", "MagicBricks"] as const;

export const INVENTORY_STATUS_CONFIG: Record<
  InventoryStatus,
  { label: string; className: string }
> = {
  available: {
    label: "Available",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  blocked: {
    label: "Blocked",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  booked: {
    label: "Booked",
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  },
  sold: {
    label: "Sold",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
};

export const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: string }> = {
  note: { label: "Note", icon: "📝" },
  call: { label: "Call", icon: "📞" },
  visit: { label: "Visit", icon: "🏠" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
};
