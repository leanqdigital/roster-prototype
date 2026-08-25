"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { useCompany } from "./company-data";
import type { Person, Team } from "./company-data";

const MANAGER_TEAM_KEY = "roster.managerSelectedTeam";

function readSelectedTeamId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MANAGER_TEAM_KEY);
  } catch {
    return null;
  }
}

function persistSelectedTeamId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(MANAGER_TEAM_KEY, id);
    else window.localStorage.removeItem(MANAGER_TEAM_KEY);
  } catch {
    // storage unavailable — selection stays in memory
  }
}

interface ManagerContextValue {
  myPerson: Person | null;
  managedTeams: Team[];
  selectedTeam: Team | null;
  selectTeam: (id: string) => void;
}

const ManagerContext = createContext<ManagerContextValue | null>(null);

export function ManagerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { teams, people } = useCompany();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    readSelectedTeamId,
  );

  const myPerson = useMemo<Person | null>(
    () =>
      people.find(
        (p) => p.role === "manager" && p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );

  const managedTeams = useMemo<Team[]>(
    () =>
      myPerson
        ? teams.filter(
            (t) => myPerson.teamIds.includes(t.id) || t.managerId === myPerson.id,
          )
        : [],
    [teams, myPerson],
  );

  const effectiveTeamId = useMemo(() => {
    if (managedTeams.length === 0) return null;
    if (selectedTeamId && managedTeams.some((t) => t.id === selectedTeamId)) {
      return selectedTeamId;
    }
    return managedTeams[0].id;
  }, [managedTeams, selectedTeamId]);

  useEffect(() => {
    persistSelectedTeamId(effectiveTeamId);
  }, [effectiveTeamId]);

  const selectTeam = useCallback((id: string) => {
    setSelectedTeamId(id);
  }, []);

  const selectedTeam = useMemo(
    () => managedTeams.find((t) => t.id === effectiveTeamId) ?? null,
    [managedTeams, effectiveTeamId],
  );

  const value = useMemo(
    () => ({ myPerson, managedTeams, selectedTeam, selectTeam }),
    [myPerson, managedTeams, selectedTeam, selectTeam],
  );

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager(): ManagerContextValue {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error("useManager must be used within <ManagerProvider>");
  return ctx;
}
