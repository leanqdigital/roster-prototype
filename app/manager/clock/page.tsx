"use client";

import { useManager } from "@/lib/manager-team";
import { ClockIcon, UsersIcon } from "@/components/ui/icons";
import ClockInOutPanel from "@/components/timeclock/ClockInOutPanel";

export default function ManagerClockPage() {
  const { myPerson } = useManager();

  if (!myPerson) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Clock In/Out</h1>
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <UsersIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            You&apos;re not linked to a team member record yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Ask a company admin to set up your manager profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-weak text-primary">
          <ClockIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Clock In/Out</h1>
          <p className="mt-0.5 text-xs text-ink-subtle">{myPerson.name}</p>
        </div>
      </div>

      <ClockInOutPanel person={myPerson} requireShift={false} />
    </div>
  );
}
