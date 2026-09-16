"use client";

import { useCompany } from "@/lib/company-data";
import { MapPinIcon } from "@/components/ui/icons";

export default function HRLocationsPage() {
  const { locations } = useCompany();

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Locations</h1>
        <p className="mt-1 text-sm text-ink-muted">Where the company operates.</p>
      </div>

      {locations.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <MapPinIcon className="mx-auto size-10 text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">No locations yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            Locations are managed from the admin panel.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {locations.map((l) => (
            <div key={l.id} className="rounded-xl border border-hairline bg-surface-2 p-4">
              <div className="flex items-center gap-2">
                <MapPinIcon className="size-4 text-ink-subtle" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {l.name}
                </p>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    l.active
                      ? "border-success/25 bg-success-weak text-success"
                      : "border-hairline bg-surface-1 text-ink-faint"
                  }`}
                >
                  {l.active ? "active" : "inactive"}
                </span>
              </div>
              {(l.address || l.city) && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  {[l.address, l.city, l.state, l.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}