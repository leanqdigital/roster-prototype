"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { formatDurationMinutes, localDateStr } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { ShiftTemplate } from "@/lib/company-data";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface CreateShiftModalProps {
  defaultDate?: string;
  templates?: ShiftTemplate[];
  onCreate: (shift: {
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    requiredCount: number;
    templateId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export default function CreateShiftModal({
  defaultDate,
  templates = [],
  onCreate,
  onClose,
}: CreateShiftModalProps) {
  const today = localDateStr(new Date());
  const [date, setDate] = useState(defaultDate ?? today);
  const [startTime, setStartTime] = useState("09:00");
  const [durationHours, setDurationHours] = useState("8");
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [title, setTitle] = useState("");
  const [requiredCount, setRequiredCount] = useState("1");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { pushToast } = useToast();

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const t = templates.find((tpl) => tpl.id === id);
    if (!t) return;
    setTitle(t.title);
    setStartTime(t.startTime);
    setDurationHours(String(Math.floor(t.durationMinutes / 60)));
    setDurationMinutes(String(t.durationMinutes % 60));
    setRequiredCount(String(t.requiredCount));
    setError(null);
  };

  const durationTotal =
    parseInt(durationHours || "0", 10) * 60 + parseInt(durationMinutes || "0", 10);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }
    if (date < today) {
      setError("Cannot create shift for a past date.");
      return;
    }
    if (durationTotal <= 0) {
      setError("Duration must be greater than 0.");
      return;
    }
    const count = parseInt(requiredCount, 10);
    if (isNaN(count) || count < 1) {
      setError("Staff required must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onCreate({
        title: title.trim(),
        date,
        startTime,
        durationMinutes: durationTotal,
        requiredCount: count,
        templateId: templateId || undefined,
      });

      if (!result.ok) {
        setError(result.error ?? "Failed to create shift.");
      } else {
        pushToast({ tone: "success", message: "Shift created" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDate = new Date(date + "T12:00:00");
  const dateLabel = `${DAY_NAMES[selectedDate.getDay()]}, ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getDate()}`;

  return (
    <Modal
      open
      title="Create shift"
      description={dateLabel}
      confirmLabel="Create shift"
      confirmLoading={submitting}
      size="lg"
      onClose={onClose}
      onConfirm={handleSubmit}
    >
      <div className="mt-4 space-y-4">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-weak px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        {templates.length > 0 && (
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              Template
            </label>
            <select
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Custom (no template)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} — {formatDurationMinutes(t.durationMinutes)} @ {t.startTime}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            Shift title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(null); }}
            placeholder="e.g. Morning Shift"
            className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            Date
          </label>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => { setDate(e.target.value); setError(null); }}
            className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              Start time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[12px] text-ink-subtle">h</span>
              <input
                type="number"
                min="0"
                max="59"
                step="15"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[12px] text-ink-subtle">m</span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            Staff required
          </label>
          <input
            type="number"
            min="1"
            value={requiredCount}
            onChange={(e) => setRequiredCount(e.target.value)}
            className="h-9 w-full rounded-lg border border-hairline bg-surface-1 px-3 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </Modal>
  );
}
