"use client";

import type { ReactNode } from "react";
import { useAdmin } from "@/lib/store";
import PageLoading from "@/components/ui/PageLoading";

export default function AdminLoadingGate({ children }: { children: ReactNode }) {
  const { loading } = useAdmin();

  if (loading) {
    return <PageLoading />;
  }

  return <>{children}</>;
}
