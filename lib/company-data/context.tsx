"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { ReactNode } from "react";
import { RRule } from "rrule";
import { formatDateTime, formatDurationMinutes, localDateStr } from "@/lib/format";
import type { BreakPolicy } from "@/lib/company";
import {
  evaluateBreakCompliance,
  hasApprovedLeaveOn,
  inferBreakType,
  minutesBetween,
  nextId,
  resolveBreakPolicy,
  shiftsOverlap,
  shiftTimesOverlap,
} from "./business";
import { initialState, reducer } from "./reducer";
import {
  inviteEmployee,
  notifyShiftAssigned,
  notifyLeaveReviewed,
  notifySwapProposed,
  notifySwapResponded,
  notifySwapReviewed,
} from "@/lib/supabase/actions";
import {
  deleteAssignmentRow,
  deleteCompanyHolidayRow,
  deleteLocationRow,
  deletePersonalNoteRow,
  deletePersonRow,
  deleteShiftRow,
  deleteShiftsMany,
  deleteShiftTemplateRow,
  deleteTeamNoteRow,
  deleteTeamRow,
  endBreakEntryRow,
  fetchActivity,
  fetchAuditLog,
  fetchBreakEntries,
  fetchClockEntries,
  fetchCompanyHolidays,
  fetchComplianceViolations,
  fetchLeaveRequests,
  fetchLocations,
  fetchPeople,
  fetchPersonalNotes,
  fetchShiftAssignments,
  fetchShifts,
  fetchShiftSwapRequests,
  fetchShiftTemplates,
  fetchTeamNotes,
  fetchTeams,
  insertActivity,
  insertActivityMany,
  insertAssignment,
  insertAssignmentsMany,
  insertAudit,
  insertBreakEntry,
  insertClockEntry,
  insertCompanyHoliday,
  insertCompanyHolidaysMany,
  insertComplianceViolation,
  insertLeaveRequest,
  insertLocation,
  insertPerson,
  insertPersonalNote,
  insertShift,
  insertShiftsMany,
  insertShiftSwapRequest,
  insertShiftTemplate,
  insertTeam,
  insertTeamNote,
  markActivityReadRow,
  markAllActivityReadRow,
  updateAssignmentRow,
  updateClockEntryRow,
  updateCompanyHolidayRow,
  updateLeaveRequestRow,
  updateLocationRow,
  updatePersonalNoteRow,
  updatePersonRow,
  updateShiftRow,
  updateShiftsByTemplate,
  updateShiftSwapRequestRow,
  updateShiftTemplateRow,
  updateTeamNoteRow,
  updateTeamRow,
} from "./queries";
import type {
  ActivityAction,
  AssignmentStatus,
  AuditTone,
  BreakEntry,
  BreakType,
  BulkAssignInput,
  BulkAssignResult,
  BulkAssignSkip,
  ClockAction,
  ClockEntry,
  CompanyContextValue,
  CompanyHoliday,
  CompanyHolidayInput,
  ComplianceViolation,
  InviteInput,
  LeaveRequest,
  LeaveType,
  Location,
  LocationInput,
  Person,
  PersonalNote,
  Shift,
  ShiftAssignment,
  ShiftSwapRequest,
  ShiftTemplate,
  ShiftTemplateInput,
  SwapType,
  Team,
  TeamNote,
} from "./types";

