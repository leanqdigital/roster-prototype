"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import LogoMark from "@/components/ui/Logo";
import NavUserMenuContent from "@/components/ui/NavUserMenuContent";
import BottomTabBar from "@/components/ui/BottomTabBar";
import Modal from "@/components/ui/Modal";
import { BellIcon, ChevronDownIcon, ListIcon, ShieldIcon } from "@/components/ui/icons";

const TABS = [
  { href: "/admin", label: "Companies" },
  { href: "/admin/audit-log", label: "Audit log" },
];

const MOBILE_TABS = [
  { href: "/admin", label: "Companies", icon: ListIcon },
  { href: "/admin/audit-log", label: "Audit log", icon: ShieldIcon },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const handleSignOut = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    signOut();
    router.push("/");
  };

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur">
      <div className="flex h-13 items-center gap-6 px-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Roster<span className="text-ink-subtle"> / Admin</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                isActive(tab.href)
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
              {isActive(tab.href) && (
                <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <BellIcon className="size-4" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-2"
            >
              <span className="flex size-6.5 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                {user?.name
                  ? user.name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "SA"}
              </span>
              <ChevronDownIcon className="size-3.5 text-ink-subtle" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-hairline bg-surface-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
              >
                <NavUserMenuContent
                  name={user?.name ?? "Super admin"}
                  email={user?.email ?? "superadmin@gmail.com"}
                  subtitle={user?.company}
                  extra={
                    <span className="mt-1.5 inline-block rounded-md border border-primary/30 bg-primary-weak px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      {user?.role === "super_admin" ? "super admin" : "company admin"}
                    </span>
                  }
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onSignOut={handleSignOut}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

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
      <div className="mt-4 -mx-6 border-t border-hairline pt-1">
        <NavUserMenuContent
          name={user?.name ?? "Super admin"}
          email={user?.email ?? "superadmin@gmail.com"}
          subtitle={user?.company}
          extra={
            <span className="mt-1.5 inline-block rounded-md border border-primary/30 bg-primary-weak px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              {user?.role === "super_admin" ? "super admin" : "company admin"}
            </span>
          }
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={handleSignOut}
        />
      </div>
    </Modal>
    </>
  );
}