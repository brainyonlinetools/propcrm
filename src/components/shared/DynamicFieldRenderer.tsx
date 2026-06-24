"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useFieldDefinitions } from "@/lib/queries/fieldDefinitions";
import { formatCurrency } from "@/lib/utils";
import type { EntityType } from "@/types";

interface DynamicFieldRendererProps {
  entityType: EntityType;
  value: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  mode: "edit" | "view";
}

function formatFieldValue(
  fieldType: string,
  val: unknown,
  fieldKey?: string
): string {
  if (val == null || val === "") return "—";
  if (fieldType === "boolean") return val ? "Yes" : "No";
  if (fieldType === "multiselect" && Array.isArray(val)) return val.join(", ");
  if (fieldType === "number" && fieldKey === "budget") {
    const num = Number(val);
    if (!Number.isNaN(num)) return `₹${num} Cr`;
  }
  if (fieldType === "number" && fieldKey === "price") {
    return formatCurrency(Number(val));
  }
  return String(val);
}

export function DynamicFieldRenderer({
  entityType,
  value,
  onChange,
  mode,
}: DynamicFieldRendererProps) {
  const { data: fields = [], isLoading } = useFieldDefinitions(entityType);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading fields…</p>;
  }

  if (fields.length === 0) {
    return null;
  }

  if (mode === "view") {
    return (
      <div className="flex flex-col gap-3">
        {fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{field.label}</span>
            <span className="text-sm break-words text-foreground">
              {formatFieldValue(field.field_type, value[field.field_key], field.field_key)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const fieldValue = value[field.field_key];
        const options = field.options ?? [];

        return (
          <div key={field.id} className="flex flex-col gap-2">
            <Label htmlFor={field.field_key}>
              {field.label}
              {field.is_required && <span className="text-destructive"> *</span>}
            </Label>

            {(field.field_type === "text" ||
              field.field_type === "phone" ||
              field.field_type === "url") && (
              <Input
                id={field.field_key}
                type={field.field_type === "phone" ? "tel" : field.field_type === "url" ? "url" : "text"}
                className="h-12"
                value={String(fieldValue ?? "")}
                onChange={(e) => onChange(field.field_key, e.target.value)}
              />
            )}

            {field.field_type === "textarea" && (
              <Textarea
                id={field.field_key}
                value={String(fieldValue ?? "")}
                onChange={(e) => onChange(field.field_key, e.target.value)}
                rows={3}
              />
            )}

            {field.field_type === "number" && (
              <Input
                id={field.field_key}
                type="number"
                className="h-12"
                value={fieldValue != null ? String(fieldValue) : ""}
                onChange={(e) =>
                  onChange(
                    field.field_key,
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            )}

            {field.field_type === "date" && (
              <Input
                id={field.field_key}
                type="date"
                className="h-12"
                value={String(fieldValue ?? "")}
                onChange={(e) => onChange(field.field_key, e.target.value)}
              />
            )}

            {field.field_type === "boolean" && (
              <Switch
                id={field.field_key}
                checked={Boolean(fieldValue)}
                onCheckedChange={(checked) => onChange(field.field_key, checked)}
              />
            )}

            {field.field_type === "select" && (
              <Select
                value={String(fieldValue ?? "")}
                onValueChange={(val) => onChange(field.field_key, val)}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue placeholder={`Select ${field.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.field_type === "multiselect" && (
              <div className="flex flex-col gap-2">
                {options.map((opt) => {
                  const selected = Array.isArray(fieldValue) ? fieldValue.includes(opt) : false;
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const current = Array.isArray(fieldValue) ? fieldValue : [];
                          const next = checked
                            ? [...current, opt]
                            : current.filter((v) => v !== opt);
                          onChange(field.field_key, next);
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
