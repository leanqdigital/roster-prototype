"use client";

import Link from "next/link";
import type { SVGProps } from "react";
import { MoreIcon } from "@/components/ui/icons";

type IconComponent = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

export interface BottomTabItem {
  href: string;
  label: string;
  icon: IconComponent;
  badge?: number;
  disabled?: boolean;
}

interface BottomTabBarProps {
  items: BottomTabItem[];
  onMoreClick: () => void;
  moreActive?: boolean;
  moreBadge?: boolean;
  isActive?: (href: string) => boolean;
}

export default function BottomTabBar({
  items,
  onMoreClick,
  moreActive = false,
  moreBadge = false,
  isActive,
}: BottomTabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 border-t border-hairline bg-surface-2/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = !item.disabled && (isActive ? isActive(item.href) : false);

        if (item.disabled) {
          return (
            <span
              key={item.label}
              title={`${item.label} — select a team first`}
              className="relative flex min-h-11 flex-1 cursor-not-allowed flex-col items-center justify-center gap-0.5 text-ink-subtle opacity-50"
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 ${
              active ? "text-primary" : "text-ink-muted"
            }`}
          >
            {active && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
            )}
            <span className="relative">
              <item.icon className="size-5" />
              {!!item.badge && (
                <span className="absolute -right-1.5 -top-1 flex min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onMoreClick}
        aria-haspopup="dialog"
        aria-expanded={moreActive}
        className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 ${
          moreActive ? "text-primary" : "text-ink-muted"
        }`}
      >
        {moreActive && (
          <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
        )}
        <span className="relative">
          <MoreIcon className="size-5" />
          {moreBadge && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger" />
          )}
        </span>
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}
