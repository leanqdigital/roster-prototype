"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { DEFAULT_BRANDING, getCompanySettings } from "@/lib/company";
import LogoMark from "@/components/ui/Logo";
import NavUserMenuContent from "@/components/ui/NavUserMenuContent";
import BottomTabBar from "@/components/ui/BottomTabBar";
import Modal from "@/components/ui/Modal";
import {
  ActivityIcon,
  BellIcon,
  CalendarIcon,
  CalendarOffIcon,
  ChevronDownIcon,
  ClockIcon,
  HeartPulseIcon,
  ListIcon,
  MapPinIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: ActivityIcon, soon: false },
  { href: "/me/schedule", label: "My Schedule", icon: CalendarIcon, soon: false },
  { href: "/teams", label: "Teams", icon: ListIcon, soon: false },
  { href: "/people", label: "People", icon: UsersIcon, soon: false },
  { href: "/live", label: "Live", icon: HeartPulseIcon, soon: false },
  { href: "/templates", label: "Shift Templates", icon: ClockIcon, soon: false },
  { href: "/time-tracking", label: "Time Tracking", icon: ClockIcon, soon: false },
  { href: "/shift-requests", label: "Shift Requests", icon: BellIcon, soon: false },
  { href: "/leave-requests", label: "Leave Requests", icon: CalendarOffIcon, soon: false },
  { href: "/locations", label: "Locations", icon: MapPinIcon, soon: false },
  { href: "/settings", label: "Settings", icon: SettingsIcon, soon: false },
];

const MOBILE_TAB_HREFS = ["/dashboard", "/me/schedule", "/teams", "/people"];
const MOBILE_TABS = NAV_ITEMS.filter((item) => MOBILE_TAB_HREFS.includes(item.href));
const MOBILE_MORE_ITEMS = NAV_ITEMS.filter((item) => !MOBILE_TAB_HREFS.includes(item.href));

export default function CompanyNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [brandingColor, setBrandingColor] = useState(DEFAULT_BRANDING);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCompanySettings().then((result) => {
      if (!cancelled && result) {
        setBrandingColor(result.brandingColor);
        setLogoUrl(result.logoUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", brandingColor);
    root.style.setProperty(
      "--primary-hover",
      `color-mix(in srgb, ${brandingColor} 82%, #ffffff)`,
    );
  }, [brandingColor]);

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

  const handleSignOut = async () => {
    setMenuOpen(false);
    setMoreOpen(false);
    await signOut();
    router.push("/");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface-2 md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-hairline px-5">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
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
            Roster
            <span className="text-ink-subtle">
              {" "}
              / {user?.company ?? "Company"}
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = !item.soon && isActive(item.href);
          const classes = `relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            active
              ? "bg-primary-weak text-primary"
              : "text-ink-muted hover:bg-surface-3 hover:text-ink"
          }`;

          if (item.soon) {
            return (
              <span
                key={item.label}
                title={`${item.label} — coming soon`}
                className={`${classes} cursor-not-allowed opacity-60`}
              >
                <item.icon className="size-4" />
                {item.label}
                <span className="ml-auto rounded border border-hairline bg-surface-1 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-ink-subtle">
                  soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={classes}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4" />
              {item.label}
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-3">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-3"
          >
            <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
              {user?.name
                ? user.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "CA"}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-ink">
                {user?.name ?? "Company admin"}
              </span>
              <span className="block truncate text-[11px] text-ink-subtle">
                company admin
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
                name={user?.name ?? "Company admin"}
                email={user?.email}
                subtitle={user?.company}
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
      items={MOBILE_TABS}
      isActive={isActive}
      moreActive={moreOpen}
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
      <nav className="mt-4 space-y-1">
        {MOBILE_MORE_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-primary-weak text-primary"
                  : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 -mx-6 border-t border-hairline pt-1">
        <NavUserMenuContent
          name={user?.name ?? "Company admin"}
          email={user?.email}
          subtitle={user?.company}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={handleSignOut}
        />
      </div>
    </Modal>
    </>
  );
}
