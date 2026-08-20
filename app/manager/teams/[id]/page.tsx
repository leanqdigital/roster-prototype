"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-data";
import type { PersonFormInput } from "@/components/people/PersonFormModal";
import PersonFormModal from "@/components/people/PersonFormModal";
import { PersonRoleBadge, PersonStatusBadge } from "@/components/people/PersonBadges";
import { MailIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { initials } from "@/lib/format";
import Pagination from "@/components/ui/Pagination";
import { useTeamDetail } from "./team-detail-context";

const PAGE_SIZE = 10;

export default function ManagerTeamMembersPage() {
  const { locations, invitePerson, resendInvite } = useCompany();
  const { team, teamPeople } = useTeamDetail();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamPeople;
    return teamPeople.filter(
      (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [teamPeople, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const handleInvite = async (
    input: PersonFormInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await invitePerson({ ...input, teamIds: [team.id] });
    if (result.ok) setInviteOpen(false);
    return result;
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search members…"
            className="h-8 w-full rounded-lg border border-hairline bg-surface-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          <PlusIcon className="size-3.5" />
          Invite employee
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-6 py-16 text-center">
          <UsersIcon className="size-8 text-ink-faint" />
          <p className="text-sm font-medium text-ink">
            {teamPeople.length === 0 ? "Nobody is on this team yet." : "No members match your search."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {paged.map((person) => (
              <li
                key={person.id}
                className="group flex items-center gap-3 px-4 py-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                  {initials(person.name) || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/manager/teams/${team.id}/people/${person.id}`}
                      className="truncate text-[13px] font-medium text-ink hover:text-primary"
                    >
                      {person.name}
                    </Link>
                    <PersonRoleBadge role={person.role} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {person.email}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>
                </div>
                <PersonStatusBadge status={person.status} />
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {person.status === "invited" && (
                    <button
                      type="button"
                      onClick={() => resendInvite(person.id)}
                      title="Resend invite"
                      aria-label={`Resend invite to ${person.name}`}
                      className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                    >
                      <MailIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}

      {inviteOpen && (
        <PersonFormModal
          person={null}
          teams={[team]}
          locations={locations}
          onClose={() => setInviteOpen(false)}
          onSave={handleInvite}
        />
      )}
    </div>
  );
}
