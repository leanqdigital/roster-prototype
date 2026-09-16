"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { ComplianceViolationStatus } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import Avatar from "@/components/people/Avatar";
import ComplianceViolationBadge from "@/components/breaks/ComplianceViolationBadge";
import { useToast } from "@/lib/toast";

const TABS: { key: ComplianceViolationStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
];

const STATUS_LABEL: Record<ComplianceViolationStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const STATUS_STYLE: Record<ComplianceViolationStatus, string> = {
  open: "border-warning/25 bg-warning-weak text-warning",
  acknowledged: "border-primary/25 bg-primary-weak text-primary",
  resolved: "border-emerald-500/25 bg-emerald-50 text-emerald-600",
  dismissed: "border-hairline bg-surface-3 text-ink-subtle",
};

// Compliance is HR's domain: acknowledge and resolve violations. Dismiss
// stays with managers/company admins — handled by RLS.
export default function HRCompliancePage() {
  const { people, complianceViolations, updateComplianceViolation } = useCompany();
  const { pushToast } = useToast();
  const [tab, setTab] = useState<ComplianceViolationStatus | "all">("all");

  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const sorted = useMemo(
    () =>
      [...complianceViolations].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)),
    [complianceViolations],
  );

  const visible = tab === "all" ? sorted : sorted.filter((v) => v.status === tab);

  const act = async (id: string, status: "acknowledged" | "resolved") => {
    const res = await updateComplianceViolation(id, { status });
    pushToast({
      tone: res.ok ? "success" : "danger",
      message: res.ok
        ? status === "acknowledged"
          ? "Violation acknowledged"
          : "Violation resolved"
        : res.error ?? "Failed to update",
    });
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Compliance</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Break-policy violations for the whole company. Acknowledge or resolve them.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === t.key
                ? "bg-surface-3 text-ink"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-hairline bg-surface-2 px-4 py-12 text-center">
          <p className="text-[13px] font-medium text-ink">No violations here</p>
          <p className="mt-1 text-xs text-ink-muted">
            Nothing in this view. Good news for the floor.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-hairline/60 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          {visible.map((v) => {
            const person = personMap.get(v.personId);
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar
                  name={person?.name ?? "Unknown"}
                  src={person?.avatarUrl}
                  className="size-8 text-[12px] font-semibold"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-ink">
                      {person?.name ?? "Former member"}
                    </p>
                    <ComplianceViolationBadge type={v.type} />
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[v.status]}`}
                    >
                      {STATUS_LABEL[v.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {v.description} · {localDateStr(new Date(v.detectedAt))} at{" "}
                    {new Date(v.detectedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {v.status === "open" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => act(v.id, "acknowledged")}
                      className="h-8 rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] font-medium text-ink hover:bg-surface-1"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => act(v.id, "resolved")}
                      className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover"
                    >
                      Resolve
                    </button>
                  </div>
                )}
                {v.status === "acknowledged" && (
                  <button
                    type="button"
                    onClick={() => act(v.id, "resolved")}
                    className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover"
                  >
                    Resolve
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}