const CompanyContext = createContext<CompanyContextValue | null>(null);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          people,
          teams,
          locations,
          companyHolidays,
          activity,
          clockEntries,
          breakEntries,
          complianceViolations,
          leaveRequests,
          shiftTemplates,
          shifts,
          shiftAssignments,
          auditLog,
          personalNotes,
          teamNotes,
          shiftSwapRequests,
        ] = await Promise.all([
          fetchPeople(),
          fetchTeams(),
          fetchLocations(),
          fetchCompanyHolidays(),
          fetchActivity(),
          fetchClockEntries(),
          fetchBreakEntries(),
          fetchComplianceViolations(),
          fetchLeaveRequests(),
          fetchShiftTemplates(),
          fetchShifts(),
          fetchShiftAssignments(),
          fetchAuditLog(),
          fetchPersonalNotes(),
          fetchTeamNotes(),
          fetchShiftSwapRequests(),
        ]);
        if (cancelled) return;
        dispatch({
          type: "hydrate",
          data: {
            people,
            teams,
            locations,
            companyHolidays,
            activity,
            clockEntries,
            breakEntries,
            complianceViolations,
            leaveRequests,
            shiftTemplates,
            shifts,
            shiftAssignments,
            auditLog,
            personalNotes,
            teamNotes,
            shiftSwapRequests,
          },
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Small helpers to reduce repetition — insert a row then mirror it into
  // the local reducer cache.
  const logActivity = useCallback(
    async (personId: string, action: ActivityAction, message: string) => {
      const entry = await insertActivity({ personId, action, message });
      dispatch({ type: "addActivity", entry });
      return entry;
    },
    [],
  );

  const logAudit = useCallback(
    async (input: {
      action: string;
      tone: AuditTone;
      resource: string;
      resourceId: string;
      teamId?: string;
      message: string;
    }) => {
      const entry = await insertAudit(input);
      dispatch({ type: "addAudit", entry });
      return entry;
    },
    [],
  );

  // ---------------------------------------------------------------------
  // teams
  // ---------------------------------------------------------------------

  const createTeam = useCallback(
    async (
      name: string,
      description?: string,
      locationId?: string | null,
      managerId?: string | null,
      leaveApproverId?: string | null,
    ): Promise<Team | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (state.teams.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
        return null;
      }
      try {
        const team = await insertTeam({
          name: trimmed,
          description: description?.trim() || undefined,
          locationId: locationId ?? null,
          managerId: managerId ?? null,
          leaveApproverId: leaveApproverId ?? null,
        });
        dispatch({ type: "createTeam", team });
        return team;
      } catch {
        return null;
      }
    },
    [state.teams],
  );

  const updateTeam = useCallback(
    async (id: string, patch: Partial<Team>): Promise<boolean> => {
      if (patch.name !== undefined && !patch.name.trim()) return false;
      try {
        const updated = await updateTeamRow(id, patch);
        dispatch({ type: "updateTeam", id, patch: updated });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const deleteTeam = useCallback(async (id: string) => {
    await deleteTeamRow(id);
    dispatch({ type: "deleteTeam", id });
  }, []);

  // ---------------------------------------------------------------------
  // people
  // ---------------------------------------------------------------------

  const invitePerson = useCallback(
    async (
      input: InviteInput,
    ): Promise<{ ok: boolean; error?: string; personId?: string }> => {
      const email = input.email.trim().toLowerCase();
      if (!input.name.trim() || !email) {
        return { ok: false, error: "Name and email are required." };
      }
      if (state.people.some((p) => p.email.toLowerCase() === email)) {
        return {
          ok: false,
          error: "Someone with that email is already in this company.",
        };
      }
      try {
        const person = await insertPerson({
          name: input.name.trim(),
          email,
          phone: input.phone?.trim() || undefined,
          role: input.role,
          teamIds: input.teamIds,
          locationId: input.locationId,
          timezone: input.timezone,
          designation: input.designation?.trim() || undefined,
          status: "invited",
        });
        dispatch({ type: "addPerson", person });
        await logActivity(person.id, "invited", "Invited to the company");
        await logAudit({
          action: "person.invited",
          tone: "success",
          resource: "Person",
          resourceId: person.id,
          teamId: input.teamIds[0] ?? undefined,
          message: `${person.name} invited as ${person.role}`,
        });
        return { ok: true, personId: person.id };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.people, logActivity, logAudit],
  );

  const updatePerson = useCallback(
    async (id: string, patch: Partial<Person>): Promise<boolean> => {
      try {
        const target = state.people.find((p) => p.id === id);
        const demoting =
          !!target &&
          patch.role !== undefined &&
          patch.role !== "manager" &&
          target.role === "manager";
        const updated = await updatePersonRow(id, patch);
        dispatch({ type: "updatePerson", id, patch: updated });
        if (demoting) {
          const affectedTeams = state.teams.filter((t) => t.managerId === id);
          for (const t of affectedTeams) {
            const updatedTeam = await updateTeamRow(t.id, { managerId: null });
            dispatch({ type: "updateTeam", id: t.id, patch: updatedTeam });
          }
        }
        await logActivity(id, "updated", "Profile updated");
        return true;
      } catch {
        return false;
      }
    },
    [state.people, state.teams, logActivity],
  );

  const resendInvite = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const person = state.people.find((p) => p.id === id);
      if (!person) {
        return { ok: false, error: "Person not found." };
      }
      try {
        const result = await inviteEmployee({
          email: person.email,
          personId: id,
          role: person.role,
        });
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        const updated = await updatePersonRow(id, { status: "invited" });
        dispatch({ type: "updatePerson", id, patch: updated });
        await logActivity(id, "resent", "Invite resent");
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.people, logActivity],
  );

  const deletePerson = useCallback(async (id: string) => {
    await deletePersonRow(id);
    dispatch({ type: "deletePerson", id });
  }, []);

  // ---------------------------------------------------------------------
  // locations
  // ---------------------------------------------------------------------

  const createLocation = useCallback(
    async (input: LocationInput): Promise<Location | null> => {
      const trimmed = input.name.trim();
      if (!trimmed) return null;
      if (state.locations.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) {
        return null;
      }
      try {
        const location = await insertLocation({
          name: trimmed,
          description: input.description?.trim() || undefined,
          address: input.address?.trim() || undefined,
          city: input.city?.trim() || undefined,
          state: input.state?.trim() || undefined,
          country: input.country?.trim() || undefined,
          active: input.active,
        });
        dispatch({ type: "createLocation", location });
        return location;
      } catch {
        return null;
      }
    },
    [state.locations],
  );

  const updateLocation = useCallback(
    async (id: string, patch: Partial<Location>): Promise<boolean> => {
      if (patch.name !== undefined && !patch.name.trim()) return false;
      try {
        const updated = await updateLocationRow(id, patch);
        dispatch({ type: "updateLocation", id, patch: updated });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const deleteLocation = useCallback(async (id: string) => {
    await deleteLocationRow(id);
    dispatch({ type: "deleteLocation", id });
  }, []);

  // ---------------------------------------------------------------------
  // company holidays
  // ---------------------------------------------------------------------

  const createCompanyHoliday = useCallback(
    async (input: CompanyHolidayInput): Promise<CompanyHoliday | null> => {
      try {
        const holiday = await insertCompanyHoliday(input);
        dispatch({ type: "createCompanyHoliday", holiday });
        return holiday;
      } catch {
        return null;
      }
    },
    [],
  );

  const updateCompanyHoliday = useCallback(
    async (id: string, patch: Partial<CompanyHoliday>): Promise<boolean> => {
      try {
        const updated = await updateCompanyHolidayRow(id, patch);
        dispatch({ type: "updateCompanyHoliday", id, patch: updated });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const deleteCompanyHoliday = useCallback(async (id: string) => {
    await deleteCompanyHolidayRow(id);
    dispatch({ type: "deleteCompanyHoliday", id });
  }, []);

  const getHolidaysInRange = useCallback(
    (start: string, end: string): Map<string, string> => {
      const map = new Map<string, string>();
      for (const h of state.companyHolidays) {
        if (!h.isActive) continue;
        if (h.endDate < start || h.startDate > end) continue;
        // Expand multi-day holiday into individual date keys
        const d = new Date(h.startDate + "T00:00:00");
        const last = new Date(h.endDate + "T00:00:00");
        while (d <= last) {
          const key = d.toISOString().slice(0, 10);
          if (key >= start && key <= end) map.set(key, h.name);
          d.setDate(d.getDate() + 1);
        }
      }
      return map;
    },
    [state.companyHolidays],
  );

  const importCompanyHolidays = useCallback(
    async (
      inputs: CompanyHolidayInput[],
    ): Promise<{ ok: boolean; error?: string; count: number }> => {
      try {
        const inserted = await insertCompanyHolidaysMany(inputs);
        dispatch({ type: "addCompanyHolidays", holidays: inserted });
        return { ok: true, count: inserted.length };
      } catch (e) {
        return { ok: false, error: errorMessage(e), count: 0 };
      }
    },
    [],
  );

  // ---------------------------------------------------------------------
  // clock / breaks / compliance
  // ---------------------------------------------------------------------

  const addClockEntry = useCallback(
    async (personId: string, action: ClockAction, note?: string) => {
      const at = new Date().toISOString();
      const entry = await insertClockEntry({ personId, action, at, note: note?.trim() || undefined });
      dispatch({ type: "addClockEntry", entry });

      if (action !== "out") return;

      const session = state.clockEntries
        .filter((c) => c.personId === personId && c.action === "in")
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      if (!session) return;

      const person = state.people.find((p) => p.id === personId);
      let sessionBreaks = state.breakEntries.filter((b) => b.clockEntryId === session.id);

      const openBreak = sessionBreaks.find((b) => !b.breakOutAt);
      if (openBreak) {
        const durationMinutes = minutesBetween(openBreak.breakInAt, at);
        await endBreakEntryRow(openBreak.id, at, durationMinutes);
        dispatch({
          type: "endBreakEntry",
          id: openBreak.id,
          breakOutAt: at,
          durationMinutes,
        });
        await logAudit({
          action: "break.auto_closed",
          tone: "warning",
          resource: "BreakEntry",
          resourceId: openBreak.id,
          teamId: person?.teamIds[0] ?? undefined,
          message: `${person?.name ?? "Someone"}'s ${openBreak.type} break auto-closed on clock out (${formatDurationMinutes(durationMinutes)})`,
        });
        sessionBreaks = sessionBreaks.map((b) =>
          b.id === openBreak.id ? { ...b, breakOutAt: at, durationMinutes } : b,
        );
      }

      const sessionMinutes = minutesBetween(session.at, at);
      const policy = await resolveBreakPolicy(state, personId, session.at);
      const violations = evaluateBreakCompliance(sessionMinutes, sessionBreaks, policy);
      for (const v of violations) {
        const violation = await insertComplianceViolation({
          personId,
          clockEntryId: session.id,
          type: v.type,
          severity: v.severity,
          description: v.description,
          detectedAt: at,
        });
        dispatch({ type: "addComplianceViolation", violation });
        await logActivity(personId, "notified", v.description);
        await logAudit({
          action: `compliance.${v.type}`,
          tone: v.severity === "critical" ? "danger" : "warning",
          resource: "ComplianceViolation",
          resourceId: violation.id,
          teamId: person?.teamIds[0] ?? undefined,
          message: `${person?.name ?? "Someone"}: ${v.description}`,
        });
      }
    },
    [state, logActivity, logAudit],
  );

  const editClockEntry = useCallback(
    async (
      id: string,
      patch: { action?: ClockAction; at?: string; note?: string },
      reason: string,
      editedBy: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const original = state.clockEntries.find((c) => c.id === id);
      if (!original) return { ok: false, error: "Entry not found." };
      const trimmedReason = reason.trim();
      if (!trimmedReason) return { ok: false, error: "A reason is required." };
      const editedAt = new Date().toISOString();

      let updated: ClockEntry;
      try {
        updated = await updateClockEntryRow(id, {
          ...patch,
          editedBy,
          editedAt,
          editReason: trimmedReason,
        });
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
      dispatch({ type: "updateClockEntry", id, patch: updated });

      const person = state.people.find((p) => p.id === original.personId);
      const fromLabel = `${original.action} @ ${formatDateTime(original.at)}`;
      const toLabel = `${updated.action} @ ${formatDateTime(updated.at)}`;

      await logActivity(
        original.personId,
        "notified",
        `Your clock-${original.action} entry was corrected by ${editedBy} (${fromLabel} → ${toLabel}) — ${trimmedReason}`,
      );
      await logAudit({
        action: "clock_entry.edited",
        tone: "warning",
        resource: "ClockEntry",
        resourceId: id,
        teamId: person?.teamIds[0] ?? undefined,
        message: `${editedBy} edited ${person?.name ?? "someone"}'s clock entry: ${fromLabel} → ${toLabel} — ${trimmedReason}`,
      });
      return { ok: true };
    },
    [state.clockEntries, state.people, logActivity, logAudit],
  );

  const startBreak = useCallback(
    async (
      personId: string,
      type?: BreakType,
    ): Promise<{ ok: boolean; error?: string; entry?: BreakEntry }> => {
      const latestEntry = state.clockEntries
        .filter((c) => c.personId === personId)
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      if (!latestEntry || latestEntry.action !== "in") {
        return { ok: false, error: "You must be clocked in to start a break." };
      }
      const session = latestEntry;
      const alreadyOnBreak = state.breakEntries.some(
        (b) => b.clockEntryId === session.id && !b.breakOutAt,
      );
      if (alreadyOnBreak) {
        return { ok: false, error: "You are already on a break." };
      }

      const policy = await resolveBreakPolicy(state, personId, session.at);
      if (!policy.enabled) {
        return { ok: false, error: "Break tracking is disabled for this shift." };
      }

      const now = new Date().toISOString();
      const sessionMinutes = minutesBetween(session.at, now);
      const existingTypes = state.breakEntries
        .filter((b) => b.clockEntryId === session.id)
        .map((b) => b.type);
      const resolvedType = type ?? inferBreakType(sessionMinutes, existingTypes, policy);

      const countForType = state.breakEntries.filter(
        (b) => b.clockEntryId === session.id && b.type === resolvedType,
      ).length;
      const cap =
        resolvedType === "meal" ? policy.maxMealBreaksPerShift : policy.maxRestBreaksPerShift;
      if (countForType >= cap) {
        return {
          ok: false,
          error: `${resolvedType === "meal" ? "Meal" : "Rest"} break limit reached (${cap}/shift).`,
        };
      }

      try {
        const entry = await insertBreakEntry({
          clockEntryId: session.id,
          personId,
          type: resolvedType,
          breakInAt: now,
        });
        dispatch({ type: "addBreakEntry", entry });

        const person = state.people.find((p) => p.id === personId);
        await logAudit({
          action: "break.started",
          tone: "neutral",
          resource: "BreakEntry",
          resourceId: entry.id,
          teamId: person?.teamIds[0] ?? undefined,
          message: `${person?.name ?? "Someone"} started a ${resolvedType} break`,
        });

        return { ok: true, entry };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state, logAudit],
  );

  const endBreak = useCallback(
    async (breakId: string): Promise<{ ok: boolean; error?: string }> => {
      const existing = state.breakEntries.find((b) => b.id === breakId);
      if (!existing || existing.breakOutAt) {
        return { ok: false, error: "Break not found or already ended." };
      }
      try {
        const now = new Date().toISOString();
        const durationMinutes = minutesBetween(existing.breakInAt, now);
        await endBreakEntryRow(breakId, now, durationMinutes);
        dispatch({
          type: "endBreakEntry",
          id: breakId,
          breakOutAt: now,
          durationMinutes,
        });

        const person = state.people.find((p) => p.id === existing.personId);
        const session = state.clockEntries.find((c) => c.id === existing.clockEntryId);
        const policy = await resolveBreakPolicy(
          state,
          existing.personId,
          session?.at ?? existing.breakInAt,
        );
        const minMinutes =
          existing.type === "meal" ? policy.mealBreakMinMinutes : policy.restBreakMinMinutes;
        const tooShort = durationMinutes < minMinutes;
        await logAudit({
          action: "break.ended",
          tone: tooShort ? "warning" : "neutral",
          resource: "BreakEntry",
          resourceId: breakId,
          teamId: person?.teamIds[0] ?? undefined,
          message: `${person?.name ?? "Someone"} ended a ${existing.type} break (${formatDurationMinutes(durationMinutes)})${tooShort ? " — under minimum" : ""}`,
        });

        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state, logAudit],
  );

  const getActiveBreakForPerson = useCallback(
    (personId: string): BreakEntry | null => {
      const session = state.clockEntries
        .filter((c) => c.personId === personId && c.action === "in")
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      if (!session) return null;
      return state.breakEntries.find((b) => b.clockEntryId === session.id && !b.breakOutAt) ?? null;
    },
    [state.clockEntries, state.breakEntries],
  );

  const getBreaksForClockEntry = useCallback(
    (clockEntryId: string): BreakEntry[] =>
      state.breakEntries.filter((b) => b.clockEntryId === clockEntryId),
    [state.breakEntries],
  );

  const getViolationsForClockEntry = useCallback(
    (clockEntryId: string): ComplianceViolation[] =>
      state.complianceViolations.filter((v) => v.clockEntryId === clockEntryId),
    [state.complianceViolations],
  );

  const getBreakPolicyForPerson = useCallback(
    async (personId: string): Promise<BreakPolicy> => {
      const latestEntry = state.clockEntries
        .filter((c) => c.personId === personId)
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      return resolveBreakPolicy(state, personId, latestEntry?.at ?? new Date().toISOString());
    },
    [state],
  );

  // ---------------------------------------------------------------------
  // leave requests
  // ---------------------------------------------------------------------

  const requestLeave = useCallback(
    async (
      personId: string,
      input: { type: LeaveType; startDate: string; endDate: string; reason?: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!input.startDate || !input.endDate) {
        return { ok: false, error: "Start and end dates are required." };
      }
      if (input.endDate < input.startDate) {
        return { ok: false, error: "End date must be on or after start date." };
      }
      try {
        const request = await insertLeaveRequest({
          personId,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason?.trim() || undefined,
        });
        dispatch({ type: "addLeaveRequest", request });
        const person = state.people.find((p) => p.id === personId);
        const managerIds = new Set(
          state.teams
            .filter((t) => person?.teamIds.includes(t.id) && t.managerId)
            .map((t) => t.managerId as string),
        );
        for (const managerId of managerIds) {
          await logActivity(
            managerId,
            "notified",
            `${person?.name ?? "Someone"} requested ${request.type} leave (${request.startDate} – ${request.endDate})`,
          );
        }
        await logAudit({
          action: "time_off.create",
          tone: "neutral",
          resource: "LeaveRequest",
          resourceId: request.id,
          teamId: person?.teamIds[0] ?? undefined,
          message: `${person?.name ?? "Someone"} requested ${request.type} leave (${request.startDate} – ${request.endDate})`,
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.people, state.teams, logActivity, logAudit],
  );

  const updateLeaveRequest = useCallback(
    async (id: string, patch: Partial<LeaveRequest>): Promise<boolean> => {
      const existing = state.leaveRequests.find((l) => l.id === id);
      if (!existing) return false;
      if (existing.status !== "pending") return false;
      if (patch.endDate !== undefined && patch.startDate !== undefined) {
        const start = patch.startDate ?? existing.startDate;
        const end = patch.endDate ?? existing.endDate;
        if (end < start) return false;
      }
      try {
        const updated = await updateLeaveRequestRow(id, patch);
        dispatch({ type: "updateLeaveRequest", id, patch: updated });
        return true;
      } catch {
        return false;
      }
    },
    [state.leaveRequests],
  );

  const cancelLeaveRequest = useCallback(async (id: string) => {
    await updateLeaveRequestRow(id, { status: "cancelled" });
    dispatch({ type: "cancelLeaveRequest", id });
  }, []);

  const reviewLeave = useCallback(
    async (
      id: string,
      status: "approved" | "denied",
      reviewedBy: string,
      reviewerComment?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const reviewedAt = new Date().toISOString();
      try {
        await updateLeaveRequestRow(id, { status, reviewerComment, reviewedBy, reviewedAt });
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
      dispatch({ type: "reviewLeaveRequest", id, status, reviewerComment, reviewedBy, reviewedAt });
      const request = state.leaveRequests.find((l) => l.id === id);
      if (!request) return { ok: true };
      const person = state.people.find((p) => p.id === request.personId);
      await logActivity(
        request.personId,
        "notified",
        `Your ${request.type} leave (${request.startDate} – ${request.endDate}) was ${status}${
          reviewerComment ? ` — ${reviewerComment}` : ""
        }`,
      );
      await logAudit({
        action: `time_off.${status}`,
        tone: status === "approved" ? "success" : "warning",
        resource: "LeaveRequest",
        resourceId: request.id,
        teamId: person?.teamIds[0] ?? undefined,
        message: `${reviewedBy} ${status} ${person?.name ?? "someone"}'s ${request.type} leave (${request.startDate} – ${request.endDate})`,
      });
      notifyLeaveReviewed(id).catch(() => {});
      return { ok: true };
    },
    [state.leaveRequests, state.people, logActivity, logAudit],
  );

  const approveLeave = useCallback(
    (id: string, reviewedBy: string) => reviewLeave(id, "approved", reviewedBy),
    [reviewLeave],
  );

  const denyLeave = useCallback(
    (id: string, reviewedBy: string, comment?: string) =>
      reviewLeave(id, "denied", reviewedBy, comment?.trim() || undefined),
    [reviewLeave],
  );

  const revertLeaveApproval = useCallback(
    async (id: string, revertedBy: string): Promise<{ ok: boolean; error?: string }> => {
      const request = state.leaveRequests.find((l) => l.id === id);
      if (!request || request.status !== "approved") return { ok: false, error: "Not approved." };
      try {
        await updateLeaveRequestRow(id, { status: "pending" });
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
      dispatch({
        type: "reviewLeaveRequest",
        id,
        status: "pending",
        reviewerComment: undefined,
        reviewedBy: undefined,
        reviewedAt: undefined,
      });
      const person = state.people.find((p) => p.id === request.personId);
      await logActivity(
        request.personId,
        "notified",
        `Your approved ${request.type} leave (${request.startDate} – ${request.endDate}) was reverted to pending by ${revertedBy}`,
      );
      await logAudit({
        action: "time_off.reverted",
        tone: "warning",
        resource: "LeaveRequest",
        resourceId: request.id,
        teamId: person?.teamIds[0] ?? undefined,
        message: `${revertedBy} reverted approval for ${person?.name ?? "someone"}'s ${request.type} leave (${request.startDate} – ${request.endDate})`,
      });
      return { ok: true };
    },
    [state.leaveRequests, state.people, logActivity, logAudit],
  );

  // ---------------------------------------------------------------------
  // activity
  // ---------------------------------------------------------------------

  const markActivityRead = useCallback(async (id: string) => {
    await markActivityReadRow(id);
    dispatch({ type: "markActivityRead", id });
  }, []);

  const markAllActivityRead = useCallback(async (personId: string) => {
    await markAllActivityReadRow(personId);
    dispatch({ type: "markAllActivityRead", personId });
  }, []);

  // ---------------------------------------------------------------------
  // shift templates
  // ---------------------------------------------------------------------

  const createShiftTemplate = useCallback(
    async (
      input: ShiftTemplateInput,
    ): Promise<{ ok: boolean; error?: string; template?: ShiftTemplate }> => {
      const trimmed = input.title.trim();
      if (!trimmed) return { ok: false, error: "Title is required." };
      if (input.durationMinutes <= 0) return { ok: false, error: "Duration must be greater than 0." };
      if (input.requiredCount < 1) return { ok: false, error: "Staff required must be at least 1." };
      if (input.maxCount !== undefined && input.maxCount < input.requiredCount) {
        return { ok: false, error: "Max count must be greater than or equal to staff required." };
      }
      try {
        const template = await insertShiftTemplate({
          teamId: input.teamId,
          title: trimmed,
          description: input.description?.trim() || undefined,
          durationMinutes: input.durationMinutes,
          startTime: input.startTime,
          requiredCount: input.requiredCount,
          maxCount: input.maxCount,
          isActive: input.isActive,
          recurrenceRule: input.recurrenceRule?.trim() || undefined,
          breakPolicyOverride: input.breakPolicyOverride,
        });
        dispatch({ type: "createShiftTemplate", template });
        await logAudit({
          action: "template.created",
          tone: "success",
          resource: "ShiftTemplate",
          resourceId: template.id,
          teamId: template.teamId,
          message: `Template "${template.title}" created`,
        });
        return { ok: true, template };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [logAudit],
  );

  const updateShiftTemplate = useCallback(
    async (id: string, patch: Partial<ShiftTemplate>): Promise<boolean> => {
      if (patch.title !== undefined && !patch.title.trim()) return false;
      const existing = state.shiftTemplates.find((t) => t.id === id);
      try {
        const updated = await updateShiftTemplateRow(id, patch);
        dispatch({ type: "updateShiftTemplate", id, patch: updated });
        if (existing) {
          await logAudit({
            action: "template.updated",
            tone: "neutral",
            resource: "ShiftTemplate",
            resourceId: id,
            teamId: existing.teamId,
            message: `Template "${updated.title}" updated`,
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [state.shiftTemplates, logAudit],
  );

  const deleteShiftTemplate = useCallback(
    async (id: string) => {
      const existing = state.shiftTemplates.find((t) => t.id === id);
      await deleteShiftTemplateRow(id);
      dispatch({ type: "deleteShiftTemplate", id });
      if (existing) {
        await logAudit({
          action: "template.deleted",
          tone: "warning",
          resource: "ShiftTemplate",
          resourceId: id,
          teamId: existing.teamId,
          message: `Template "${existing.title}" deleted`,
        });
      }
    },
    [state.shiftTemplates, logAudit],
  );

  const getShiftTemplatesByTeam = useCallback(
    (teamId: string) => state.shiftTemplates.filter((t) => t.teamId === teamId),
    [state.shiftTemplates],
  );

  // ---------------------------------------------------------------------
  // shifts (preview stays sync/pure — RRule expansion over hydrated state)
  // ---------------------------------------------------------------------

  const previewShifts = useCallback(
    (
      teamId: string,
      rangeStart: string,
      rangeEnd: string,
    ): { planned: Shift[]; skippedCount: number; conflictIds: string[] } => {
      const templates = state.shiftTemplates.filter(
        (t) => t.teamId === teamId && t.isActive && t.recurrenceRule,
      );
      const start = new Date(rangeStart + "T00:00:00");
      const end = new Date(rangeEnd + "T23:59:59");
      const planned: Shift[] = [];
      let skippedCount = 0;
      const existingDates = new Set(
        state.shifts.filter((s) => s.teamId === teamId).map((s) => `${s.date}|${s.startTime}`),
      );
      for (const template of templates) {
        try {
          const rule = RRule.fromString(template.recurrenceRule!);
          const dates = rule.between(start, end, true);
          for (const date of dates) {
            const dateStr = date.toISOString().slice(0, 10);
            const key = `${dateStr}|${template.startTime}`;
            if (existingDates.has(key)) {
              skippedCount++;
              continue;
            }
            planned.push({
              id: nextId("shift"),
              teamId,
              templateId: template.id,
              title: template.title,
              description: template.description,
              date: dateStr,
              startTime: template.startTime,
              durationMinutes: template.durationMinutes,
              requiredCount: template.requiredCount,
              status: "draft",
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // invalid RRULE — skip this template
        }
      }

      const conflictIds = new Set<string>();
      const existingShifts = state.shifts.filter((s) => s.teamId === teamId);
      for (let i = 0; i < planned.length; i++) {
        const p = planned[i];
        if (existingShifts.some((ex) => shiftsOverlap(p, ex))) {
          conflictIds.add(p.id);
        }
        for (let j = i + 1; j < planned.length; j++) {
          if (shiftsOverlap(p, planned[j])) {
            conflictIds.add(p.id);
            conflictIds.add(planned[j].id);
          }
        }
      }

      return { planned, skippedCount, conflictIds: Array.from(conflictIds) };
    },
    [state.shiftTemplates, state.shifts],
  );

  const publishShifts = useCallback(
    async (
      teamId: string,
      rangeStart: string,
      rangeEnd: string,
      shiftsToPublish?: Shift[],
    ): Promise<Shift[]> => {
      const toPublish = shiftsToPublish ?? previewShifts(teamId, rangeStart, rangeEnd).planned;
      if (toPublish.length === 0) return toPublish;

      const inserted = await insertShiftsMany(
        toPublish.map((s) => ({
          teamId: s.teamId,
          templateId: s.templateId,
          title: s.title,
          description: s.description,
          date: s.date,
          startTime: s.startTime,
          durationMinutes: s.durationMinutes,
          requiredCount: s.requiredCount,
          status: "published",
        })),
      );
      dispatch({ type: "addShifts", shifts: inserted });

      const team = state.teams.find((t) => t.id === teamId);
      await logAudit({
        action: "shift.published",
        tone: "success",
        resource: "Shift",
        resourceId: teamId,
        teamId,
        message: `${inserted.length} shift${inserted.length === 1 ? "" : "s"} published for ${team?.name ?? "team"} (${rangeStart} – ${rangeEnd})`,
      });

      const teamMembers = state.people.filter(
        (p) => p.teamIds.includes(teamId) && p.status !== "inactive",
      );
      if (teamMembers.length > 0) {
        const activityRows = await insertActivityMany(
          teamMembers.map((p) => ({
            personId: p.id,
            action: "notified" as ActivityAction,
            message: `New shifts published for ${rangeStart} – ${rangeEnd}`,
          })),
        );
        for (const row of activityRows) {
          dispatch({ type: "addActivity", entry: row });
        }
      }

      return inserted;
    },
    [previewShifts, state.teams, state.people, logAudit],
  );

  const createShift = useCallback(
    async (input: {
      teamId: string;
      title: string;
      date: string;
      startTime: string;
      durationMinutes: number;
      requiredCount: number;
      templateId?: string;
    }): Promise<{ ok: boolean; error?: string; shift?: Shift }> => {
      const trimmed = input.title.trim();
      if (!trimmed) return { ok: false, error: "Title is required." };
      if (!input.date) return { ok: false, error: "Date is required." };
      if (input.date < localDateStr(new Date())) return { ok: false, error: "Cannot create shift for a past date." };
      if (input.durationMinutes <= 0) return { ok: false, error: "Duration must be greater than 0." };
      if (input.requiredCount < 1) return { ok: false, error: "Staff required must be at least 1." };
      // Check against company holidays
      for (const h of state.companyHolidays) {
        if (!h.isActive) continue;
        if (input.date >= h.startDate && input.date <= h.endDate) {
          return { ok: false, error: `Cannot create shift on a company holiday (${h.name}).` };
        }
      }
      try {
        const shift = await insertShift({
          teamId: input.teamId,
          title: trimmed,
          date: input.date,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          requiredCount: input.requiredCount,
          templateId: input.templateId,
        });
        dispatch({ type: "createShift", shift });
        return { ok: true, shift };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.companyHolidays],
  );

  const deleteShift = useCallback(
    async (id: string) => {
      const shift = state.shifts.find((s) => s.id === id);
      // Capture assignees before the delete cascades shift_assignments rows.
      const assignees = state.shiftAssignments.filter(
        (a) => a.shiftId === id && a.status === "approved",
      );
      await deleteShiftRow(id);
      dispatch({ type: "deleteShift", id });
      for (const a of assignees) {
        await logActivity(
          a.personId,
          "notified",
          `Shift "${shift?.title ?? "shift"}" on ${shift?.date ?? ""} was cancelled`,
        );
      }
      if (shift) {
        await logAudit({
          action: "shift.deleted",
          tone: "warning",
          resource: "Shift",
          resourceId: id,
          teamId: shift.teamId,
          message: `Shift "${shift.title}" on ${shift.date} deleted`,
        });
      }
    },
    [state.shifts, state.shiftAssignments, logActivity, logAudit],
  );

  const deleteShifts = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const shifts = state.shifts.filter((s) => ids.includes(s.id));
      const assigneesByShift = new Map(
        ids.map((id) => [
          id,
          state.shiftAssignments.filter((a) => a.shiftId === id && a.status === "approved"),
        ]),
      );
      await deleteShiftsMany(ids);
      dispatch({ type: "deleteShifts", ids });
      for (const shift of shifts) {
        for (const a of assigneesByShift.get(shift.id) ?? []) {
          await logActivity(
            a.personId,
            "notified",
            `Shift "${shift.title}" on ${shift.date} was cancelled`,
          );
        }
      }
    },
    [state.shifts, state.shiftAssignments, logActivity],
  );

  const createShifts = useCallback(
    async (input: {
      teamId: string;
      title: string;
      startTime: string;
      durationMinutes: number;
      requiredCount: number;
      dates: string[];
      templateId?: string;
    }): Promise<{ ok: boolean; error?: string; count: number }> => {
      if (!input.title.trim()) return { ok: false, error: "Title is required.", count: 0 };
      if (input.dates.length === 0) return { ok: false, error: "Pick at least one date.", count: 0 };
      if (input.durationMinutes <= 0)
        return { ok: false, error: "Duration must be greater than 0.", count: 0 };
      if (input.requiredCount < 1)
        return { ok: false, error: "Staff required must be at least 1.", count: 0 };
      // Filter out holiday dates
      const holidayDates = new Set<string>();
      for (const h of state.companyHolidays) {
        if (!h.isActive) continue;
        const d = new Date(h.startDate + "T00:00:00");
        const last = new Date(h.endDate + "T00:00:00");
        while (d <= last) {
          holidayDates.add(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 1);
        }
      }
      const validDates = input.dates.filter((d) => !holidayDates.has(d));
      if (validDates.length === 0)
        return { ok: false, error: "All selected dates fall on company holidays.", count: 0 };
      try {
        const inserted = await insertShiftsMany(
          validDates.map((date) => ({
            teamId: input.teamId,
            title: input.title.trim(),
            date,
            startTime: input.startTime,
            durationMinutes: input.durationMinutes,
            requiredCount: input.requiredCount,
            templateId: input.templateId,
          })),
        );
        dispatch({ type: "addShifts", shifts: inserted });
        return { ok: true, count: inserted.length };
      } catch (e) {
        return { ok: false, error: errorMessage(e), count: 0 };
      }
    },
    [state.companyHolidays],
  );

  const applyTemplateToShifts = useCallback(
    async (
      templateId: string,
      patch: Partial<Shift>,
      rangeStart?: string,
      rangeEnd?: string,
    ): Promise<number> => {
      const rows = await updateShiftsByTemplate(templateId, patch, rangeStart, rangeEnd);
      if (rows.length > 0) {
        dispatch({ type: "updateTemplateShifts", templateId, patch, rangeStart, rangeEnd });
      }
      return rows.length;
    },
    [],
  );

  const updateShift = useCallback(
    async (id: string, patch: Partial<Shift>): Promise<{ ok: boolean; error?: string }> => {
      if (patch.title !== undefined && !patch.title.trim()) {
        return { ok: false, error: "Title is required." };
      }
      if (patch.durationMinutes !== undefined && patch.durationMinutes <= 0) {
        return { ok: false, error: "Duration must be greater than 0." };
      }
      if (patch.requiredCount !== undefined && patch.requiredCount < 1) {
        return { ok: false, error: "Staff required must be at least 1." };
      }
      try {
        const existing = state.shifts.find((s) => s.id === id);
        const updated = await updateShiftRow(id, patch);
        dispatch({ type: "updateShift", id, patch: updated });

        const title = updated.title ?? existing?.title ?? "shift";
        const date = updated.date ?? existing?.date ?? "";
        const startTime = updated.startTime ?? existing?.startTime ?? "";
        const assignees = state.shiftAssignments.filter(
          (a) => a.shiftId === id && a.status === "approved",
        );
        for (const a of assignees) {
          await logActivity(
            a.personId,
            "notified",
            `Shift "${title}" was updated — now ${date} at ${startTime}`,
          );
        }
        if (existing) {
          await logAudit({
            action: "shift.updated",
            tone: "neutral",
            resource: "Shift",
            resourceId: id,
            teamId: existing.teamId,
            message: `Shift "${title}" updated`,
          });
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.shifts, state.shiftAssignments, logActivity, logAudit],
  );

  // ---------------------------------------------------------------------
  // assignments
  // ---------------------------------------------------------------------

  const assignPerson = useCallback(
    async (
      shiftId: string,
      personId: string,
      override = false,
    ): Promise<{ ok: boolean; error?: string; conflict?: boolean }> => {
      const already = state.shiftAssignments.some(
        (a) => a.shiftId === shiftId && a.personId === personId,
      );
      if (already) return { ok: false, error: "This person is already assigned to this shift." };

      const targetShift = state.shifts.find((s) => s.id === shiftId);
      if (!targetShift) return { ok: false, error: "Shift not found." };

      if (!override) {
        const approvedLeave = hasApprovedLeaveOn(personId, targetShift.date, state.leaveRequests);
        if (approvedLeave) {
          return {
            ok: false,
            conflict: true,
            error: `TIME_OFF_CONFLICT: ${approvedLeave.type} leave approved ${approvedLeave.startDate} – ${approvedLeave.endDate}.`,
          };
        }

        const personShiftIds = new Set(
          state.shiftAssignments.filter((a) => a.personId === personId).map((a) => a.shiftId),
        );
        const conflictingShift = state.shifts.find(
          (s) => s.id !== shiftId && personShiftIds.has(s.id) && shiftsOverlap(s, targetShift),
        );
        if (conflictingShift) {
          return {
            ok: false,
            conflict: true,
            error: `Conflicts with "${conflictingShift.title}" on ${conflictingShift.date} at ${conflictingShift.startTime}.`,
          };
        }
      }

      try {
        const now = new Date().toISOString();
        const assignment = await insertAssignment({
          shiftId,
          personId,
          status: "approved",
          approvedAt: now,
        });
        dispatch({ type: "addAssignment", assignment });

        await logActivity(
          personId,
          "notified",
          `Assigned to "${targetShift.title}" on ${targetShift.date} at ${targetShift.startTime}`,
        );

        const person = state.people.find((p) => p.id === personId);
        await logAudit({
          action: override ? "shift.assigned.override" : "shift.assigned",
          tone: override ? "warning" : "success",
          resource: "ShiftAssignment",
          resourceId: assignment.id,
          teamId: targetShift.teamId,
          message: `${person?.name ?? "Someone"} assigned to "${targetShift.title}" on ${targetShift.date}${override ? " (conflict overridden)" : ""}`,
        });

        notifyShiftAssigned(shiftId, personId).catch(() => {});

        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.shiftAssignments, state.shifts, state.people, state.leaveRequests, logActivity, logAudit],
  );

  const removeAssignment = useCallback(async (id: string) => {
    await deleteAssignmentRow(id);
    dispatch({ type: "removeAssignment", id });
  }, []);

  const cancelSelfAssignment = useCallback(
    async (id: string) => {
      const assignment = state.shiftAssignments.find((a) => a.id === id);
      if (!assignment) return;
      const cancelledAt = new Date().toISOString();
      await updateAssignmentRow(id, { status: "cancelled", cancelledAt });
      dispatch({ type: "cancelAssignment", id, cancelledAt });
      const shift = state.shifts.find((s) => s.id === assignment.shiftId);
      await logAudit({
        action: "shift.unassigned",
        tone: "warning",
        resource: "ShiftAssignment",
        resourceId: id,
        teamId: shift?.teamId,
        message: `Self-assigned shift cancelled: "${shift?.title ?? "shift"}" on ${shift?.date ?? ""}`,
      });
    },
    [state.shiftAssignments, state.shifts, logAudit],
  );

  const approveShiftRequest = useCallback(
    async (assignmentId: string, reviewedBy: string) => {
      const assignment = state.shiftAssignments.find((a) => a.id === assignmentId);
      if (!assignment || assignment.status !== "pending") return;
      const approvedAt = new Date().toISOString();
      await updateAssignmentRow(assignmentId, {
        status: "approved",
        approvedAt,
        approvedBy: reviewedBy,
      });
      dispatch({
        type: "reviewAssignment",
        id: assignmentId,
        status: "approved",
        approvedAt,
        approvedBy: reviewedBy,
      });
      const shift = state.shifts.find((s) => s.id === assignment.shiftId);
      const person = state.people.find((p) => p.id === assignment.personId);
      await logActivity(
        assignment.personId,
        "notified",
        `Your request for "${shift?.title ?? "shift"}" on ${shift?.date ?? ""} was approved`,
      );
      await logAudit({
        action: "shift.request.approved",
        tone: "success",
        resource: "ShiftAssignment",
        resourceId: assignmentId,
        teamId: shift?.teamId,
        message: `${person?.name ?? "Someone"}'s request for "${shift?.title ?? "shift"}" on ${shift?.date ?? ""} approved by ${reviewedBy}`,
      });
    },
    [state.shiftAssignments, state.shifts, state.people, logActivity, logAudit],
  );

  const denyShiftRequest = useCallback(
    async (assignmentId: string, reviewedBy: string) => {
      const assignment = state.shiftAssignments.find((a) => a.id === assignmentId);
      if (!assignment || assignment.status !== "pending") return;
      await updateAssignmentRow(assignmentId, { status: "rejected" });
      dispatch({ type: "reviewAssignment", id: assignmentId, status: "rejected" });
      const shift = state.shifts.find((s) => s.id === assignment.shiftId);
      const person = state.people.find((p) => p.id === assignment.personId);
      await logActivity(
        assignment.personId,
        "notified",
        `Your request for "${shift?.title ?? "shift"}" on ${shift?.date ?? ""} was denied`,
      );
      await logAudit({
        action: "shift.request.denied",
        tone: "warning",
        resource: "ShiftAssignment",
        resourceId: assignmentId,
        teamId: shift?.teamId,
        message: `${person?.name ?? "Someone"}'s request for "${shift?.title ?? "shift"}" on ${shift?.date ?? ""} denied by ${reviewedBy}`,
      });
    },
    [state.shiftAssignments, state.shifts, state.people, logActivity, logAudit],
  );

  const revertShiftApproval = useCallback(
    async (assignmentId: string, revertedBy: string) => {
      const assignment = state.shiftAssignments.find((a) => a.id === assignmentId);
      if (!assignment || assignment.status !== "approved") return;
      await updateAssignmentRow(assignmentId, { status: "pending" });
      dispatch({
        type: "reviewAssignment",
        id: assignmentId,
        status: "pending",
        approvedAt: undefined,
        approvedBy: undefined,
      });
      const shift = state.shifts.find((s) => s.id === assignment.shiftId);
      await logActivity(
        assignment.personId,
        "notified",
        `Your approved request for "${shift?.title ?? "shift"}" on ${shift?.date ?? ""} was reverted to pending by ${revertedBy}`,
      );
      await logAudit({
        action: "shift.request.reverted",
        tone: "warning",
        resource: "ShiftAssignment",
        resourceId: assignmentId,
        teamId: shift?.teamId,
        message: `${revertedBy} reverted approval for "${shift?.title ?? "shift"}" on ${shift?.date ?? ""}`,
      });
    },
    [state.shiftAssignments, state.shifts, logActivity, logAudit],
  );

  const requestShift = useCallback(
    async (
      shiftId: string,
      personId: string,
    ): Promise<{ ok: boolean; error?: string; conflict?: boolean }> => {
      const already = state.shiftAssignments.some(
        (a) => a.shiftId === shiftId && a.personId === personId && a.status !== "cancelled",
      );
      if (already) return { ok: false, error: "You are already assigned to this shift." };

      const targetShift = state.shifts.find((s) => s.id === shiftId);
      if (!targetShift) return { ok: false, error: "Shift not found." };

      const approvedLeave = hasApprovedLeaveOn(personId, targetShift.date, state.leaveRequests);
      if (approvedLeave) {
        return {
          ok: false,
          conflict: true,
          error: `TIME_OFF_CONFLICT: ${approvedLeave.type} leave approved ${approvedLeave.startDate} – ${approvedLeave.endDate}.`,
        };
      }

      const personShiftIds = new Set(
        state.shiftAssignments
          .filter((a) => a.personId === personId && a.status !== "cancelled")
          .map((a) => a.shiftId),
      );
      const conflictingShift = state.shifts.find(
        (s) => s.id !== shiftId && personShiftIds.has(s.id) && shiftsOverlap(s, targetShift),
      );
      if (conflictingShift) {
        return {
          ok: false,
          conflict: true,
          error: `Conflicts with "${conflictingShift.title}" on ${conflictingShift.date} at ${conflictingShift.startTime}.`,
        };
      }

      try {
        const assignment = await insertAssignment({ shiftId, personId, status: "pending" });
        dispatch({ type: "addAssignment", assignment });

        await logActivity(
          personId,
          "notified",
          `Requested to join "${targetShift.title}" on ${targetShift.date} at ${targetShift.startTime}`,
        );

        const person = state.people.find((p) => p.id === personId);
        const managerId = state.teams.find((t) => t.id === targetShift.teamId)?.managerId;
        if (managerId) {
          await logActivity(
            managerId,
            "notified",
            `${person?.name ?? "Someone"} requested to join "${targetShift.title}" on ${targetShift.date}`,
          );
        }
        await logAudit({
          action: "shift.requested",
          tone: "neutral",
          resource: "ShiftAssignment",
          resourceId: assignment.id,
          teamId: targetShift.teamId,
          message: `${person?.name ?? "Someone"} requested to join "${targetShift.title}" on ${targetShift.date}`,
        });

        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.shiftAssignments, state.shifts, state.people, state.leaveRequests, state.teams, logActivity, logAudit],
  );

  const getAvailableShiftsForPerson = useCallback(
    (personId: string, teamId: string): Shift[] => {
      const assignedShiftIds = new Set(
        state.shiftAssignments
          .filter((a) => a.personId === personId && a.status !== "cancelled")
          .map((a) => a.shiftId),
      );
      return state.shifts.filter(
        (s) => s.teamId === teamId && s.status === "published" && !assignedShiftIds.has(s.id),
      );
    },
    [state.shifts, state.shiftAssignments],
  );

  // ---------------------------------------------------------------------
  // shift swaps
  // ---------------------------------------------------------------------

  const proposeSwap = useCallback(
    async (input: {
      swapType: SwapType;
      offeredShiftId: string;
      requestedShiftId?: string;
      initiatorPersonId: string;
      targetPersonId: string;
      initiatorComment?: string;
    }): Promise<{ ok: boolean; error?: string; request?: ShiftSwapRequest }> => {
      if (input.initiatorPersonId === input.targetPersonId) {
        return { ok: false, error: "You can't propose a swap with yourself." };
      }
      if (input.swapType === "trade" && !input.requestedShiftId) {
        return { ok: false, error: "Select a shift to trade for." };
      }

      const offeredShift = state.shifts.find((s) => s.id === input.offeredShiftId);
      if (!offeredShift || offeredShift.status !== "published") {
        return { ok: false, error: "Shift not found." };
      }
      const offeredAssignment = state.shiftAssignments.find(
        (a) =>
          a.shiftId === input.offeredShiftId &&
          a.personId === input.initiatorPersonId &&
          a.status === "approved",
      );
      if (!offeredAssignment) {
        return { ok: false, error: "You're not assigned to this shift." };
      }

      const target = state.people.find((p) => p.id === input.targetPersonId);
      if (!target || target.status !== "active" || !target.teamIds.includes(offeredShift.teamId)) {
        return { ok: false, error: "Coworker must be an active member of this shift's team." };
      }

      if (input.swapType === "trade") {
        const requestedShift = state.shifts.find((s) => s.id === input.requestedShiftId);
        if (!requestedShift) return { ok: false, error: "Shift not found." };
        const requestedAssignment = state.shiftAssignments.find(
          (a) =>
            a.shiftId === input.requestedShiftId &&
            a.personId === input.targetPersonId &&
            a.status === "approved",
        );
        if (!requestedAssignment) {
          return { ok: false, error: "Coworker isn't assigned to that shift." };
        }
      }

      const duplicate = state.shiftSwapRequests.some(
        (r) =>
          r.offeredShiftId === input.offeredShiftId &&
          r.initiatorPersonId === input.initiatorPersonId &&
          (r.status === "pending_target" || r.status === "accepted_pending_manager"),
      );
      if (duplicate) {
        return { ok: false, error: "You already have an active swap request for this shift." };
      }

      try {
        const request = await insertShiftSwapRequest({
          swapType: input.swapType,
          offeredShiftId: input.offeredShiftId,
          requestedShiftId: input.requestedShiftId,
          initiatorPersonId: input.initiatorPersonId,
          targetPersonId: input.targetPersonId,
          initiatorComment: input.initiatorComment?.trim() || undefined,
        });
        dispatch({ type: "addShiftSwapRequest", request });

        const initiator = state.people.find((p) => p.id === input.initiatorPersonId);
        await logActivity(
          input.targetPersonId,
          "notified",
          `${initiator?.name ?? "Someone"} proposed a shift ${
            input.swapType === "trade" ? "trade" : "give-away"
          } for "${offeredShift.title}" on ${offeredShift.date}`,
        );
        await logAudit({
          action: "shift_swap.proposed",
          tone: "neutral",
          resource: "ShiftSwapRequest",
          resourceId: request.id,
          teamId: offeredShift.teamId,
          message: `${initiator?.name ?? "Someone"} proposed a shift ${request.swapType} to ${
            target.name
          } for "${offeredShift.title}" on ${offeredShift.date}`,
        });

        notifySwapProposed(request.id).catch(() => {});

        return { ok: true, request };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [state.shifts, state.shiftAssignments, state.people, state.shiftSwapRequests, logActivity, logAudit],
  );

  const respondToSwap = useCallback(
    async (
      id: string,
      response: "accept" | "decline",
      respondingPersonId: string,
    ): Promise<{ ok: boolean; error?: string; conflict?: boolean }> => {
      const request = state.shiftSwapRequests.find((r) => r.id === id);
      if (!request || request.status !== "pending_target") {
        return { ok: false, error: "This request is no longer awaiting a response." };
      }
      if (request.targetPersonId !== respondingPersonId) {
        return { ok: false, error: "Not authorized to respond to this request." };
      }

      const offeredShift = state.shifts.find((s) => s.id === request.offeredShiftId);
      const requestedShift = request.requestedShiftId
        ? state.shifts.find((s) => s.id === request.requestedShiftId)
        : undefined;

      if (response === "accept") {
        if (!offeredShift) return { ok: false, error: "Shift not found." };

        const approvedLeave = hasApprovedLeaveOn(
          request.targetPersonId,
          offeredShift.date,
          state.leaveRequests,
        );
        if (approvedLeave) {
          return {
            ok: false,
            conflict: true,
            error: `TIME_OFF_CONFLICT: ${approvedLeave.type} leave approved ${approvedLeave.startDate} – ${approvedLeave.endDate}.`,
          };
        }
        const targetShiftIds = new Set(
          state.shiftAssignments
            .filter((a) => a.personId === request.targetPersonId && a.status !== "cancelled")
            .map((a) => a.shiftId),
        );
        const targetConflict = state.shifts.find(
          (s) => s.id !== offeredShift.id && targetShiftIds.has(s.id) && shiftsOverlap(s, offeredShift),
        );
        if (targetConflict) {
          return {
            ok: false,
            conflict: true,
            error: `Conflicts with "${targetConflict.title}" on ${targetConflict.date} at ${targetConflict.startTime}.`,
          };
        }

        if (request.swapType === "trade" && requestedShift) {
          const approvedLeaveInitiator = hasApprovedLeaveOn(
            request.initiatorPersonId,
            requestedShift.date,
            state.leaveRequests,
          );
          if (approvedLeaveInitiator) {
            return {
              ok: false,
              conflict: true,
              error: `TIME_OFF_CONFLICT: ${approvedLeaveInitiator.type} leave approved ${approvedLeaveInitiator.startDate} – ${approvedLeaveInitiator.endDate}.`,
            };
          }
          const initiatorShiftIds = new Set(
            state.shiftAssignments
              .filter((a) => a.personId === request.initiatorPersonId && a.status !== "cancelled")
              .map((a) => a.shiftId),
          );
          const initiatorConflict = state.shifts.find(
            (s) =>
              s.id !== requestedShift.id &&
              initiatorShiftIds.has(s.id) &&
              shiftsOverlap(s, requestedShift),
          );
          if (initiatorConflict) {
            return {
              ok: false,
              conflict: true,
              error: `Conflicts with "${initiatorConflict.title}" on ${initiatorConflict.date} at ${initiatorConflict.startTime}.`,
            };
          }
        }
      }

      const targetRespondedAt = new Date().toISOString();
      const status = response === "accept" ? "accepted_pending_manager" : "declined_by_target";
      try {
        const updated = await updateShiftSwapRequestRow(id, { status, targetRespondedAt });
        dispatch({ type: "updateShiftSwapRequest", id, patch: updated });
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }

      const responder = state.people.find((p) => p.id === respondingPersonId);
      await logActivity(
        request.initiatorPersonId,
        "notified",
        `${responder?.name ?? "Someone"} ${response === "accept" ? "accepted" : "declined"} your shift ${
          request.swapType === "trade" ? "trade" : "give-away"
        } proposal for "${offeredShift?.title ?? "shift"}" on ${offeredShift?.date ?? ""}`,
      );
      await logAudit({
        action: response === "accept" ? "shift_swap.accepted" : "shift_swap.declined",
        tone: response === "accept" ? "success" : "warning",
        resource: "ShiftSwapRequest",
        resourceId: id,
        teamId: offeredShift?.teamId,
        message: `${responder?.name ?? "Someone"} ${response === "accept" ? "accepted" : "declined"} a shift ${
          request.swapType
        } proposal`,
      });

      notifySwapResponded(id).catch(() => {});

      return { ok: true };
    },
    [
      state.shiftSwapRequests,
      state.shifts,
      state.shiftAssignments,
      state.leaveRequests,
      state.people,
      logActivity,
      logAudit,
    ],
  );

  const cancelSwap = useCallback(
    async (id: string, cancelledBy: string): Promise<{ ok: boolean; error?: string }> => {
      const request = state.shiftSwapRequests.find((r) => r.id === id);
      if (!request || request.status !== "pending_target") {
        return { ok: false, error: "This request can no longer be cancelled." };
      }
      try {
        const updated = await updateShiftSwapRequestRow(id, { status: "cancelled" });
        dispatch({ type: "updateShiftSwapRequest", id, patch: updated });
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
      const offeredShift = state.shifts.find((s) => s.id === request.offeredShiftId);
      await logAudit({
        action: "shift_swap.cancelled",
        tone: "neutral",
        resource: "ShiftSwapRequest",
        resourceId: id,
        teamId: offeredShift?.teamId,
        message: `${cancelledBy} cancelled a shift ${request.swapType} proposal for "${
          offeredShift?.title ?? "shift"
        }" on ${offeredShift?.date ?? ""}`,
      });
      return { ok: true };
    },
    [state.shiftSwapRequests, state.shifts, logAudit],
  );

  const reviewSwap = useCallback(
    async (
      id: string,
      status: "approved" | "denied",
      reviewedBy: string,
      reviewerComment?: string,
    ): Promise<{ ok: boolean; error?: string; conflict?: boolean }> => {
      const request = state.shiftSwapRequests.find((r) => r.id === id);
      if (!request || request.status !== "accepted_pending_manager") {
        return { ok: false, error: "This request is not awaiting manager review." };
      }

      const offeredShift = state.shifts.find((s) => s.id === request.offeredShiftId);
      const requestedShift = request.requestedShiftId
        ? state.shifts.find((s) => s.id === request.requestedShiftId)
        : undefined;
      const reviewedAt = new Date().toISOString();

      if (status === "denied") {
        try {
          const updated = await updateShiftSwapRequestRow(id, {
            status: "denied",
            reviewedBy,
            reviewedAt,
            reviewerComment,
          });
          dispatch({ type: "updateShiftSwapRequest", id, patch: updated });
        } catch (e) {
          return { ok: false, error: errorMessage(e) };
        }
        await logActivity(
          request.initiatorPersonId,
          "notified",
          `Your shift ${request.swapType} proposal for "${offeredShift?.title ?? "shift"}" was denied${
            reviewerComment ? ` — ${reviewerComment}` : ""
          }`,
        );
        await logActivity(
          request.targetPersonId,
          "notified",
          `The shift ${request.swapType} for "${offeredShift?.title ?? "shift"}" was denied by ${reviewedBy}`,
        );
        await logAudit({
          action: "shift_swap.denied",
          tone: "warning",
          resource: "ShiftSwapRequest",
          resourceId: id,
          teamId: offeredShift?.teamId,
          message: `${reviewedBy} denied a shift ${request.swapType} proposal for "${
            offeredShift?.title ?? "shift"
          }"`,
        });
        notifySwapReviewed(id).catch(() => {});
        return { ok: true };
      }

      if (!offeredShift) return { ok: false, error: "Shift not found." };
      const offeredAssignment = state.shiftAssignments.find(
        (a) =>
          a.shiftId === request.offeredShiftId &&
          a.personId === request.initiatorPersonId &&
          a.status === "approved",
      );
      if (!offeredAssignment) {
        return { ok: false, error: "The offered shift is no longer assigned as expected. Deny and ask them to re-propose." };
      }

      let requestedAssignment: ShiftAssignment | undefined;
      if (request.swapType === "trade") {
        if (!requestedShift) return { ok: false, error: "Shift not found." };
        requestedAssignment = state.shiftAssignments.find(
          (a) =>
            a.shiftId === request.requestedShiftId &&
            a.personId === request.targetPersonId &&
            a.status === "approved",
        );
        if (!requestedAssignment) {
          return { ok: false, error: "The requested shift is no longer assigned as expected. Deny and ask them to re-propose." };
        }
      }

      const approvedLeave = hasApprovedLeaveOn(request.targetPersonId, offeredShift.date, state.leaveRequests);
      if (approvedLeave) {
        return {
          ok: false,
          conflict: true,
          error: `TIME_OFF_CONFLICT: ${approvedLeave.type} leave approved ${approvedLeave.startDate} – ${approvedLeave.endDate}.`,
        };
      }
      const targetShiftIds = new Set(
        state.shiftAssignments
          .filter((a) => a.personId === request.targetPersonId && a.status !== "cancelled")
          .map((a) => a.shiftId),
      );
      const targetConflict = state.shifts.find(
        (s) => s.id !== offeredShift.id && targetShiftIds.has(s.id) && shiftsOverlap(s, offeredShift),
      );
      if (targetConflict) {
        return {
          ok: false,
          conflict: true,
          error: `Conflicts with "${targetConflict.title}" on ${targetConflict.date} at ${targetConflict.startTime}.`,
        };
      }
      if (request.swapType === "trade" && requestedShift) {
        const approvedLeaveInitiator = hasApprovedLeaveOn(
          request.initiatorPersonId,
          requestedShift.date,
          state.leaveRequests,
        );
        if (approvedLeaveInitiator) {
          return {
            ok: false,
            conflict: true,
            error: `TIME_OFF_CONFLICT: ${approvedLeaveInitiator.type} leave approved ${approvedLeaveInitiator.startDate} – ${approvedLeaveInitiator.endDate}.`,
          };
        }
        const initiatorShiftIds = new Set(
          state.shiftAssignments
            .filter((a) => a.personId === request.initiatorPersonId && a.status !== "cancelled")
            .map((a) => a.shiftId),
        );
        const initiatorConflict = state.shifts.find(
          (s) =>
            s.id !== requestedShift.id &&
            initiatorShiftIds.has(s.id) &&
            shiftsOverlap(s, requestedShift),
        );
        if (initiatorConflict) {
          return {
            ok: false,
            conflict: true,
            error: `Conflicts with "${initiatorConflict.title}" on ${initiatorConflict.date} at ${initiatorConflict.startTime}.`,
          };
        }
      }

      try {
        await updateAssignmentRow(offeredAssignment.id, {
          personId: request.targetPersonId,
          approvedAt: reviewedAt,
          approvedBy: reviewedBy,
        });
        dispatch({
          type: "reassignAssignment",
          id: offeredAssignment.id,
          personId: request.targetPersonId,
          approvedAt: reviewedAt,
          approvedBy: reviewedBy,
        });

        if (request.swapType === "trade" && requestedAssignment) {
          await updateAssignmentRow(requestedAssignment.id, {
            personId: request.initiatorPersonId,
            approvedAt: reviewedAt,
            approvedBy: reviewedBy,
          });
          dispatch({
            type: "reassignAssignment",
            id: requestedAssignment.id,
            personId: request.initiatorPersonId,
            approvedAt: reviewedAt,
            approvedBy: reviewedBy,
          });
        }

        const updated = await updateShiftSwapRequestRow(id, {
          status: "approved",
          reviewedBy,
          reviewedAt,
          reviewerComment,
        });
        dispatch({ type: "updateShiftSwapRequest", id, patch: updated });
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }

      await logActivity(
        request.initiatorPersonId,
        "notified",
        `Your shift ${request.swapType} proposal for "${offeredShift.title}" was approved`,
      );
      await logActivity(
        request.targetPersonId,
        "notified",
        `The shift ${request.swapType} for "${offeredShift.title}" was approved`,
      );
      await logAudit({
        action: "shift_swap.approved",
        tone: "success",
        resource: "ShiftSwapRequest",
        resourceId: id,
        teamId: offeredShift.teamId,
        message: `${reviewedBy} approved a shift ${request.swapType} for "${offeredShift.title}"`,
      });

      notifySwapReviewed(id).catch(() => {});

      return { ok: true };
    },
    [state.shiftSwapRequests, state.shifts, state.shiftAssignments, state.leaveRequests, logActivity, logAudit],
  );

  const getSwapsInvolvingPerson = useCallback(
    (personId: string): ShiftSwapRequest[] =>
      state.shiftSwapRequests
        .filter((r) => r.initiatorPersonId === personId || r.targetPersonId === personId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.shiftSwapRequests],
  );

  const getSwapableCoworkers = useCallback(
    (personId: string, shiftId: string): Person[] => {
      const shift = state.shifts.find((s) => s.id === shiftId);
      if (!shift) return [];
      return state.people.filter(
        (p) => p.id !== personId && p.status === "active" && p.teamIds.includes(shift.teamId),
      );
    },
    [state.shifts, state.people],
  );

  const bulkAssign = useCallback(
    async (input: BulkAssignInput): Promise<BulkAssignResult> => {
      const eligible = state.shifts.filter(
        (s) =>
          s.teamId === input.teamId &&
          s.date >= input.start &&
          s.date <= input.end &&
          (!input.templateId || s.templateId === input.templateId),
      );
      const personAssignments = state.shiftAssignments.filter((a) => a.personId === input.personId);
      const assignedShiftIds = new Set(personAssignments.map((a) => a.shiftId));
      const skipped: BulkAssignSkip[] = [];
      const toInsert: { shiftId: string; personId: string; status: AssignmentStatus; approvedAt: string }[] = [];
      const now = new Date().toISOString();

      for (const shift of eligible) {
        if (assignedShiftIds.has(shift.id)) {
          skipped.push({ shiftId: shift.id, reason: "already assigned" });
          continue;
        }
        if (!input.force) {
          const approvedLeave = hasApprovedLeaveOn(input.personId, shift.date, state.leaveRequests);
          if (approvedLeave) {
            skipped.push({ shiftId: shift.id, reason: "approved time-off on this date" });
            continue;
          }
          const overlaps = personAssignments.some((a) => {
            const other = state.shifts.find((s) => s.id === a.shiftId);
            return (
              !!other &&
              other.date === shift.date &&
              shiftTimesOverlap(
                shift.startTime,
                shift.durationMinutes,
                other.startTime,
                other.durationMinutes,
              )
            );
          });
          if (overlaps) {
            skipped.push({ shiftId: shift.id, reason: "overlaps existing assignment" });
            continue;
          }
        }
        toInsert.push({ shiftId: shift.id, personId: input.personId, status: "approved", approvedAt: now });
      }

      let assigned: ShiftAssignment[] = [];
      if (toInsert.length > 0) {
        assigned = await insertAssignmentsMany(toInsert);
        dispatch({ type: "addAssignments", assignments: assigned });
      }

      return { assigned, skipped };
    },
    [state.shifts, state.shiftAssignments, state.leaveRequests],
  );

  // ---------------------------------------------------------------------
  // personal notes
  // ---------------------------------------------------------------------

  const createPersonalNote = useCallback(
    async (input: {
      title?: string;
      content: string;
    }): Promise<{ ok: boolean; error?: string; note?: PersonalNote }> => {
      if (!input.content.trim()) return { ok: false, error: "Note can't be empty." };
      try {
        const note = await insertPersonalNote({
          title: input.title?.trim() || undefined,
          content: input.content.trim(),
        });
        dispatch({ type: "addPersonalNote", note });
        return { ok: true, note };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [],
  );

  const updatePersonalNote = useCallback(
    async (id: string, patch: { title?: string; content: string }): Promise<boolean> => {
      if (!patch.content.trim()) return false;
      try {
        const updated = await updatePersonalNoteRow(id, {
          title: patch.title?.trim() || undefined,
          content: patch.content.trim(),
        });
        dispatch({ type: "updatePersonalNote", id, patch: updated });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const deletePersonalNote = useCallback(async (id: string) => {
    await deletePersonalNoteRow(id);
    dispatch({ type: "deletePersonalNote", id });
  }, []);

  // ---------------------------------------------------------------------
  // team notes
  // ---------------------------------------------------------------------

  const createTeamNote = useCallback(
    async (
      personId: string,
      input: { teamId: string; title?: string; content: string },
    ): Promise<{ ok: boolean; error?: string; note?: TeamNote }> => {
      if (!input.content.trim()) return { ok: false, error: "Note can't be empty." };
      try {
        const note = await insertTeamNote({
          teamId: input.teamId,
          personId,
          title: input.title?.trim() || undefined,
          content: input.content.trim(),
        });
        dispatch({ type: "addTeamNote", note });
        return { ok: true, note };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [],
  );

  const updateTeamNote = useCallback(
    async (id: string, patch: { title?: string; content: string }): Promise<boolean> => {
      if (!patch.content.trim()) return false;
      try {
        const updated = await updateTeamNoteRow(id, {
          title: patch.title?.trim() || undefined,
          content: patch.content.trim(),
        });
        dispatch({ type: "updateTeamNote", id, patch: updated });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const deleteTeamNote = useCallback(async (id: string) => {
    await deleteTeamNoteRow(id);
    dispatch({ type: "deleteTeamNote", id });
  }, []);

  const value = useMemo<CompanyContextValue>(
    () => ({
      ...state,
      loading,
      createTeam,
      updateTeam,
      deleteTeam,
      invitePerson,
      updatePerson,
      resendInvite,
      deletePerson,
      createLocation,
      updateLocation,
      deleteLocation,
      createCompanyHoliday,
      updateCompanyHoliday,
      deleteCompanyHoliday,
      getHolidaysInRange,
      importCompanyHolidays,
      addClockEntry,
      editClockEntry,
      startBreak,
      endBreak,
      getActiveBreakForPerson,
      getBreaksForClockEntry,
      getViolationsForClockEntry,
      getBreakPolicyForPerson,
      requestLeave,
      updateLeaveRequest,
      cancelLeaveRequest,
      approveLeave,
      denyLeave,
      revertLeaveApproval,
      markActivityRead,
      markAllActivityRead,
      createShiftTemplate,
      updateShiftTemplate,
      deleteShiftTemplate,
      getShiftTemplatesByTeam,
      previewShifts,
      publishShifts,
      createShift,
      updateShift,
      deleteShift,
      deleteShifts,
      createShifts,
      applyTemplateToShifts,
      assignPerson,
      removeAssignment,
      bulkAssign,
      requestShift,
      cancelSelfAssignment,
      approveShiftRequest,
      denyShiftRequest,
      revertShiftApproval,
      getAvailableShiftsForPerson,
      createPersonalNote,
      updatePersonalNote,
      deletePersonalNote,
      createTeamNote,
      updateTeamNote,
      deleteTeamNote,
      proposeSwap,
      respondToSwap,
      cancelSwap,
      reviewSwap,
      getSwapsInvolvingPerson,
      getSwapableCoworkers,
    }),
    [
      state,
      loading,
      createTeam,
      updateTeam,
      deleteTeam,
      invitePerson,
      updatePerson,
      resendInvite,
      deletePerson,
      createLocation,
      updateLocation,
      deleteLocation,
      createCompanyHoliday,
      updateCompanyHoliday,
      deleteCompanyHoliday,
      getHolidaysInRange,
      importCompanyHolidays,
      addClockEntry,
      editClockEntry,
      startBreak,
      endBreak,
      getActiveBreakForPerson,
      getBreaksForClockEntry,
      getViolationsForClockEntry,
      getBreakPolicyForPerson,
      requestLeave,
      updateLeaveRequest,
      cancelLeaveRequest,
      approveLeave,
      denyLeave,
      revertLeaveApproval,
      markActivityRead,
      markAllActivityRead,
      createShiftTemplate,
      updateShiftTemplate,
      deleteShiftTemplate,
      getShiftTemplatesByTeam,
      previewShifts,
      publishShifts,
      createShift,
      updateShift,
      deleteShift,
      deleteShifts,
      createShifts,
      applyTemplateToShifts,
      assignPerson,
      removeAssignment,
      bulkAssign,
      requestShift,
      cancelSelfAssignment,
      approveShiftRequest,
      denyShiftRequest,
      revertShiftApproval,
      getAvailableShiftsForPerson,
      createPersonalNote,
      updatePersonalNote,
      deletePersonalNote,
      createTeamNote,
      updateTeamNote,
      deleteTeamNote,
      proposeSwap,
      respondToSwap,
      cancelSwap,
      reviewSwap,
      getSwapsInvolvingPerson,
      getSwapableCoworkers,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within <CompanyProvider>");
  return ctx;
}
