"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import { useManager } from "@/lib/manager-team";
import { useToast } from "@/lib/toast";
import { useTeamDetail } from "../team-detail-context";
import { CalendarIcon } from "@/components/ui/icons";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function ManagerShiftRequestsPage() {
  const { team, teamPeople } = useTeamDetail();
  const { shiftAssignments, shifts, approveShiftRequest, denyShiftRequest } = useCompany();
  const { myPerson } = useManager();
  const { pushToast } = useToast();

  const personById = useMemo(
    () => new Map(teamPeople.map((p) => [p.id, p])),
    [teamPeople],
  );

  const pendingRequests = useMemo(() => {
    const memberIds = new Set(teamPeople.map((p) => p.id));
    return shiftAssignments
      .filter(
        (a) =>
          memberIds.has(a.personId) &&
          a.status === "pending",
      )
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [shiftAssignments, teamPeople]);

  const shiftMap = useMemo(
    () => new Map(shifts.map((s) => [s.id, s])),
    [shifts],
  );

  const handleApprove = async (assignmentId: string) => {
    await approveShiftRequest(assignmentId, myPerson?.name ?? "Manager");
    pushToast({ tone: "success", message: "Request approved" });
  };

  const handleDeny = async (assignmentId: string) => {
    await denyShiftRequest(assignmentId, myPerson?.name ?? "Manager");
    pushToast({ tone: "success", message: "Request denied" });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {pendingRequests.length > 0
            ? `${pendingRequests.length} pending request${pendingRequests.length === 1 ? "" : "s"} for ${team.name}`
            : "No pending shift requests"}
        </p>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <CalendarIcon className="mx-auto size-11 text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">No pending shift requests</p>
          <p className="mt-1 text-xs text-ink-muted">
            When team members request shifts, it will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline md:hidden">
            {pendingRequests.map((assignment) => {
              const person = personById.get(assignment.personId);
              const shift = shiftMap.get(assignment.shiftId);
              if (!shift) return null;
              return (
                <li key={assignment.id} className="space-y-2 p-4">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {person?.name ?? "Unknown"}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-subtle">Shift</dt>
                    <dd className="text-ink-muted">{shift.title}</dd>
                    <dt className="text-ink-subtle">Date & Time</dt>
                    <dd className="text-ink-muted">
                      {shift.date} · {formatTime(shift.startTime)}
                    </dd>
                    <dt className="text-ink-subtle">Requested</dt>
                    <dd className="text-ink-muted">
                      {new Date(assignment.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </dd>
                  </dl>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApprove(assignment.id)}
                      className="flex-1 rounded-md border border-success/25 bg-success-weak px-2.5 py-2 text-[12px] font-medium text-success transition-colors hover:bg-success/15"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeny(assignment.id)}
                      className="flex-1 rounded-md border border-danger/25 bg-danger-weak px-2.5 py-2 text-[12px] font-medium text-danger transition-colors hover:bg-danger/15"
                    >
                      Deny
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Shift</th>
                <th className="px-4 py-2.5 font-medium">Date & Time</th>
                <th className="px-4 py-2.5 font-medium">Requested</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((assignment) => {
                const person = personById.get(assignment.personId);
                const shift = shiftMap.get(assignment.shiftId);
                if (!shift) return null;
                return (
                  <tr
                    key={assignment.id}
                    className="border-b border-hairline last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {shift.title}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {shift.date} · {formatTime(shift.startTime)}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {new Date(assignment.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(assignment.id)}
                          className="rounded-md border border-success/25 bg-success-weak px-2.5 py-1 text-[11px] font-medium text-success transition-colors hover:bg-success/15"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeny(assignment.id)}
                          className="rounded-md border border-danger/25 bg-danger-weak px-2.5 py-1 text-[11px] font-medium text-danger transition-colors hover:bg-danger/15"
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
