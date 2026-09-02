import type { Punctuality } from "@/lib/company-data";

const STYLES: Record<Punctuality, string> = {
  early_in: "border-primary/25 bg-primary-weak text-primary",
  late_in: "border-warning/25 bg-warning-weak text-warning",
  on_time_in: "border-success/25 bg-success-weak text-success",
  early_out: "border-warning/25 bg-warning-weak text-warning",
  late_out: "border-primary/25 bg-primary-weak text-primary",
  on_time_out: "border-success/25 bg-success-weak text-success",
};

const LABELS: Record<Punctuality, string> = {
  early_in: "Early In",
  late_in: "Late In",
  on_time_in: "On Time",
  early_out: "Early Out",
  late_out: "Late Out",
  on_time_out: "On Time",
};

export default function PunctualityBadge({
  label,
  deviationMinutes,
}: {
  label: Punctuality;
  deviationMinutes?: number;
}) {
  const title =
    deviationMinutes === undefined || deviationMinutes === 0
      ? undefined
      : deviationMinutes < 0
        ? `${Math.abs(deviationMinutes)}m before scheduled time`
        : `${deviationMinutes}m after scheduled time`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${STYLES[label]}`}
    >
      {LABELS[label]}
    </span>
  );
}
