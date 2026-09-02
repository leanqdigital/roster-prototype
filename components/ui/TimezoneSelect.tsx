"use client";

import { useState } from "react";
import { TIMEZONES } from "@/lib/company";
import { ChevronDownIcon } from "@/components/ui/icons";

const inputClass =
  "h-9 w-full appearance-none rounded-lg border border-hairline bg-surface-3 px-3 pr-9 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

function formatTz(tz: string): string {
  return tz.replace(/_/g, " ");
}

interface TimezoneSelectProps {
  id?: string;
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
}

/** Searchable IANA timezone picker. Type to filter, click/enter to select. */
export default function TimezoneSelect({
  id,
  value,
  onChange,
  className,
}: TimezoneSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // While closed, the input mirrors the selected value; while open, it
  // shows whatever the user has typed so far (starting from that value).
  const displayValue = open ? query : formatTz(value);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? TIMEZONES.filter((tz) => formatTz(tz).toLowerCase().includes(needle))
    : TIMEZONES;

  const select = (tz: string) => {
    onChange(tz);
    setOpen(false);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-list` : undefined}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setQuery(formatTz(value));
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[highlight]) select(filtered[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
        placeholder="Search timezone…"
        className={inputClass}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
      {open && (
        <ul
          id={id ? `${id}-list` : undefined}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-hairline bg-surface-2 py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-[12.5px] text-ink-subtle">
              No matches
            </li>
          ) : (
            filtered.map((tz, i) => (
              <li key={tz} role="option" aria-selected={tz === value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(tz)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`block w-full truncate px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                    i === highlight ? "bg-surface-3" : ""
                  } ${tz === value ? "font-medium text-primary" : "text-ink"}`}
                >
                  {formatTz(tz)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
