"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import { useTheme } from "@/lib/theme";
import { DEFAULT_BRANDING, getCompanySettings } from "@/lib/company";
import LogoMark from "@/components/ui/Logo";
import NavUserMenuContent from "@/components/ui/NavUserMenuContent";
import BottomTabBar from "@/components/ui/BottomTabBar";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/people/Avatar";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BellIcon,
  CalendarIcon,
  CalendarOffIcon,
  ChevronDownIcon,
  ClockIcon,
  FilterIcon,
  MapPinIcon,
  SettingsIcon,
  SwapIcon,
  UsersIcon,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/hr/dashboard", label: "Dashboard", icon: ActivityIcon },
  { href: "/hr/people", label: "People", icon: UsersIcon },
  { href: "/hr/schedule", label: "Schedule", icon: CalendarIcon },
  { href: "/hr/time-tracking", label: "Time Tracking", icon: ClockIcon },
  { href: "/hr/compliance", label: "Compliance", icon: AlertTriangleIcon },
  { href: "/hr/reports", label: "Reports", icon: FilterIcon },
  { href: "/hr/leave-requests", label: "Leave Requests", icon: CalendarOffIcon },
  { href: "/hr/shift-requests", label: "Shift Requests", icon: BellIcon },
  { href: "/hr/adjustments", label: "Adjustments", icon: ClockIcon },
  { href: "/hr/swaps", label: "Shift Swaps", icon: SwapIcon },
  { href: "/hr/holidays", label: "Holidays", icon: CalendarIcon },
  { href: "/hr/locations", label: "Locations", icon: MapPinIcon },
  { href: "/hr/notifications", label: "Notifications", icon: BellIcon },
  { href: "/hr/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_TAB_HREFS = ["/hr/dashboard", "/hr/people", "/hr/schedule", "/hr/reports"];
const MOBILE_TABS = NAV_ITEMS.filter((item) => MOBILE_TAB_HREFS.includes(item.href));
const MOBILE_MORE_ITEMS = NAV_ITEMS.filter((item) => !MOBILE_TAB_HREFS.includes(item.href));

export default function HRNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { people, activity } = useCompany();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [brandingColor, setBrandingColor] = useState(DEFAULT_BRANDING);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCompanySettings().then((result) => {
      if (!cancelled && result) {
        setBrandingColor(result.brandingColor);
        setLogoUrl(result.logoUrl);
        setCompanyName(result.name);
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
    href === "/hr/dashboard" ? pathname === href : pathname.startsWith(href);

  const notificationCount = activity.filter((a) => !a.read).length;

  return (
    <>
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface-2 md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-hairline px-5">
        <Link href="/hr/dashboard" className="flex min-w-0 items-center gap-2.5">
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
            {companyName ?? user?.company ?? "Company"}
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const classes = `relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            active
              ? "bg-primary-weak text-primary"
              : "text-ink-muted hover:bg-surface-3 hover:text-ink"
          }`;
          const badge = item.label === "Notifications" && notificationCount > 0 ? notificationCount : undefined;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={classes}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4" />
              {item.label}
              {!!badge && (
                <span className="ml-auto flex min-w-4.5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
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

      <div className="border-t border-hairline p-3">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-3"
          >
            <Avatar
              name={user?.name ?? "HR"}
              src={people.find((p) => p.email.toLowerCase() === user?.email.toLowerCase())?.avatarUrl}
              className="size-6.5 text-[11px] font-semibold"
            />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-ink">
                {user?.name ?? "HR"}
              </span>
              <span className="block truncate text-[11px] text-ink-subtle">
                hr
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
                name={user?.name ?? "HR"}
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
      moreBadge={notificationCount > 0}
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
          const badge = item.label === "Notifications" && notificationCount > 0 ? notificationCount : undefined;
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
              <span className="flex-1">{item.label}</span>
              {!!badge && (
                <span className="flex min-w-4.5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 -mx-6 border-t border-hairline pt-1">
        <NavUserMenuContent
          name={user?.name ?? "HR"}
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