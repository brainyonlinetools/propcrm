"use client";

import { use } from "react";
import { UnitDetailPanel } from "@/components/inventory/UnitDetailPanel";

export default function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <UnitDetailPanel id={id} />;
}
