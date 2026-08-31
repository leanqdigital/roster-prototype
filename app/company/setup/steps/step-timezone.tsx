"use client";

import { TIMEZONES } from "@/lib/company";
import { ChevronDownIcon } from "@/components/ui/icons";

interface StepTimezoneProps {
  timezone: string;
  setTimezone: (tz: string) => void;
  onNext: () => void;
}

export default function StepTimezone({ timezone, setTimezone, onNext }: StepTimezoneProps) {
  return (
    <div>
      <div>
        <label htmlFor="timezone" className="block text-xs font-medium text-ink-muted">
          Timezone
        </label>
        <div className="relative mt-1.5">
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-hairline bg-surface-3 px-3 pr-9 text-[13px] text-ink transition-colors focus:border-primary/60 focus:outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-subtle">
          Schedules display in this company timezone by default.
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
