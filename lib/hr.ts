import type { Person, Team } from "@/lib/company-data";

// "Unassigned pool": person with no manager chain — no team, or teams with
// neither manager_id nor leave_approver_id. Nobody reviews their requests;
// HR falls back. Mirrors the RLS guard in
// supabase/migrations/0025_hr_unassigned_pool_approval.sql.
export function isUnassigned(person: Person, teams: Team[]): boolean {
  return person.teamIds.every((tid) => {
    const team = teams.find((t) => t.id === tid);
    return !team || (!team.managerId && !team.leaveApproverId);
  });
}

// Swap approval touches both parties — HR may approve only when both
// sides are in the unassigned pool.
export function isUnassignedPair(a: Person, b: Person, teams: Team[]): boolean {
  return isUnassigned(a, teams) && isUnassigned(b, teams);
}