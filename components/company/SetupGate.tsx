"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCompanySettings } from "@/lib/company";
import PageLoading from "@/components/ui/PageLoading";

/**
 * Blocks access to the rest of the company admin app until the onboarding
 * wizard (`/company/setup`) has been completed. Redirects there otherwise.
 */
export default function SetupGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCompanySettings().then((settings) => {
      if (cancelled) return;
      if (!settings?.completedSetupAt) {
        router.replace("/company/setup");
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <PageLoading />;

  return <>{children}</>;
}
