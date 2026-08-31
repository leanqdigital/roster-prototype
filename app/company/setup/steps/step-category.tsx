"use client";

import { COMPANY_CATEGORIES } from "@/lib/company";
import { ChevronDownIcon } from "@/components/ui/icons";

interface StepCategoryProps {
  category: string;
  setCategory: (category: string) => void;
  onNext: () => void;
}

export default function StepCategory({ category, setCategory, onNext }: StepCategoryProps) {
  return (
    <div>
      <div>
        <label htmlFor="category" className="block text-xs font-medium text-ink-muted">
          Company category
        </label>
        <div className="relative mt-1.5">
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-hairline bg-surface-3 px-3 pr-9 text-[13px] text-ink transition-colors focus:border-primary/60 focus:outline-none"
          >
            {COMPANY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
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
