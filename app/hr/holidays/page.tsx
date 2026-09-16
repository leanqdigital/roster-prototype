"use client";

import { useCompany } from "@/lib/company-data";

export default function HRHolidaysPage() {
  const { companyHolidays } = useCompany();
  const sorted = [...companyHolidays].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Holidays</h1>
        <p className="mt-1 text-sm text-ink-muted">Company holidays and closures.</p>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No holidays set</p>
          <p className="mt-1 text-xs text-ink-muted">Add company holidays from the admin panel.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {sorted.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{h.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {h.startDate}
                    {h.endDate !== h.startDate ? ` → ${h.endDate}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    h.isActive
                      ? "border-success/25 bg-success-weak text-success"
                      : "border-hairline bg-surface-1 text-ink-faint"
                  }`}
                >
                  {h.isActive ? "active" : "inactive"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}