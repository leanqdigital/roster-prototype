"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { isUnassigned } from "@/lib/hr";
import LeaveStatusBadge from "@/components/leave/LeaveStatusBadge";
import Avatar from "@/components/people/Avatar";

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  bereavement: "Bereavement",
  other: "Other",
};

export default function HRLeaveRequestsPage() {
  const { leaveRequests, people, teams, approveLeave, denyLeave } = useCompany();
  const { user } = useAuth();
  const { pushToast } = useToast();

  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const sorted = useMemo(
    () =>
      [...leaveRequests].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [leaveRequests],
  );

  const act = async (id: string, status: "approved" | "denied") => {
    const res = await (status === "approved" ? approveLeave(id, user?.name ?? "HR") : denyLeave(id, user?.name ?? "HR"));
    pushToast({
      tone: res.ok ? "success" : "danger",
      message: res.ok ? `Request ${status}` : res.error ?? "Failed to review",
    });
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Leave requests</h1>
        <p className="mt-1 text-sm text-ink-muted">
          All company leave, pending and processed. You review requests from
          staff with no manager assigned — managers handle their own teams.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No leave requests</p>
          <p className="mt-1 text-xs text-ink-muted">Requests from staff will show up here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {sorted.map((r) => {
              const person = personMap.get(r.personId);
              const reviewable = r.status === "pending" && !!person && isUnassigned(person, teams);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={person?.name ?? "?"} src={person?.avatarUrl} className="size-8 text-xs font-semibold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {TYPE_LABELS[r.type] ?? r.type} · {r.startDate} → {r.endDate}
                    </p>
                  </div>
                  {r.reason && (
                    <p className="hidden w-48 truncate text-xs text-ink-muted lg:block">
                      {r.reason}
                    </p>
                  )}
                  <LeaveStatusBadge status={r.status} />
                  {reviewable && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => act(r.id, "denied")}
                        className="h-8 rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] font-medium text-ink hover:bg-surface-1"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        onClick={() => act(r.id, "approved")}
                        className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}