// Converts a wall-clock date/time in a given IANA timezone to the UTC
// instant it represents, using only built-in Intl (no date-fns-tz dep).
//
// Approach: treat (dateStr, timeStr) as if it were UTC to get a naive
// instant, then look up what wall-clock time that instant renders as in
// `timeZone`. The delta between the naive instant and that rendered
// wall-clock time is the zone's offset at that moment, which we subtract
// back out. Single-pass — doesn't iterate to converge across a DST
// transition, which is acceptable given the 10-minute reminder tolerance.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(naiveUtc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  // formatToParts renders midnight hour as "24" with hour12: false in some
  // engines — normalize.
  const renderedHour = get("hour") % 24;

  const renderedAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    renderedHour,
    get("minute"),
    get("second"),
  );

  const offsetMs = renderedAsUtc - naiveUtc;
  return new Date(naiveUtc - offsetMs);
}
