"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { CompanyHoliday, CompanyHolidayInput } from "@/lib/company-data";
import Modal from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

interface HolidayFormModalProps {
  mode: "create" | "edit";
  holiday?: CompanyHoliday;
  onClose: () => void;
  onSave: (input: CompanyHolidayInput) => Promise<{ ok: boolean; error?: string }>;
}

export default function HolidayFormModal({
  mode,
  holiday,
  onClose,
  onSave,
}: HolidayFormModalProps) {
  const [name, setName] = useState(holiday?.name ?? "");
  const [startDate, setStartDate] = useState(holiday?.startDate ?? "");
  const [endDate, setEndDate] = useState(holiday?.endDate ?? "");
  const [active, setActive] = useState(holiday?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!name.trim()) {
      setError("Holiday name is required.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    if (!endDate) {
      setError("End date is required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }

    const input: CompanyHolidayInput = {
      name: name.trim(),
      startDate,
      endDate,
      isActive: active,
    };

    setSubmitting(true);
    try {
      const result = await onSave(input);
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
      title={mode === "edit" ? "Edit holiday" : "New holiday"}
      description={
        mode === "edit"
          ? "Update this holiday's details."
          : "Add a company-wide holiday or blackout date."
      }
      confirmLabel={mode === "edit" ? "Save changes" : "Create holiday"}
      hideFooter
      onClose={onClose}
      onConfirm={() => {}}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="holiday-name" className="block text-xs font-medium text-ink-muted">
            Name
          </label>
          <input
            id="holiday-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Christmas Day"
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="holiday-start" className="block text-xs font-medium text-ink-muted">
              Start date
            </label>
            <input
              id="holiday-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="holiday-end" className="block text-xs font-medium text-ink-muted">
              End date
            </label>
            <input
              id="holiday-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center justify-start gap-3 rounded-lg py-2.5">
          <div>
            <p className="text-[13px] font-medium text-ink">{active ? "Active" : "Inactive"}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Toggle active"
            onClick={() => setActive((v) => !v)}
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${active ? "bg-primary" : "bg-surface-4"}`}
          >
            <span
              className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-5" : "translate-x-1"}`}
            />
          </button>
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
            {mode === "edit" ? "Save changes" : "Create holiday"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
