"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { localDateStr } from "@/lib/format";
import type { Shift } from "@/lib/company-data";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = DAY_NAMES[d.getDay()];
  const month = MONTH_NAMES[d.getMonth()];
  return `${day}, ${month} ${d.getDate()}`;
}

interface PublishShiftsModalProps {
  shifts: Shift[];
  defaultStart?: string;
  defaultEnd?: string;
  onPublish: (ids: string[]) => Promise<{ count: number }>;
  onClose: () => void;
}

export default function PublishShiftsModal({
  shifts,
  defaultStart,
  defaultEnd,
  onPublish,
  onClose,
}: PublishShiftsModalProps) {
  const today = localDateStr(new Date());
  const [start, setStart] = useState(() => {
    const d = defaultStart ?? today;
    return d < today ? today : d;
  });
  const [end, setEnd] = useState(() => {
    const d = defaultEnd ?? today;
    return d < today ? today : d;
  });
  const [submitting, setSubmitting] = useState(false);

  const matched = useMemo(() => {
    if (!start || !end || start > end) return [];
    return shifts
      .filter((s) => s.status === "draft" && s.date >= start && s.date <= end)
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  }, [shifts, start, end]);

  const handleSubmit = async () => {
    if (submitting || matched.length === 0) return;
    setSubmitting(true);
    try {
      await onPublish(matched.map((s) => s.id));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Publish shifts"
      description="Draft shifts in this date range will become visible to employees."
      confirmLabel={`Publish ${matched.length > 0 ? matched.length : ""} shift${matched.length === 1 ? "" : "s"}`}
      confirmLoading={submitting}
      size="lg"
      onClose={onClose}
      onConfirm={handleSubmit}
    >
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              From
            </label>
            <input
              type="date"
              value={start}
              min={today}
              onChange={(e) => setStart(e.target.value)}
              className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              To
            </label>
            <input
              type="date"
              value={end}
              min={start || today}
              onChange={(e) => setEnd(e.target.value)}
              className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {matched.length === 0 ? (
          <div className="rounded-lg border border-hairline bg-surface-3 p-6 text-center">
            <p className="text-[13px] font-medium text-ink">No draft shifts in this range</p>
            <p className="mt-1 text-xs text-ink-muted">Widen the date range or add draft shifts first.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-hairline bg-surface-1 px-3 py-2">
            <p className="text-[13px] text-ink-muted">
              <span className="font-semibold text-ink">{matched.length}</span>{" "}
              draft {matched.length === 1 ? "shift" : "shifts"} will be published.
            </p>
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
              {matched.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2"
                >
                  <div>
                    <p className="text-[13px] font-medium text-ink">{shift.title}</p>
                    <p className="text-[11px] text-ink-subtle">
                      {formatDateShort(shift.date)} {" \u00b7 "} {shift.startTime}
                    </p>
                  </div>
                  <span className="text-[11px] text-ink-subtle">
                    {shift.requiredCount} {shift.requiredCount === 1 ? "slot" : "slots"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
