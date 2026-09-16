"use client";

import { useAuth } from "@/lib/auth";
import ChangePasswordCard from "@/components/settings/ChangePasswordCard";

export default function HRSettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Your account and security.</p>
      </div>

      <div className="mt-6 grid max-w-xl gap-4">
        <section className="rounded-xl border border-hairline bg-surface-2 p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Account</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs font-medium text-ink-muted">Name</dt>
              <dd className="text-[13px] font-medium text-ink">{user?.name ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs font-medium text-ink-muted">Email</dt>
              <dd className="truncate text-[13px] font-medium text-ink">{user?.email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs font-medium text-ink-muted">Role</dt>
              <dd className="rounded-md border border-hairline bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-subtle">
                HR (read-only)
              </dd>
            </div>
          </dl>
        </section>

        <ChangePasswordCard />
      </div>
    </div>
  );
}