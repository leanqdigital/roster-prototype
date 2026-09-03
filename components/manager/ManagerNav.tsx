"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import { useManager } from "@/lib/manager-team";
import { useTheme } from "@/lib/theme";
import { getCompanySettings } from "@/lib/company";
import LogoMark from "@/components/ui/Logo";
import NavUserMenuContent from "@/components/ui/NavUserMenuContent";
import BottomTabBar from "@/components/ui/BottomTabBar";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/people/Avatar";
import {
  ActivityIcon,
  BellIcon,
  CalendarIcon,
  CalendarOffIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons";

export default function ManagerNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const { user, signOut } = useAuth();
  const { people, activity } = useCompany();
  const { managedTeams, selectedTeam, selectTeam } = useManager();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const teamMenuRef = useRef<HTMLDivElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompanySettings().then((result) => {
      if (!cancelled && result) {
        setCompanyName(result.name);
        setLogoUrl(result.logoUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const inTeamDetail = pathname.startsWith("/manager/teams/") && !!params.id;
  const teamTabs = selectedTeam
    ? [
        { href: `/manager/teams/${selectedTeam.id}`, label: "Members", icon: UsersIcon },
        { href: `/manager/teams/${selectedTeam.id}/templates`, label: "Templates", icon: ClockIcon },
        { href: `/manager/teams/${selectedTeam.id}/schedule`, label: "Schedule", icon: CalendarIcon },
        { href: `/manager/teams/${selectedTeam.id}/time-tracking`, label: "Time Tracking", icon: ClockIcon },
        { href: `/manager/teams/${selectedTeam.id}/live`, label: "Live", icon: ActivityIcon },
        { href: `/manager/teams/${selectedTeam.id}/shift-requests`, label: "Shift Requests", icon: BellIcon },
        { href: `/manager/teams/${selectedTeam.id}/leave-requests`, label: "Leave Requests", icon: CalendarOffIcon },
        { href: `/manager/teams/${selectedTeam.id}/audit`, label: "Audit", icon: ActivityIcon },
      ]
    : [];

  const teamTab = (label: string) => teamTabs.find((t) => t.label === label);
  const myLeaveItem = { href: "/manager/leave-requests", label: "My Leave", icon: CalendarOffIcon };

  const myPerson = useMemo(
    () =>
      people.find(
        (p) => p.role === "manager" && p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );
  const unreadCount = useMemo(() => {
    if (!myPerson) return 0;
    return activity.filter((a) => a.personId === myPerson.id && !a.read).length;
  }, [activity, myPerson]);

  const myNotificationsItem = {
    href: "/manager/notifications",
    label: "Notifications",
    icon: BellIcon,
    badge: unreadCount,
  };
  const mobileTabs = [
    { href: "/manager/dashboard", label: "Dashboard", icon: ActivityIcon },
    {
      href: teamTab("Schedule")?.href ?? "#",
      label: "Schedule",
      icon: CalendarIcon,
      disabled: !selectedTeam,
    },
    {
      href: teamTab("Members")?.href ?? "#",
      label: "Members",
      icon: UsersIcon,
      disabled: !selectedTeam,
    },
    {
      href: teamTab("Time Tracking")?.href ?? "#",
      label: "Time Tracking",
      icon: ClockIcon,
      disabled: !selectedTeam,
    },
  ];
  const mobileMoreItems = [
    { href: myLeaveItem.href, label: myLeaveItem.label, icon: myLeaveItem.icon, disabled: false, badge: undefined as number | undefined },
    {
      href: teamTab("Templates")?.href ?? "#",
      label: "Templates",
      icon: ClockIcon,
      disabled: !selectedTeam,
      badge: undefined as number | undefined,
    },
    {
      href: teamTab("Live")?.href ?? "#",
      label: "Live",
      icon: ActivityIcon,
      disabled: !selectedTeam,
      badge: undefined as number | undefined,
    },
    {
      href: teamTab("Shift Requests")?.href ?? "#",
      label: "Shift Requests",
      icon: BellIcon,
      disabled: !selectedTeam,
      badge: undefined as number | undefined,
    },
    {
      href: teamTab("Leave Requests")?.href ?? "#",
      label: "Leave Requests",
      icon: CalendarOffIcon,
      disabled: !selectedTeam,
      badge: undefined as number | undefined,
    },
    {
      href: teamTab("Audit")?.href ?? "#",
      label: "Audit",
      icon: ActivityIcon,
      disabled: !selectedTeam,
      badge: undefined as number | undefined,
    },
    {
      href: myNotificationsItem.href,
      label: myNotificationsItem.label,
      icon: myNotificationsItem.icon,
      disabled: false,
      badge: myNotificationsItem.badge as number | undefined,
    },
    { href: "/manager/settings", label: "Settings", icon: SettingsIcon, disabled: false, badge: undefined as number | undefined },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!teamMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(e.target as Node)) {
        setTeamMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTeamMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [teamMenuOpen]);

  useEffect(() => {
    if (inTeamDetail && params.id) selectTeam(params.id);
  }, [inTeamDetail, params.id, selectTeam]);

  const switchTeam = (id: string) => {
    selectTeam(id);
    setTeamMenuOpen(false);
    setMoreOpen(false);
    router.push("/manager/dashboard");
  };

  const handleSignOut = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    signOut();
    router.push("/");
  };

  return (
    <>
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface-2 md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-hairline px-5">
        <Link href="/manager/dashboard" className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="size-7 shrink-0 rounded-md object-contain"
            />
          ) : (
            <LogoMark className="size-7 shrink-0" />
          )}
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink">
            {companyName ?? "Roster"}
          </span>
        </Link>
      </div>

      <div className="border-b border-hairline p-3">
        <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
          Team
        </p>
        <div ref={teamMenuRef} className="relative">
          <button
            onClick={() => setTeamMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={teamMenuOpen}
            className="flex w-full items-center gap-2.5 rounded-lg border border-hairline bg-surface-3 px-2.5 py-2 transition-colors hover:bg-surface-4"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-weak text-primary">
              <UsersIcon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-ink">
                {selectedTeam?.name ?? "No team"}
              </span>
              <span className="block truncate text-[11px] text-ink-subtle">
                {managedTeams.length} {managedTeams.length === 1 ? "team" : "teams"}
              </span>
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-ink-subtle" />
          </button>

          {teamMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-hairline bg-surface-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            >
              <div className="max-h-64 overflow-y-auto p-1">
                {managedTeams.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-ink-muted">
                    No teams assigned yet
                  </p>
                ) : (
                  managedTeams.map((team) => {
                    const active = team.id === selectedTeam?.id;
                    return (
                      <button
                        key={team.id}
                        role="menuitem"
                        onClick={() => switchTeam(team.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-surface-3 ${
                          active ? "text-primary" : "text-ink"
                        }`}
                      >
                        <UsersIcon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {team.name}
                        </span>
                        {active && <CheckIcon className="size-4 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {[myLeaveItem, ...teamTabs, myNotificationsItem].map((item) => {
          const active =
            item.label === "Members"
              ? pathname === item.href || pathname.startsWith(`${item.href}/people/`)
              : pathname.startsWith(item.href);
          const badge = (item as { badge?: number }).badge;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-primary-weak text-primary"
                  : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {!!badge && (
                <span className="flex min-w-4.5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <nav className="border-t border-hairline p-3">
        <Link
          href="/manager/settings"
          aria-current={pathname.startsWith("/manager/settings") ? "page" : undefined}
          className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            pathname.startsWith("/manager/settings")
              ? "bg-primary-weak text-primary"
              : "text-ink-muted hover:bg-surface-3 hover:text-ink"
          }`}
        >
          <SettingsIcon className="size-4" />
          Settings
          {pathname.startsWith("/manager/settings") && (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
          )}
        </Link>
      </nav>

      <div className="border-t border-hairline p-3">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-3"
          >
            <Avatar
              name={user?.name ?? "Team manager"}
              src={people.find((p) => p.email.toLowerCase() === user?.email.toLowerCase())?.avatarUrl}
              className="size-6.5 text-[11px] font-semibold"
            />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-ink">
                {user?.name ?? "Team manager"}
              </span>
              <span className="block truncate text-[11px] text-ink-subtle">
                team manager
              </span>
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-ink-subtle" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-50 mb-2 w-52 overflow-hidden rounded-lg border border-hairline bg-surface-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            >
              <NavUserMenuContent
                name={user?.name ?? "Team manager"}
                email={user?.email}
                theme={theme}
                onToggleTheme={toggleTheme}
                onSignOut={handleSignOut}
              />
            </div>
          )}
        </div>
      </div>
    </aside>

    <BottomTabBar
      items={mobileTabs}
      isActive={(href) => {
        if (href === "/manager/dashboard") return pathname === href;
        if (selectedTeam && href === `/manager/teams/${selectedTeam.id}`) {
          return pathname === href || pathname.startsWith(`${href}/people/`);
        }
        return pathname.startsWith(href);
      }}
      moreActive={moreOpen}
      moreBadge={unreadCount > 0}
      onMoreClick={() => setMoreOpen(true)}
    />

    <Modal
      open={moreOpen}
      title="More"
      hideFooter
      confirmLabel=""
      onConfirm={() => setMoreOpen(false)}
      onClose={() => setMoreOpen(false)}
    >
      <div>
        <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
          Team
        </p>
        {managedTeams.length === 0 ? (
          <p className="px-1 py-2 text-xs text-ink-muted">No teams assigned yet</p>
        ) : (
          <div className="space-y-1">
            {managedTeams.map((team) => {
              const active = team.id === selectedTeam?.id;
              return (
                <button
                  key={team.id}
                  onClick={() => switchTeam(team.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-surface-3 ${
                    active ? "bg-primary-weak text-primary" : "text-ink"
                  }`}
                >
                  <UsersIcon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  {active && <CheckIcon className="size-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <nav className="mt-4 space-y-1 border-t border-hairline pt-3">
        {mobileMoreItems.map((item) =>
          item.disabled ? (
            <span
              key={item.label}
              title={`${item.label} — select a team first`}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-ink-subtle opacity-60"
            >
              <item.icon className="size-4" />
              {item.label}
            </span>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-primary-weak text-primary"
                  : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="flex min-w-4.5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ),
        )}
      </nav>

      <div className="mt-4 -mx-6 border-t border-hairline pt-1">
        <NavUserMenuContent
          name={user?.name ?? "Team manager"}
          email={user?.email}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={handleSignOut}
        />
      </div>
    </Modal>
    </>
  );
}