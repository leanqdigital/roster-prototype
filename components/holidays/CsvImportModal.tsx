"use client";

import { useRef, useState } from "react";
import type { CompanyHolidayInput } from "@/lib/company-data";
import { parseCsvRows } from "@/lib/csv";
import Modal from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

interface CsvImportModalProps {
  onClose: () => void;
  onImport: (
    inputs: CompanyHolidayInput[],
  ) => Promise<{ ok: boolean; error?: string; count: number }>;
}

// Accepts YYYY-MM-DD as-is, or converts MM/DD/YYYY -> YYYY-MM-DD.
function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export default function CsvImportModal({ onClose, onImport }: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CompanyHolidayInput[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; count: number; error?: string } | null>(
    null,
  );

  const handleFile = (file: File) => {
    setErrors([]);
    setPreview(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { headers, rows } = parseCsvRows(text);

      // Map common header aliases to canonical names
      const ALIASES: Record<string, string> = {
        start_date: "start_date",
        startdate: "start_date",
        start: "start_date",
        from: "start_date",
        end_date: "end_date",
        enddate: "end_date",
        end: "end_date",
        to: "end_date",
        name: "name",
        holiday: "name",
        is_active: "is_active",
        active: "is_active",
        enabled: "is_active",
      };

      const normalized = headers.map((h) => ALIASES[h] ?? h);

      // Validate headers
      const required = ["name", "start_date", "end_date"];
      const missing = required.filter((h) => !normalized.includes(h));
      if (missing.length > 0) {
        setErrors([
          `Missing required columns: ${missing.join(", ")}. Found: ${headers.join(", ")}`,
        ]);
        return;
      }

      if (rows.length === 0) {
        setErrors(["CSV file is empty."]);
        return;
      }

      const parsed: CompanyHolidayInput[] = [];
      const errs: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        // Build a row keyed by normalized header names
        const row: Record<string, string> = {};
        headers.forEach((h, j) => {
          row[normalized[j]] = raw[h] ?? "";
        });
        const name = row.name?.trim();
        const startDateRaw = row.start_date?.trim();
        const endDateRaw = row.end_date?.trim();
        const isActive = row.is_active?.trim().toLowerCase();

        if (!name) {
          errs.push(`Row ${i + 2}: name is required`);
          continue;
        }
        const startDate = startDateRaw ? normalizeDate(startDateRaw) : null;
        if (!startDate) {
          errs.push(`Row ${i + 2}: start_date must be YYYY-MM-DD or MM/DD/YYYY`);
          continue;
        }
        const endDate = endDateRaw ? normalizeDate(endDateRaw) : null;
        if (!endDate) {
          errs.push(`Row ${i + 2}: end_date must be YYYY-MM-DD or MM/DD/YYYY`);
          continue;
        }
        if (endDate < startDate) {
          errs.push(`Row ${i + 2}: end_date must be >= start_date`);
          continue;
        }

        parsed.push({
          name,
          startDate,
          endDate,
          isActive: isActive !== "false" && isActive !== "0",
        });
      }

      if (errs.length > 0) {
        setErrors(errs);
        return;
      }

      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setSubmitting(true);
    try {
      const res = await onImport(preview);
      setResult(res);
      if (res.ok) setPreview(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Import holidays from CSV"
      description="Upload a CSV file with columns: name, start_date, end_date, is_active (optional). Dates: YYYY-MM-DD or MM/DD/YYYY."
      confirmLabel={preview ? `Import ${preview.length} holidays` : "Choose file"}
      hideFooter
      onClose={onClose}
      onConfirm={preview ? handleImport : () => fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {!preview && errors.length === 0 && !result && (
        <div className="mt-4 rounded-lg border-2 border-dashed border-hairline p-8 text-center">
          <p className="text-[13px] text-ink-muted">
            Drag and drop a CSV file here, or{" "}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-medium text-primary hover:text-primary-hover"
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-[11px] text-ink-subtle">
            Expected columns: name, start_date, end_date, is_active
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-weak p-3">
          <p className="text-[13px] font-medium text-danger">Import errors</p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-danger/80">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setErrors([]);
              setPreview(null);
            }}
            className="mt-2 text-[12px] font-medium text-primary hover:text-primary-hover"
          >
            Try another file
          </button>
        </div>
      )}

      {preview && (
        <div className="mt-4">
          <p className="text-[13px] font-medium text-ink">
            {preview.length} holiday{preview.length !== 1 ? "s" : ""} ready to import
          </p>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-hairline">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-hairline bg-surface-3">
                  <th className="px-3 py-1.5 font-medium text-ink-subtle">Name</th>
                  <th className="px-3 py-1.5 font-medium text-ink-subtle">Start</th>
                  <th className="px-3 py-1.5 font-medium text-ink-subtle">End</th>
                  <th className="px-3 py-1.5 font-medium text-ink-subtle">Active</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((h, i) => (
                  <tr key={i} className="border-b border-hairline/60 last:border-b-0">
                    <td className="px-3 py-1.5 text-ink">{h.name}</td>
                    <td className="px-3 py-1.5 text-ink-muted">{h.startDate}</td>
                    <td className="px-3 py-1.5 text-ink-muted">{h.endDate}</td>
                    <td className="px-3 py-1.5 text-ink-muted">{h.isActive ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && (
              <p className="px-3 py-1.5 text-[11px] text-ink-subtle">
                ...and {preview.length - 20} more
              </p>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setErrors([]);
              }}
              className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={submitting}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Spinner className="size-3.5" />}
              Import {preview.length} holidays
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4">
          {result.ok ? (
            <div className="rounded-lg border border-success/30 bg-success-weak p-3">
              <p className="text-[13px] font-medium text-success">
                Imported {result.count} holiday{result.count !== 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-danger/30 bg-danger-weak p-3">
              <p className="text-[13px] font-medium text-danger">
                {result.error ?? "Import failed"}
              </p>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
