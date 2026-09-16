"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import ReportsView from "@/components/reports/ReportsView";

export default function EmployeeReportsPage() {
  const { user } = useAuth();
  const { people } = useCompany();

  const me = useMemo(
    () =>
      people.find(
        (p) =>
          p.role === "employee" &&
          p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );

  if (!me) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-2 p-10 text-center">
        <p className="text-sm font-medium text-ink">
          No linked team member record
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Your account isn&apos;t linked to a team member profile yet.
        </p>
      </div>
    );
  }

  return (
    <ReportsView
      personId={me.id}
      lockPerson
      hideCoverage
      title="My Reports"
      subtitle="Your attendance and leave record"
    />
  );
}