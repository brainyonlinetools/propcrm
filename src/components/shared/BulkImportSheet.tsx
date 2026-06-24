"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { parseDelimitedText } from "@/lib/csv";
import {
  getBulkImportTemplate,
  parseInventoryRows,
  parseLeadRows,
  type BulkRowError,
} from "@/lib/bulkImport";
import { useBulkCreateInventory } from "@/lib/queries/inventory";
import { useBulkCreateLeads } from "@/lib/queries/leads";
import { useFieldDefinitions } from "@/lib/queries/fieldDefinitions";
import { usePipelineStages } from "@/lib/queries/pipelineStages";
import { useProjects } from "@/lib/queries/projects";
import type { EntityType, InventoryInsert, LeadInsert } from "@/types";

interface BulkImportSheetProps {
  entityType: EntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImportSheet({
  entityType,
  open,
  onOpenChange,
}: BulkImportSheetProps) {
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: customFields = [] } = useFieldDefinitions(entityType);
  const { data: stages = [] } = usePipelineStages();
  const { data: projects = [] } = useProjects();
  const bulkCreateLeads = useBulkCreateLeads();
  const bulkCreateInventory = useBulkCreateInventory();

  const template = useMemo(
    () => getBulkImportTemplate(entityType, customFields),
    [entityType, customFields]
  );

  const parsed = useMemo(() => {
    if (!pasteText.trim()) return null;
    const { headers, rows, errors } = parseDelimitedText(pasteText);
    if (errors.length > 0 && rows.length === 0) {
      return { headers, rows, parseErrors: errors, valid: [], rowErrors: [] as BulkRowError[] };
    }

    if (entityType === "lead") {
      const result = parseLeadRows(rows, stages, customFields);
      return {
        headers,
        rows,
        parseErrors: errors,
        valid: result.valid,
        rowErrors: result.errors,
      };
    }

    const result = parseInventoryRows(rows, projects, customFields);
    return {
      headers,
      rows,
      parseErrors: errors,
      valid: result.valid,
      rowErrors: result.errors,
    };
  }, [pasteText, entityType, stages, projects, customFields]);

  const isPending = bulkCreateLeads.isPending || bulkCreateInventory.isPending;
  const label = entityType === "lead" ? "Leads" : "Inventory";

  function reset() {
    setPasteText("");
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPasteText(text);
    setFileName(file.name);
  }

  async function handleImport() {
    if (!parsed || parsed.valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    try {
      if (entityType === "lead") {
        await bulkCreateLeads.mutateAsync(parsed.valid as LeadInsert[]);
      } else {
        await bulkCreateInventory.mutateAsync(parsed.valid as InventoryInsert[]);
      }
      toast.success(`Imported ${parsed.valid.length} ${label.toLowerCase()}`);
      handleOpenChange(false);
    } catch {
      toast.error(`Failed to import ${label.toLowerCase()}`);
    }
  }

  async function copyTemplate() {
    await navigator.clipboard.writeText(template);
    toast.success("Template copied");
  }

  function downloadTemplate() {
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityType}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl px-0"
      >
        <SheetHeader className="shrink-0 px-4">
          <SheetTitle>Bulk Import {label}</SheetTitle>
          <SheetDescription>
            Upload a CSV file or paste comma-separated data. First row must be column headers.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyTemplate}>
              <Copy data-icon="inline-start" />
              Copy template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download data-icon="inline-start" />
              Download template
            </Button>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload CSV</TabsTrigger>
              <TabsTrigger value="paste">Paste data</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4 flex flex-col gap-3">
              <Label htmlFor="csv-file">CSV file</Label>
              <label
                htmlFor="csv-file"
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/50"
              >
                <Upload className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {fileName ? fileName : "Tap to choose a .csv file"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Comma or tab separated values
                </span>
              </label>
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={handleFileChange}
              />
            </TabsContent>

            <TabsContent value="paste" className="mt-4 flex flex-col gap-3">
              <Label htmlFor="paste-data">Paste CSV data</Label>
              <Textarea
                id="paste-data"
                className="min-h-40 font-mono text-xs"
                placeholder={template}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setFileName(null);
                }}
              />
            </TabsContent>
          </Tabs>

          {parsed && pasteText.trim() && (
            <div className="rounded-lg border border-border bg-card p-3 text-sm shadow-card">
              <p className="font-medium">
                {parsed.valid.length} row{parsed.valid.length !== 1 ? "s" : ""} ready to import
                {parsed.rows.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    (of {parsed.rows.length} parsed)
                  </span>
                )}
              </p>
              {parsed.parseErrors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-destructive">
                  {parsed.parseErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
              {parsed.rowErrors.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-destructive">
                  {parsed.rowErrors.slice(0, 10).map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {parsed.rowErrors.length > 10 && (
                    <li>…and {parsed.rowErrors.length - 10} more errors</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <Button
            type="button"
            size="lg"
            className="w-full shrink-0"
            disabled={!parsed || parsed.valid.length === 0 || isPending}
            onClick={handleImport}
          >
            {isPending
              ? "Importing…"
              : `Import ${parsed?.valid.length ?? 0} ${label}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
