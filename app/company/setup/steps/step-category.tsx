"use client";

import { COMPANY_CATEGORIES } from "@/lib/company";
import {
  ShoppingBagIcon,
  UtensilsIcon,
  HeartPulseIcon,
  BedIcon,
  PackageIcon,
  HardHatIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  MoreIcon,
} from "@/components/ui/icons";
import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORY_ICONS: Record<string, IconComponent> = {
  Retail: ShoppingBagIcon,
  Restaurant: UtensilsIcon,
  Healthcare: HeartPulseIcon,
  "Hospitality & Hotels": BedIcon,
  "Warehouse & Logistics": PackageIcon,
  Construction: HardHatIcon,
  "Professional Services": BriefcaseIcon,
  Education: GraduationCapIcon,
  Other: MoreIcon,
};

interface StepCategoryProps {
  category: string;
  setCategory: (category: string) => void;
  onNext: () => void;
}

export default function StepCategory({ category, setCategory, onNext }: StepCategoryProps) {
  return (
    <div>
      <div>
        <label className="block text-xs font-medium text-ink-muted">Company category</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {COMPANY_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            const selected = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-hairline bg-surface-3 text-ink-muted hover:bg-surface-4 hover:text-ink"
                }`}
              >
                <Icon className="size-5" />
                <span className="text-center text-[12px] font-medium">{c}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-subtle">
          Helps us tailor defaults for your business.
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
      >
        Continue
      </button>
    </div>
  );
}
