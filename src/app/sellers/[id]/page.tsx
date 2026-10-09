"use client";

import { use } from "react";
import { SellerDetailPanel } from "@/components/sellers/SellerDetailPanel";

export default function SellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SellerDetailPanel id={id} />;
}
