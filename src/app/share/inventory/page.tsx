"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Building2, ImageIcon, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInventoryByIds } from "@/lib/queries/inventory";
import { parseInventoryShareIds } from "@/lib/inventorySharing";
import { formatCurrency } from "@/lib/utils";
import {
  INVENTORY_STATUS_CONFIG,
  type Inventory,
  type InventoryMedia,
  type InventoryStatus,
} from "@/types";

const PRIVATE_CUSTOM_KEYS = new Set([
  "owner_name",
  "owner_phone",
  "owner",
  "owner_contact",
  "owner_email",
  "project_name",
]);

export default function SharedInventoryPage() {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <SharedInventoryContent />
    </Suspense>
  );
}

function SharedInventoryContent() {
  const searchParams = useSearchParams();
  const ids = useMemo(() => parseInventoryShareIds(searchParams.get("ids")), [searchParams]);
  const { data: units = [], isLoading, isError } = useInventoryByIds(ids);

  if (ids.length === 0) {
    return (
      <ShareShell>
        <EmptyShareState
          title="No units selected"
          description="Ask your Anand Prime advisor to resend the inventory link."
        />
      </ShareShell>
    );
  }

  if (isLoading) return <ShareSkeleton />;

  if (isError) {
    return (
      <ShareShell>
        <EmptyShareState
          title="Could not load inventory"
          description="The listing link may be expired or temporarily unavailable."
        />
      </ShareShell>
    );
  }

  return (
    <ShareShell>
      <header className="rounded-2xl bg-card p-5 shadow-card">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Anand Prime
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {units.length === 1 ? units[0].unit_number : "Curated Inventory Options"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore property details, photos, and videos shared by your Anand Prime advisor.
        </p>
      </header>

      {units.length === 0 ? (
        <EmptyShareState
          title="Units not found"
          description="The selected units may have been removed."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {units.map((unit) => (
            <UnitBrochure key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </ShareShell>
  );
}

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-4 py-5">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">{children}</div>
    </main>
  );
}

function UnitBrochure({ unit }: { unit: Inventory }) {
  const projectName =
    (typeof unit.custom_data?.project_name === "string" && unit.custom_data.project_name) ||
    unit.projects?.name ||
    null;
  const statusLabel =
    INVENTORY_STATUS_CONFIG[unit.status as InventoryStatus]?.label ?? unit.status;

  const detailFields = [
    projectName ? { label: "Project", value: projectName } : null,
    unit.unit_type ? { label: "Unit Type", value: unit.unit_type } : null,
    unit.area_sqft != null
      ? { label: "Area", value: `${unit.area_sqft.toLocaleString("en-IN")} sq.ft.` }
      : null,
    unit.price != null ? { label: "Price", value: formatCurrency(unit.price) } : null,
    unit.status ? { label: "Status", value: statusLabel } : null,
    ...getPublicCustomFields(unit),
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <HeroMedia unit={unit} />

      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{unit.unit_number}</h2>
          {projectName && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <Building2 className="mt-0.5 size-4 shrink-0" />
              <span>{projectName}</span>
            </p>
          )}
        </div>

        {detailFields.length > 0 && (
          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
            {detailFields.map((field) => (
              <div key={field.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <MediaGallery media={unit.inventory_media ?? []} unitNumber={unit.unit_number} />
      </div>
    </article>
  );
}

function getPublicCustomFields(unit: Inventory): { label: string; value: string }[] {
  const labels: Record<string, string> = {
    property_type: "Property Type",
    floor: "Floor",
    facing: "Facing",
    car_parking: "Car Parking",
    remarks: "Remarks",
  };

  return Object.entries(unit.custom_data ?? {}).flatMap(([key, raw]) => {
    if (PRIVATE_CUSTOM_KEYS.has(key)) return [];
    if (raw == null || raw === "") return [];
    const label =
      labels[key] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    const value =
      key === "property_type"
        ? String(raw).charAt(0).toUpperCase() + String(raw).slice(1)
        : String(raw);
    return [{ label, value }];
  });
}

function HeroMedia({ unit }: { unit: Inventory }) {
  const cover = unit.inventory_media?.[0];

  if (!cover) {
    return (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon />
      </div>
    );
  }

  if (cover.media_type === "video") {
    return cover.public_url ? (
      <video
        className="aspect-video w-full bg-muted object-cover"
        src={cover.public_url}
        controls
        preload="metadata"
      />
    ) : (
      <FallbackMedia icon="video" />
    );
  }

  return cover.public_url ? (
    <div className="relative aspect-video w-full bg-muted">
      <Image
        src={cover.public_url}
        alt={cover.caption ?? unit.unit_number}
        fill
        sizes="(max-width: 640px) 100vw, 512px"
        className="object-cover"
        unoptimized
        priority
      />
    </div>
  ) : (
    <FallbackMedia icon="image" />
  );
}

function MediaGallery({
  media,
  unitNumber,
}: {
  media: InventoryMedia[];
  unitNumber: string;
}) {
  if (media.length <= 1) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Photos & Videos</h3>
        <Badge variant="secondary">{media.length} items</Badge>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {media.slice(1).map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-xl border border-border bg-background">
            {item.media_type === "video" ? (
              item.public_url ? (
                <video
                  className="aspect-video w-full bg-muted object-cover"
                  src={item.public_url}
                  controls
                  preload="metadata"
                />
              ) : (
                <FallbackMedia icon="video" />
              )
            ) : item.public_url ? (
              <div className="relative aspect-video w-full bg-muted">
                <Image
                  src={item.public_url}
                  alt={item.caption ?? unitNumber}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <FallbackMedia icon="image" />
            )}
            {item.caption && (
              <figcaption className="p-2 text-xs text-muted-foreground">{item.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function FallbackMedia({ icon }: { icon: "image" | "video" }) {
  const Icon = icon === "video" ? Video : ImageIcon;
  return (
    <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
      <Icon />
    </div>
  );
}

function EmptyShareState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ShareSkeleton() {
  return (
    <ShareShell>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </ShareShell>
  );
}
