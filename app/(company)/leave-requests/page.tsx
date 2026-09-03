"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import { useAuth } from "@/lib/auth";
import type { LeaveRequest, LeaveStatus } from "@/lib/company-data";
import Modal from "@/components/ui/Modal";
import LeaveStatusBadge from "@/components/leave/LeaveStatusBadge";
import { LEAVE_TYPES } from "@/components/leave/RequestLeaveModal";
import { CalendarOffIcon } from "@/components/ui/icons";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/lib/toast";

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: LeaveStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "cancelled", label: "Cancelled" },
];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function typeLabel(type: string): string {
  return LEAVE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function CompanyLeaveRequestsPage() {
  const { leaveRequests, people, teams, approveLeave, denyLeave, revertLeaveApproval } = useCompany();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [denyTarget, setDenyTarget] = useState<LeaveRequest | null>(null);
  const [denyComment, setDenyComment] = useState("");

  const reviewerName = user?.name ?? "Admin";

  const handleApprove = (l: LeaveRequest) => {
    approveLeave(l.id, reviewerName);
    pushToast({ tone: "success", message: "Leave approved" });
  };

  const handleDeny = () => {
    if (!denyTarget) return;
    denyLeave(denyTarget.id, reviewerName, denyComment);
    setDenyTarget(null);
    setDenyComment("");
    pushToast({ tone: "success", message: "Leave denied" });
  };

  const handleUndo = (id: string) => {
    revertLeaveApproval(id, reviewerName);
    pushToast({ tone: "success", message: "Approval reverted" });
  };

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // Who owns the decision: the leave approver of any team the requester
  // belongs to or manages (falls back to that team's manager, then company
  // admins — who can always step in). Requesters never approve themselves.
  const responsibleFor = (personId: string): string => {
    const person = personById.get(personId);
    if (!person) return "Company admin";
    const relevantTeams = teams.filter(
      (t) => person.teamIds.includes(t.id) || t.managerId === person.id,
    );
    for (const t of relevantTeams) {
      const approverId = t.leaveApproverId ?? t.managerId;
      if (approverId && approverId !== person.id) {
        return personById.get(approverId)?.name ?? "Company admin";
      }
    }
    return "Company admin";
  };

  const filtered = useMemo(() => {
    return leaveRequests
      .filter((l) => statusFilter === "all" || l.status === statusFilter)
      .filter((l) => {
        if (teamFilter === "all") return true;
        const person = personById.get(l.personId);
        return person?.teamIds.includes(teamFilter) ?? false;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leaveRequests, statusFilter, teamFilter, personById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const pendingCount = leaveRequests.filter((l) => l.status === "pending").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Leave Requests
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {pendingCount} pending across the company
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 flex-1 rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary sm:h-8 sm:flex-none"
          >
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-3 p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setStatusFilter(f.value);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors sm:py-1 ${
                  statusFilter === f.value
                    ? "bg-primary text-white"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <CalendarOffIcon className="mx-auto size-10 text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">
            No leave requests found
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Adjust the filters, or requests will appear here once employees
            submit them.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline md:hidden">
            {paged.map((l) => {
              const person = personById.get(l.personId);
              const personTeams = person
                ? person.teamIds.map((id) => teamById.get(id)?.name).filter(Boolean)
                : [];
              return (
                <li key={l.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </p>
                    <LeaveStatusBadge status={l.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-subtle">Team</dt>
                    <dd className="text-ink-muted">
                      {personTeams.length > 0 ? personTeams.join(", ") : "—"}
                    </dd>
                    <dt className="text-ink-subtle">Type</dt>
                    <dd className="text-ink-muted">{typeLabel(l.type)}</dd>
                    <dt className="text-ink-subtle">Dates</dt>
                    <dd className="text-ink-muted">
                      {formatShortDate(l.startDate)} – {formatShortDate(l.endDate)}
                    </dd>
                    <dt className="text-ink-subtle">Responsible</dt>
                    <dd className="text-ink-muted">{responsibleFor(l.personId)}</dd>
                    <dt className="text-ink-subtle">Reviewed by</dt>
                    <dd className="text-ink-muted">{l.reviewedBy ?? "—"}</dd>
                  </dl>
                  {l.reason && (
                    <p className="text-xs text-ink-muted">
                      <span className="text-ink-subtle">Reason: </span>
                      {l.reason}
                    </p>
                  )}
                  {l.status === "denied" && l.reviewerComment && (
                    <p className="text-[11px] text-danger">
                      Comment: {l.reviewerComment}
                    </p>
                  )}
                  {l.status === "pending" ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApprove(l)}
                        className="flex-1 rounded-md border border-success/25 bg-success-weak px-2.5 py-2 text-[12px] font-medium text-success transition-colors hover:bg-success/15"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDenyTarget(l);
                          setDenyComment("");
                        }}
                        className="flex-1 rounded-md border border-danger/25 bg-danger-weak px-2.5 py-2 text-[12px] font-medium text-danger transition-colors hover:bg-danger/15"
                      >
                        Deny
                      </button>
                    </div>
                  ) : (
                    l.status === "approved" && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleUndo(l.id)}
                          className="rounded-md border border-hairline bg-surface-3 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
                        >
                          Undo
                        </button>
                      </div>
                    )
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Team</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Dates</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Responsible</th>
                <th className="px-4 py-2.5 font-medium">Reviewed by</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((l) => {
                const person = personById.get(l.personId);
                const personTeams = person
                  ? person.teamIds
                      .map((id) => teamById.get(id)?.name)
                      .filter(Boolean)
                  : [];
                return (
                  <tr
                    key={l.id}
                    className="border-b border-hairline last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {personTeams.length > 0 ? personTeams.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {typeLabel(l.type)}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {formatShortDate(l.startDate)} – {formatShortDate(l.endDate)}
                    </td>
                    <td className="max-w-48 px-4 py-3">
                      <p className="truncate text-ink-muted">{l.reason ?? "—"}</p>
                      {l.status === "denied" && l.reviewerComment && (
                        <p className="mt-0.5 text-[11px] text-danger">
                          Comment: {l.reviewerComment}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LeaveStatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {responsibleFor(l.personId)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {l.reviewedBy ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {l.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(l)}
                            className="rounded-md border border-success/25 bg-success-weak px-2.5 py-1 text-[11px] font-medium text-success transition-colors hover:bg-success/15"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDenyTarget(l);
                              setDenyComment("");
                            }}
                            className="rounded-md border border-danger/25 bg-danger-weak px-2.5 py-1 text-[11px] font-medium text-danger transition-colors hover:bg-danger/15"
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {l.status === "approved" && (
                            <button
                              type="button"
                              onClick={() => handleUndo(l.id)}
                              className="rounded-md border border-hairline bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}

      <Modal
        open={!!denyTarget}
        title="Deny leave request"
        description={
          denyTarget
            ? `${personById.get(denyTarget.personId)?.name ?? "This person"} — ${typeLabel(denyTarget.type)}, ${formatShortDate(denyTarget.startDate)} – ${formatShortDate(denyTarget.endDate)}`
            : undefined
        }
        tone="danger"
        confirmLabel="Deny request"
        onConfirm={handleDeny}
        onClose={() => setDenyTarget(null)}
      >
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
            Comment <span className="text-ink-faint">(optional)</span>
          </label>
          <textarea
            value={denyComment}
            onChange={(e) => setDenyComment(e.target.value)}
            rows={3}
            placeholder="e.g. Insufficient coverage that day"
            className="w-full resize-none rounded-lg border border-hairline bg-surface-3 px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
      </Modal>
    </div>
  );
}
