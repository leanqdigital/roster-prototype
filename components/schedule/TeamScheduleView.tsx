"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-data";
import type { Shift, Team } from "@/lib/company-data";
import { formatDateTime, localDateStr } from "@/lib/format";
import Modal from "@/components/ui/Modal";
import ShiftCalendar from "@/components/schedule/ShiftCalendar";
import MonthCalendar from "@/components/schedule/MonthCalendar";
import PublishPreviewModal from "@/components/schedule/PublishPreviewModal";
import AssignShiftModal from "@/components/schedule/AssignShiftModal";
import BulkAssignModal from "@/components/schedule/BulkAssignModal";
import BulkCreateShiftModal from "@/components/schedule/BulkCreateShiftModal";
import CreateShiftModal from "@/components/schedule/CreateShiftModal";
import EditShiftModal from "@/components/schedule/EditShiftModal";
import DeleteShiftDialog from "@/components/schedule/DeleteShiftDialog";
import ShiftDetailsPanel from "@/components/schedule/ShiftDetailsPanel";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/ui/icons";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateRange(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startMonth = MONTH_NAMES[start.getMonth()];
  const endMonth = MONTH_NAMES[end.getMonth()];
  if (startMonth === endMonth) {
    return startMonth + " " + start.getDate() + " \u2013 " + end.getDate() + ", " + start.getFullYear();
  }
  return startMonth + " " + start.getDate() + " \u2013 " + endMonth + " " + end.getDate() + ", " + start.getFullYear();
}

type ModalMode =
  | { type: null }
  | { type: "assign"; shift: Shift }
  | { type: "bulk" }
  | { type: "bulk-create" }
  | { type: "bulk-delete" }
  | { type: "create"; defaultDate?: string }
  | { type: "edit"; shift: Shift }
  | { type: "delete"; shift: Shift }
  | { type: "details"; shift: Shift };

interface TeamScheduleViewProps {
  team: Team;
  showHeader?: boolean;
  backHref?: string;
  templatesHref?: string;
}

