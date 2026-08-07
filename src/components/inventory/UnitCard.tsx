"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn, formatCurrency } from "@/lib/utils";
import type { Inventory, InventoryMedia } from "@/types";

interface UnitCardProps {
  unit: Inventory;
  /** When set, card selects in-place instead of navigating to the detail page. */
  onSelect?: () => void;
  selected?: boolean;
}

export function UnitCard({ unit, onSelect, selected = false }: UnitCardProps) {
  const floor = unit.custom_data.floor;
  const facing = unit.custom_data.facing;
  const projectName = (unit.custom_data?.project_name as string) ?? unit.projects?.name;
  const media = unit.inventory_media ?? [];
  const cover = media[0];

  const body = (
    <>
      <UnitCover media={cover} unitNumber={unit.unit_number} />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{unit.unit_number}</h3>
            {projectName && (
              <p className="truncate text-xs text-muted-foreground">{projectName}</p>
            )}
          </div>
          <StatusBadge status={unit.status} className="shrink-0" />
        </div>

        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {unit.unit_type && <span>{unit.unit_type}</span>}
          {floor != null && <span>Floor {String(floor)}</span>}
          {facing != null && <span>{String(facing)} facing</span>}
          {unit.area_sqft != null && <span>{unit.area_sqft.toLocaleString("en-IN")} sq.ft.</span>}
        </div>

        {unit.price != null && (
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(unit.price)}
          </p>
        )}
      </div>
    </>
  );

  const className = cn(
    "block overflow-hidden rounded-lg border border-border bg-card shadow-card transition-colors active:bg-muted/50",
    selected && "ring-2 ring-primary/40"
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={cn(className, "w-full text-left")}>
        {body}
      </button>
    );
  }

  return (
    <Link href={`/inventory/${unit.id}`} className={className}>
      {body}
    </Link>
  );
}

function UnitCover({
  media,
  unitNumber,
}: {
  media: InventoryMedia | undefined;
  unitNumber: string;
}) {
  if (!media) {
    return (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon />
      </div>
    );
  }

  if (media.media_type === "video") {
    return media.public_url ? (
      <div className="relative">
        <video
          className="aspect-video w-full bg-muted object-cover"
          src={media.public_url}
          preload="metadata"
        />
        <Badge variant="secondary" className="absolute right-2 bottom-2">
          <Video />
          Video
        </Badge>
      </div>
    ) : (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <Video />
      </div>
    );
  }

  return media.public_url ? (
    <div className="relative aspect-video w-full bg-muted">
      <Image
        src={media.public_url}
        alt={media.caption ?? unitNumber}
        fill
        sizes="(max-width: 420px) 50vw, 210px"
        className="object-cover"
        unoptimized
      />
    </div>
  ) : (
    <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
      <ImageIcon />
    </div>
  );
}
