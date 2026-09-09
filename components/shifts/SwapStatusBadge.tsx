"use client";

import type { ShiftSwapStatus } from "@/lib/company-data";

const LABELS: Record<ShiftSwapStatus, string> = {
  pending_target: "Awaiting response",
  accepted_pending_manager: "Awaiting manager",
  approved: "Approved",
  denied: "Denied",
  declined_by_target: "Declined",
  cancelled: "Cancelled",
};

const STYLES: Record<ShiftSwapStatus, string> = {
  pending_target: "border-hairline bg-surface-3 text-ink-subtle",
  accepted_pending_manager: "border-hairline bg-surface-3 text-ink-subtle",
  approved: "border-success/25 bg-success-weak text-success",
  denied: "border-danger/25 bg-danger-weak text-danger",
  declined_by_target: "border-danger/25 bg-danger-weak text-danger",
  cancelled: "border-hairline bg-surface-1 text-ink-faint",
};

const DOTS: Record<ShiftSwapStatus, string> = {
  pending_target: "bg-ink-subtle",
  accepted_pending_manager: "bg-ink-subtle",
  approved: "bg-success",
  denied: "bg-danger",
  declined_by_target: "bg-danger",
  cancelled: "bg-ink-faint",
};

export default function SwapStatusBadge({ status }: { status: ShiftSwapStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      <span className={`size-1.5 rounded-full ${DOTS[status]}`} />
      {LABELS[status]}
    </span>
  );
}