export default function TeamScheduleView({
  team,
  showHeader = true,
  backHref,
  templatesHref,
}: TeamScheduleViewProps) {
  const {
    people,
    shifts,
    shiftAssignments,
    shiftTemplates,
    leaveRequests,
    auditLog,
    previewShifts,
    publishShifts,
    createShift,
    createShifts,
    updateShift,
    deleteShift,
    deleteShifts,
    assignPerson,
    removeAssignment,
    bulkAssign,
  } = useCompany();

  const teamPeople = useMemo(
    () => people.filter((p) => p.teamIds.includes(team.id)),
    [people, team.id],
  );

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [view, setView] = useState<"week" | "month">("week");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [modal, setModal] = useState<ModalMode>({ type: null });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishPreview, setPublishPreview] = useState<{
    planned: Shift[];
    skippedCount: number;
    conflictIds: string[];
    dateRange: string;
  } | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [publishResult, setPublishResult] = useState<{ count: number } | null>(null);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return end;
  }, [weekStart]);

  const weekKey = localDateStr(weekStart) + "|" + localDateStr(weekEnd);

  const viewRange = useMemo(() => {
    if (view === "week") return { start: weekStart, end: weekEnd };
    const start = new Date(monthCursor);
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
    start.setHours(0, 0, 0, 0);
    const last = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const end = new Date(last);
    const endDay = end.getDay();
    end.setDate(last.getDate() + (endDay === 0 ? 0 : 7 - endDay));
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }, [view, weekStart, weekEnd, monthCursor]);

  const visibleShifts = useMemo(() => {
    const startStr = localDateStr(viewRange.start);
    const endStr = localDateStr(viewRange.end);
    return shifts.filter(
      (s) => s.teamId === team.id && s.date >= startStr && s.date <= endStr,
    );
  }, [shifts, team.id, viewRange]);

  const visibleAssignments = useMemo(() => {
    const shiftIds = new Set(visibleShifts.map((s) => s.id));
    return shiftAssignments.filter((a) => shiftIds.has(a.shiftId));
  }, [shiftAssignments, visibleShifts]);

  const activeTemplates = useMemo(
    () => shiftTemplates.filter((t) => t.teamId === team.id && t.isActive && t.recurrenceRule),
    [shiftTemplates, team.id],
  );

  const teamAuditLog = useMemo(
    () => auditLog.filter((a) => a.teamId === team.id).slice(0, 8),
    [auditLog, team.id],
  );

  const goPrev = () => {
    if (view === "month") {
      const prev = new Date(monthCursor);
      prev.setMonth(prev.getMonth() - 1);
      setMonthCursor(prev);
    } else {
      const prev = new Date(weekStart);
      prev.setDate(prev.getDate() - 7);
      setWeekStart(prev);
    }
  };

  const goNext = () => {
    if (view === "month") {
      const next = new Date(monthCursor);
      next.setMonth(next.getMonth() + 1);
      setMonthCursor(next);
    } else {
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      setWeekStart(next);
    }
  };

  const goToday = () => {
    if (view === "month") {
      const now = new Date();
      setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    } else {
      setWeekStart(getMonday(new Date()));
    }
  };

  const handlePublishClick = () => {
    const rangeStart = localDateStr(weekStart);
    const rangeEnd = localDateStr(weekEnd);
    const result = previewShifts(team.id, rangeStart, rangeEnd);
    setExcludedIds(new Set());
    setPublishPreview({ ...result, dateRange: formatDateRange(weekStart) });
  };

  const handleToggleExclude = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmPublish = async () => {
    if (!publishPreview) return;
    const rangeStart = localDateStr(weekStart);
    const rangeEnd = localDateStr(weekEnd);
    const toPublish = publishPreview.planned.filter((s) => !excludedIds.has(s.id));
    const newShifts = await publishShifts(team.id, rangeStart, rangeEnd, toPublish);
    setPublishResult({ count: newShifts.length });
    setPublishPreview(null);
    setExcludedIds(new Set());
  };

  const handleCreateShift = async (shiftData: {
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    requiredCount: number;
  }) => {
    const result = await createShift({
      teamId: team.id,
      title: shiftData.title,
      date: shiftData.date,
      startTime: shiftData.startTime,
      durationMinutes: shiftData.durationMinutes,
      requiredCount: shiftData.requiredCount,
    });
    if (result.ok) {
      setModal({ type: null });
    }
    return result;
  };

  const handleUpdateShift = async (id: string, patch: Partial<Shift>) => {
    const result = await updateShift(id, patch);
    if (result.ok) {
      setModal({ type: null });
    }
    return result;
  };

  const handleDeleteShift = async (id: string) => {
    await deleteShift(id);
    setModal({ type: null });
  };

  const handleAssign = async (personId: string, override?: boolean) => {
    if (modal.type !== "assign") return { ok: false, error: "No shift selected." };
    return assignPerson(modal.shift.id, personId, override);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    await removeAssignment(assignmentId);
  };

  const getAssignmentCount = (shiftId: string) => {
    return visibleAssignments.filter((a) => a.shiftId === shiftId).length;
  };

  const toggleSelect = (shift: Shift) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(shift.id)) next.delete(shift.id);
      else next.add(shift.id);
      return next;
    });
  };

  const handleSelectMode = () => {
    setSelectedIds(new Set());
    setSelectMode(!selectMode);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    await deleteShifts([...selectedIds]);
    setSelectMode(false);
    setSelectedIds(new Set());
    setModal({ type: null });
  };

  const selectedDraftIds = useMemo(
    () => visibleShifts.filter((s) => selectedIds.has(s.id) && s.status === "draft").map((s) => s.id),
    [visibleShifts, selectedIds],
  );

  const handleBulkPublish = async () => {
    if (selectedDraftIds.length === 0) return;
    await Promise.all(selectedDraftIds.map((id) => updateShift(id, { status: "published" })));
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div>
      {showHeader && (
        <>
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeftIcon className="size-4" />
              {team.name}
            </Link>
          )}

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-weak text-primary">
                <CalendarIcon className="size-5" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  Schedule
                </h1>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {team.name}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-8 items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-8 rounded-lg border border-hairline bg-surface-2 px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-8 items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
          <span className="ml-2 text-[15px] font-semibold text-ink">
            {view === "week"
              ? formatDateRange(weekStart)
              : MONTH_NAMES[monthCursor.getMonth()] + " " + monthCursor.getFullYear()}
          </span>
          <div className="ml-3 hidden items-center rounded-lg border border-hairline bg-surface-2 p-0.5 md:flex">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                view === "week" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                view === "month" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setModal({ type: "bulk-create" })}
            className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <PlusIcon className="size-3.5" />
            Bulk add
          </button>
          {view === "week" && selectMode ? (
            <>
              <button
                type="button"
                onClick={handleBulkPublish}
                disabled={selectedDraftIds.length === 0}
                className="flex h-8 items-center gap-2 rounded-lg border border-success/30 bg-success-weak px-3.5 text-[13px] font-medium text-success transition-colors hover:bg-success-weak/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayIcon className="size-3.5" />
                Publish selected ({selectedDraftIds.length})
              </button>
              <button
                type="button"
                onClick={() => setModal({ type: "bulk-delete" })}
                disabled={selectedIds.size === 0}
                className="flex h-8 items-center gap-2 rounded-lg border border-danger/30 bg-danger-weak px-3.5 text-[13px] font-medium text-danger transition-colors hover:bg-danger-weak/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <TrashIcon className="size-3.5" />
                Delete selected ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={handleSelectMode}
                className="h-8 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
              >
                Cancel
              </button>
            </>
          ) : view === "week" ? (
            <button
              type="button"
              onClick={handleSelectMode}
              className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
            >
              <CheckIcon className="size-3.5" />
              Select
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setModal({ type: "create" })}
            className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <PlusIcon className="size-3.5" />
            Add shift
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: "bulk" })}
            className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <UsersIcon className="size-3.5" />
            Bulk assign
          </button>
          {activeTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => handlePublishClick()}
              className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <PlusIcon className="size-3.5" />
              Publish shifts
            </button>
          )}
        </div>
      </div>

      {activeTemplates.length === 0 && visibleShifts.length === 0 && (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <ClockIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">No shifts this week</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Create shift templates with recurrence rules, then publish them to generate concrete shifts.
            Or add ad-hoc shifts manually.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setModal({ type: "create" })}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <PlusIcon className="size-3.5" />
              Add shift
            </button>
            {templatesHref && (
              <Link
                href={templatesHref}
                className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-3"
              >
                <ClockIcon className="size-3.5" />
                Manage templates
              </Link>
            )}
          </div>
        </div>
      )}

      {(activeTemplates.length > 0 || visibleShifts.length > 0) && (
        <div className="mt-4">
          {view === "month" ? (
            <MonthCalendar
              monthStart={monthCursor}
              shifts={visibleShifts}
              assignments={visibleAssignments}
              people={people}
              onClickShift={(shift) => setModal({ type: "assign", shift })}
              onDayClick={(date) => setModal({ type: "create", defaultDate: date })}
            />
          ) : (
            <ShiftCalendar
              key={weekKey}
              weekStart={weekStart}
              shifts={visibleShifts}
              assignments={visibleAssignments}
              people={people}
              onClickShift={(shift) => setModal({ type: "assign", shift })}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </div>
      )}

      {/* Action buttons for each shift */}
      {visibleShifts.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            {view === "week" ? "Shifts this week" : "Shifts in this month"}
          </p>
          <div className="space-y-1.5">
            {visibleShifts.map((shift) => {
              const count = getAssignmentCount(shift.id);
              return (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {shift.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          shift.status === "published"
                            ? "border-success/25 bg-success-weak text-success"
                            : "border-hairline bg-surface-3 text-ink-subtle"
                        }`}
                      >
                        {shift.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-subtle">
                      {shift.date} {" \u00b7 "} {shift.startTime} {" \u00b7 "} {count}/{shift.requiredCount} assigned
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {shift.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => updateShift(shift.id, { status: "published" })}
                        className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-success"
                        title="Publish shift — makes it visible to employees"
                      >
                        <PlayIcon className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModal({ type: "details", shift })}
                      className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                      title="View details"
                    >
                      <ClockIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: "assign", shift })}
                      className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                      title="Assign people"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: "edit", shift })}
                      className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-primary"
                      title="Edit shift"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: "delete", shift })}
                      className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                      title="Delete shift"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {teamAuditLog.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            Recent activity
          </p>
          <div className="divide-y divide-hairline/60 rounded-lg border border-hairline bg-surface-2">
            {teamAuditLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      entry.tone === "success"
                        ? "bg-success"
                        : entry.tone === "warning"
                          ? "bg-warning"
                          : entry.tone === "danger"
                            ? "bg-danger"
                            : "bg-ink-subtle"
                    }`}
                  />
                  <p className="truncate text-[12px] text-ink-muted">{entry.message}</p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-subtle">
                  {formatDateTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal.type === "assign" && (
        <AssignShiftModal
          shift={modal.shift}
          shifts={shifts}
          assignments={shiftAssignments}
          leaveRequests={leaveRequests}
          people={people}
          teamPeople={teamPeople}
          onAssign={handleAssign}
          onRemove={handleRemoveAssignment}
          onClose={() => setModal({ type: null })}
        />
      )}

      {modal.type === "bulk" && (
        <BulkAssignModal
          teamId={team.id}
          teamPeople={teamPeople}
          teamShifts={shifts.filter((s) => s.teamId === team.id)}
          templates={activeTemplates}
          onBulkAssign={bulkAssign}
          onClose={() => setModal({ type: null })}
        />
      )}

      {modal.type === "create" && (
        <CreateShiftModal
          defaultDate={modal.defaultDate}
          onCreate={handleCreateShift}
          onClose={() => setModal({ type: null })}
        />
      )}

      {modal.type === "bulk-create" && (
        <BulkCreateShiftModal
          defaultStartDate={
            shifts.filter((s) => s.teamId === team.id).length > 0
              ? shifts.filter((s) => s.teamId === team.id)[0].date
              : undefined
          }
          onCreate={async (input) => {
            const result = await createShifts({ teamId: team.id, ...input });
            if (result.ok) setModal({ type: null });
            return result;
          }}
          onClose={() => setModal({ type: null })}
        />
      )}

      {modal.type === "bulk-delete" && (
        <Modal
          open
          title={`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? "shift" : "shifts"}?`}
          description="The shifts and their assignments will be permanently removed. This can't be undone."
          tone="danger"
          confirmLabel="Delete"
          onClose={() => setModal({ type: null })}
          onConfirm={handleBulkDeleteConfirm}
        />
      )}

      {modal.type === "edit" && (
        <EditShiftModal
          shift={modal.shift}
          onUpdate={handleUpdateShift}
          onClose={() => setModal({ type: null })}
        />
      )}

      {modal.type === "delete" && (
        <DeleteShiftDialog
          shift={modal.shift}
          assignmentCount={getAssignmentCount(modal.shift.id)}
          onDelete={handleDeleteShift}
          onClose={() => setModal({ type: null })}
        />
      )}

      {modal.type === "details" && (
        <ShiftDetailsPanel
          shift={modal.shift}
          assignments={shiftAssignments}
          people={people}
          onClose={() => setModal({ type: null })}
        />
      )}

      {publishPreview && (
        <PublishPreviewModal
          planned={publishPreview.planned}
          skippedCount={publishPreview.skippedCount}
          conflictIds={publishPreview.conflictIds}
          excludedIds={excludedIds}
          onToggleExclude={handleToggleExclude}
          dateRange={publishPreview.dateRange}
          onPublish={handleConfirmPublish}
          onClose={() => {
            setPublishPreview(null);
            setExcludedIds(new Set());
          }}
        />
      )}

      {publishResult && (
        <Modal
          open
          title="Shifts published"
          description={
            publishResult.count > 0
              ? publishResult.count + " new shift" + (publishResult.count === 1 ? "" : "s") + " created for this week."
              : "No new shifts were created \u2014 all time slots already have shifts."
          }
          confirmLabel="OK"
          onClose={() => setPublishResult(null)}
          onConfirm={() => setPublishResult(null)}
        />
      )}
    </div>
  );
}
