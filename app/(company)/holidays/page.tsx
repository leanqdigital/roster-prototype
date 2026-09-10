"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { CompanyHoliday, CompanyHolidayInput } from "@/lib/company-data";
import { useToast } from "@/lib/toast";
import Modal from "@/components/ui/Modal";
import { CalendarIcon, DownloadIcon, PlusIcon } from "@/components/ui/icons";
import HolidayList from "@/components/holidays/HolidayList";
import HolidayFormModal from "@/components/holidays/HolidayFormModal";
import CsvImportModal from "@/components/holidays/CsvImportModal";
import { downloadCsv, toCsv } from "@/lib/csv";

type HolidayModalState =
  | { mode: "create" }
  | { mode: "edit"; holiday: CompanyHoliday }
  | null;

export default function HolidaysPage() {
  const { companyHolidays, createCompanyHoliday, updateCompanyHoliday, deleteCompanyHoliday, importCompanyHolidays } =
    useCompany();
  const { pushToast } = useToast();
  const [modal, setModal] = useState<HolidayModalState>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CompanyHoliday | null>(null);
  const [saved, setSaved] = useState(false);

  const activeCount = useMemo(
    () => companyHolidays.filter((h) => h.isActive).length,
    [companyHolidays],
  );

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  const handleDownloadTemplate = () => {
    const csv = toCsv(
      [
        { name: "Christmas Day", startDate: "2025-12-25", endDate: "2025-12-25", isActive: true },
        { name: "New Year", startDate: "2026-01-01", endDate: "2026-01-01", isActive: true },
      ],
      [
        { header: "name", accessor: (r) => r.name },
        { header: "start_date", accessor: (r) => r.startDate },
        { header: "end_date", accessor: (r) => r.endDate },
        { header: "is_active", accessor: (r) => r.isActive },
      ],
    );
    downloadCsv("holidays-template.csv", csv);
  };

  const handleSave = async (
    input: CompanyHolidayInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (modal?.mode === "edit") {
      const ok = await updateCompanyHoliday(modal.holiday.id, input);
      if (!ok) {
        return { ok: false, error: "Couldn't save — try again." };
      }
    } else {
      const holiday = await createCompanyHoliday(input);
      if (!holiday) {
        return { ok: false, error: "Couldn't create holiday." };
      }
    }
    setModal(null);
    flashSaved();
    pushToast({ tone: "success", message: modal?.mode === "edit" ? "Holiday updated" : "Holiday created" });
    return { ok: true };
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Company Holidays
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage holidays and blackout dates. Shifts can&apos;t be created on active holidays.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {saved && (
            <span className="rounded-lg border border-success/25 bg-success-weak px-2.5 py-1.5 text-xs font-medium text-success">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <DownloadIcon className="size-3.5" />
            CSV template
          </button>
          <button
            type="button"
            onClick={() => setCsvOpen(true)}
            className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <DownloadIcon className="size-3.5 rotate-180" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="size-3.5" />
            New holiday
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary-weak text-primary">
            <CalendarIcon className="size-4" />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">{companyHolidays.length}</p>
            <p className="text-[11px] text-ink-subtle">total holidays</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-success/25 bg-success-weak text-success">
            <CalendarIcon className="size-4" />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">{activeCount}</p>
            <p className="text-[11px] text-ink-subtle">active</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-ink-subtle">
            <CalendarIcon className="size-4" />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">
              {companyHolidays.length - activeCount}
            </p>
            <p className="text-[11px] text-ink-subtle">inactive</p>
          </div>
        </div>
      </div>

      {companyHolidays.length === 0 ? (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary-weak text-primary">
            <CalendarIcon className="size-5" />
          </span>
          <h2 className="mt-3 text-[15px] font-semibold text-ink">No holidays yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Add company holidays to prevent shifts from being scheduled on those dates.
          </p>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="size-3.5" />
            Add a holiday
          </button>
        </div>
      ) : (
        <HolidayList
          holidays={companyHolidays}
          onEdit={(holiday) => setModal({ mode: "edit", holiday })}
          onDelete={setConfirmDelete}
        />
      )}

      {modal && (
        <HolidayFormModal
          key={modal.mode === "edit" ? modal.holiday.id : "create"}
          mode={modal.mode}
          holiday={modal.mode === "edit" ? modal.holiday : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {csvOpen && (
        <CsvImportModal
          onClose={() => setCsvOpen(false)}
          onImport={async (inputs) => {
            const res = await importCompanyHolidays(inputs);
            if (res.ok) {
              flashSaved();
              pushToast({ tone: "success", message: `Imported ${res.count} holidays` });
              setCsvOpen(false);
            }
            return res;
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          open
          title={`Delete ${confirmDelete.name}?`}
          description="This holiday will be removed. Shifts on these dates will become available again."
          tone="danger"
          confirmLabel="Delete holiday"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            deleteCompanyHoliday(confirmDelete.id);
            setConfirmDelete(null);
            flashSaved();
            pushToast({ tone: "success", message: "Holiday deleted" });
          }}
        />
      )}
    </div>
  );
}
