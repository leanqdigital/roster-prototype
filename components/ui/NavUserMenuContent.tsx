import type { ReactNode } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

interface NavUserMenuContentProps {
  name: string;
  email?: string;
  subtitle?: string;
  extra?: ReactNode;
  theme: string;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

export default function NavUserMenuContent({
  name,
  email,
  subtitle,
  extra,
  theme,
  onToggleTheme,
  onSignOut,
}: NavUserMenuContentProps) {
  return (
    <>
      <div className="px-3 py-2.5">
        <p className="truncate text-[13px] font-medium text-ink">{name}</p>
        {email && (
          <p className="mt-0.5 truncate text-xs text-ink-muted">{email}</p>
        )}
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-ink-subtle">{subtitle}</p>
        )}
        {extra}
      </div>
      <div className="border-t border-hairline" />
      <div className="p-1">
        <button
          role="menuitem"
          onClick={onToggleTheme}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
        >
          {theme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
      <div className="border-t border-hairline" />
      <div className="p-1">
        <button
          role="menuitem"
          onClick={onSignOut}
          className="w-full rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-danger transition-colors hover:bg-surface-3"
        >
          Sign out
        </button>
      </div>
    </>
  );
}
