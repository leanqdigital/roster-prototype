"use client";

import type { ReactNode } from "react";
import { useCompany } from "@/lib/company-data";
import PageLoading from "@/components/ui/PageLoading";

export default function CompanyLoadingGate({ children }: { children: ReactNode }) {
  const { loading } = useCompany();

  if (loading) {
    return <PageLoading />;
  }

  return <>{children}</>;
}
