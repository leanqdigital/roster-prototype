"use client";

import { useMemo, useState } from "react";
import type { CompanyHoliday } from "@/lib/company-data";
import Pagination from "@/components/ui/Pagination";
import { CalendarIcon, PencilIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";

const PAGE_SIZE = 10;

function formatDateRange(start: string, end: string): string {
  if (start === end) return start;
  return `${start} — ${end}`;
}

interface HolidayListProps {
  holidays: CompanyHoliday[];
  onEdit: (holiday: CompanyHoliday) => void;
  onDelete: (holiday: CompanyHoliday) => void;
}

export default function HolidayList({ holidays, onEdit, onDelete }: HolidayListProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return holidays;
    return holidays.filter((h) => h.name.toLowerCase().includes(q));
  }, [holidays, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  return (
    <div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {filtered.length} {filtered.length === 1 ? "holiday" : "holidays"}
        </p>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search holidays…"
            className="h-8 w-48 rounded-lg border border-hairline bg-surface-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-[13px] font-medium text-ink">No holidays found</p>
          <p className="mt-1 text-xs text-ink-muted">
            {holidays.length === 0
              ? "Add your first company holiday."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          {/* Mobile list */}
          <ul className="divide-y divide-hairline md:hidden">
            {paged.map((holiday) => (
              <li key={holiday.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary-weak text-primary">
                      <CalendarIcon className="size-3.5" />
                    </span>
                    <span className="truncate">{holiday.name}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(holiday)}
                      aria-label={`Edit ${holiday.name}`}
                      className="rounded-md p-2.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(holiday)}
                      aria-label={`Delete ${holiday.name}`}
                      className="rounded-md p-2.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-ink-subtle">Dates</dt>
                  <dd className="text-right text-ink-muted">
                    {formatDateRange(holiday.startDate, holiday.endDate)}
                  </dd>
                  <dt className="text-ink-subtle">Status</dt>
                  <dd className="text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        holiday.isActive
                          ? "border-success/25 bg-success-weak text-success"
                          : "border-hairline bg-surface-3 text-ink-subtle"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          holiday.isActive ? "bg-success" : "bg-ink-subtle"
                        }`}
                      />
                      {holiday.isActive ? "Active" : "Inactive"}
                    </span>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {["Name", "Dates", "Status"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {paged.map((holiday) => (
                  <tr
                    key={holiday.id}
                    className="group border-b border-hairline/60 transition-colors last:border-b-0 hover:bg-surface-3/70"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary-weak text-primary">
                          <CalendarIcon className="size-3.5" />
                        </span>
                        {holiday.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDateRange(holiday.startDate, holiday.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                          holiday.isActive
                            ? "border-success/25 bg-success-weak text-success"
                            : "border-hairline bg-surface-3 text-ink-subtle"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            holiday.isActive ? "bg-success" : "bg-ink-subtle"
                          }`}
                        />
                        {holiday.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onEdit(holiday)}
                          aria-label={`Edit ${holiday.name}`}
                          className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(holiday)}
                          aria-label={`Delete ${holiday.name}`}
                          className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
