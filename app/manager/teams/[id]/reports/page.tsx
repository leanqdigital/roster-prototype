"use client";

import ReportsView from "@/components/reports/ReportsView";
import { useTeamDetail } from "../team-detail-context";

export default function ManagerTeamReportsPage() {
  const { team } = useTeamDetail();
  return (
    <ReportsView
      key={team.id}
      teamId={team.id}
      lockTeam
      subtitle={`Attendance, leave, and coverage for ${team.name}`}
    />
  );
}