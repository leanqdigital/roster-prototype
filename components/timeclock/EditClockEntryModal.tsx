"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { ClockAction, ClockEntry } from "@/lib/company-data";
import { zonedTimeToUtc } from "@/lib/timezone";
import Modal from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink transition-colors focus:border-primary/60 focus:outline-none";

function toDatetimeLocalValue(iso: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export default function EditClockEntryModal({
  entry,
  timezone,
  onClose,
  onSave,
}: {
  entry: ClockEntry;
  timezone: string;
  onClose: () => void;
  onSave: (
    patch: { action: ClockAction; at: string },
    reason: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [action, setAction] = useState<ClockAction>(entry.action);
  const [dateTimeLocal, setDateTimeLocal] = useState(() =>
    toDatetimeLocalValue(entry.at, timezone),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    const [datePart, timePart] = dateTimeLocal.split("T");
    if (!datePart || !timePart) {
      setError("Enter a valid date and time.");
      return;
    }
    setSubmitting(true);
    try {
      const at = zonedTimeToUtc(datePart, timePart, timezone).toISOString();
      const result = await onSave({ action, at }, reason);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save — try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Edit clock entry"
      confirmLabel="Save changes"
      hideFooter
      onClose={onClose}
      onConfirm={() => {}}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="edit-clock-action" className="block text-xs font-medium text-ink-muted">
            Action
          </label>
          <select
            id="edit-clock-action"
            value={action}
            onChange={(e) => setAction(e.target.value as ClockAction)}
            className={inputClass}
          >
            <option value="in">Clock in</option>
            <option value="out">Clock out</option>
          </select>
        </div>
        <div>
          <label htmlFor="edit-clock-at" className="block text-xs font-medium text-ink-muted">
            Time
          </label>
          <input
            id="edit-clock-at"
            type="datetime-local"
            value={dateTimeLocal}
            onChange={(e) => setDateTimeLocal(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="edit-clock-reason" className="block text-xs font-medium text-ink-muted">
            Reason for edit
          </label>
          <textarea
            id="edit-clock-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. missed clock-out, forgot to punch in"
            rows={3}
            className="mt-1.5 w-full resize-none rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger-weak px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner className="size-3.5" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
