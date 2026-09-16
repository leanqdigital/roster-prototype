"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import RequestLeaveModal from "@/components/leave/RequestLeaveModal";
import LeaveStatusBadge from "@/components/leave/LeaveStatusBadge";
import StatCard from "@/components/ui/StatCard";
import { CalendarIcon, CalendarOffIcon, PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/lib/toast";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EmployeeLeaveRequestsPage() {
  const { user } = useAuth();
  const { people, leaveRequests, leaveTypes, cancelLeaveRequest, getPersonLeaveBalance } =
    useCompany();
  const { pushToast } = useToast();
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const myPerson = useMemo(
    () =>
      people.find(
        (p) => p.role === "employee" && p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );

  const myLeaveRequests = useMemo(() => {
    if (!myPerson) return [];
    return leaveRequests
      .filter((l) => l.personId === myPerson.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, myPerson]);

  const pendingCount = myLeaveRequests.filter((l) => l.status === "pending").length;

  const leaveTypeByKey = useMemo(() => new Map(leaveTypes.map((t) => [t.key, t])), [leaveTypes]);
  const typeLabel = (key: string) => leaveTypeByKey.get(key)?.name ?? key;

  const trackedBalances = useMemo(
    () =>
      myPerson
        ? leaveTypes
            .filter((t) => t.tracksBalance && t.isActive)
            .map((t) => ({
              name: t.name,
              days: getPersonLeaveBalance(myPerson.id, t.id),
              total: t.defaultBalanceDays,
            }))
        : [],
    [leaveTypes, myPerson, getPersonLeaveBalance],
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Leave requests
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} waiting for review`
              : "Track the time off you've requested"}
          </p>
        </div>
        {myPerson && (
          <button
            type="button"
            onClick={() => setLeaveModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="size-4" />
            Request leave
          </button>
        )}
      </div>

      {myPerson && trackedBalances.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trackedBalances.map((b) => (
            <StatCard
              key={b.name}
              label={`${b.name} remaining`}
              value={`${b.days}/${b.total} days`}
              icon={<CalendarIcon className="size-4" />}
            />
          ))}
        </div>
      )}

      {!myPerson ? (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <CalendarOffIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            You&apos;re not linked to a team member record yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Ask your manager to invite you with the employee role, then accept
            the invite from that email.
          </p>
        </div>
      ) : myLeaveRequests.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <CalendarOffIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            No leave requests yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Request time off and your manager will review it.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {myLeaveRequests.map((l) => (
            <li
              key={l.id}
              className="rounded-lg border border-hairline bg-surface-2 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    {typeLabel(l.type)}
                    <span className="text-ink-subtle">
                      {" "}· {formatShortDate(l.startDate)} –{" "}
                      {formatShortDate(l.endDate)}
                    </span>
                  </p>
                  {l.reason && (
                    <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                      {l.reason}
                    </p>
                  )}
                  {l.status === "denied" && l.reviewerComment && (
                    <p className="mt-0.5 text-[11px] text-danger">
                      Manager: {l.reviewerComment}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <LeaveStatusBadge status={l.status} />
                  {l.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => {
                        cancelLeaveRequest(l.id);
                        pushToast({ tone: "success", message: "Leave request cancelled" });
                      }}
                      className="rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-4 hover:text-ink"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RequestLeaveModal
        open={leaveModalOpen}
        personId={myPerson?.id ?? ""}
        onClose={() => setLeaveModalOpen(false)}
      />
    </div>
  );
}
