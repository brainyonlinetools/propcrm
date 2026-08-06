"use client";

import { use } from "react";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <LeadDetailPanel id={id} />;
}
