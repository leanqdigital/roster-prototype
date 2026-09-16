"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useCompany } from "@/lib/company-data";
import type { LeaveTypeDef, LeaveTypeInput } from "@/lib/company-data";
import { useToast } from "@/lib/toast";
import Modal from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { BriefcaseIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

type ModalState = { mode: "create" } | { mode: "edit"; leaveType: LeaveTypeDef } | null;

function LeaveTypeFormModal({
  mode,
  leaveType,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  leaveType?: LeaveTypeDef;
  onClose: () => void;
  onSave: (input: LeaveTypeInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [name, setName] = useState(leaveType?.name ?? "");
  const [tracksBalance, setTracksBalance] = useState(leaveType?.tracksBalance ?? false);
  const [defaultBalanceDays, setDefaultBalanceDays] = useState(
    String(leaveType?.defaultBalanceDays ?? 0),
  );
  const [active, setActive] = useState(leaveType?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    const input: LeaveTypeInput = {
      name: name.trim(),
      key: mode === "edit" ? leaveType!.key : slugify(name),
      tracksBalance,
      defaultBalanceDays: tracksBalance ? Number(defaultBalanceDays) || 0 : 0,
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
      title={mode === "edit" ? "Edit leave type" : "New leave type"}
      description={
        mode === "edit"
          ? "Update this leave type's details."
          : "Add a leave type employees can request."
      }
      confirmLabel={mode === "edit" ? "Save changes" : "Create leave type"}
      hideFooter
      onClose={onClose}
      onConfirm={() => {}}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="leave-type-name" className="block text-xs font-medium text-ink-muted">
            Name
          </label>
          <input
            id="leave-type-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maternity"
            className={inputClass}
          />
        </div>
        {mode === "edit" && (
          <div>
            <label className="block text-xs font-medium text-ink-muted">Key</label>
            <input
              type="text"
              value={leaveType!.key}
              disabled
              className={`${inputClass} cursor-not-allowed opacity-60`}
            />
          </div>
        )}
        <div className="flex items-center justify-start gap-3 rounded-lg py-1">
          <p className="text-[13px] font-medium text-ink">
            {tracksBalance ? "Tracks balance" : "Doesn't track balance"}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={tracksBalance}
            aria-label="Toggle tracks balance"
            onClick={() => setTracksBalance((v) => !v)}
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${tracksBalance ? "bg-primary" : "bg-surface-4"}`}
          >
            <span
              className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${tracksBalance ? "translate-x-5" : "translate-x-1"}`}
            />
          </button>
        </div>
        {tracksBalance && (
          <div>
            <label
              htmlFor="leave-type-default-balance"
              className="block text-xs font-medium text-ink-muted"
            >
              Default balance days <span className="text-ink-faint">(informational only)</span>
            </label>
            <input
              id="leave-type-default-balance"
              type="number"
              min={0}
              step={0.5}
              value={defaultBalanceDays}
              onChange={(e) => setDefaultBalanceDays(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        {mode === "edit" && (
          <div className="flex items-center justify-start gap-3 rounded-lg py-1">
            <p className="text-[13px] font-medium text-ink">{active ? "Active" : "Inactive"}</p>
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
        )}
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
            {mode === "edit" ? "Save changes" : "Create leave type"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function LeaveTypesPage() {
  const { leaveTypes, createLeaveType, updateLeaveType } = useCompany();
  const { pushToast } = useToast();
  const [modal, setModal] = useState<ModalState>(null);

  const sorted = useMemo(
    () => [...leaveTypes].sort((a, b) => a.sortOrder - b.sortOrder),
    [leaveTypes],
  );

  const handleSave = async (
    input: LeaveTypeInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (modal?.mode === "edit") {
      const ok = await updateLeaveType(modal.leaveType.id, input);
      if (!ok) return { ok: false, error: "Couldn't save — try again." };
    } else {
      const result = await createLeaveType(input);
      if (!result.ok) return { ok: false, error: result.error ?? "Couldn't create leave type." };
    }
    setModal(null);
    pushToast({
      tone: "success",
      message: modal?.mode === "edit" ? "Leave type updated" : "Leave type created",
    });
    return { ok: true };
  };

  const handleToggleActive = async (leaveType: LeaveTypeDef) => {
    const ok = await updateLeaveType(leaveType.id, { isActive: !leaveType.isActive });
    pushToast(
      ok
        ? { tone: "success", message: leaveType.isActive ? "Leave type deactivated" : "Leave type reactivated" }
        : { tone: "danger", message: "Couldn't update — try again." },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Leave Types</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Configure the leave types employees can request, and whether each tracks a balance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          <PlusIcon className="size-3.5" />
          New leave type
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
        <ul className="divide-y divide-hairline md:hidden">
          {sorted.map((t) => (
            <li key={t.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary-weak text-primary">
                    <BriefcaseIcon className="size-3.5" />
                  </span>
                  <span className="truncate">{t.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "edit", leaveType: t })}
                  aria-label={`Edit ${t.name}`}
                  className="rounded-md p-2.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <PencilIcon className="size-3.5" />
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-ink-subtle">Key</dt>
                <dd className="text-right text-ink-muted">{t.key}</dd>
                <dt className="text-ink-subtle">Tracks balance</dt>
                <dd className="text-right text-ink-muted">
                  {t.tracksBalance ? `Yes (${t.defaultBalanceDays}d default)` : "No"}
                </dd>
                <dt className="text-ink-subtle">Status</dt>
                <dd className="text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      t.isActive
                        ? "border-success/25 bg-success-weak text-success"
                        : "border-hairline bg-surface-3 text-ink-subtle"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${t.isActive ? "bg-success" : "bg-ink-subtle"}`} />
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </dd>
              </dl>
              <button
                type="button"
                onClick={() => handleToggleActive(t)}
                className="w-full rounded-md border border-hairline bg-surface-3 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {t.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline">
                {["Name", "Key", "Tracks balance", "Default balance days", "Status"].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle"
                  >
                    {h}
                  </th>
                ))}
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className="group border-b border-hairline/60 transition-colors last:border-b-0 hover:bg-surface-3/70"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary-weak text-primary">
                        <BriefcaseIcon className="size-3.5" />
                      </span>
                      {t.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{t.key}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        t.tracksBalance
                          ? "border-primary/25 bg-primary-weak text-primary"
                          : "border-hairline bg-surface-3 text-ink-subtle"
                      }`}
                    >
                      {t.tracksBalance ? "Tracks balance" : "No tracking"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {t.tracksBalance ? t.defaultBalanceDays : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        t.isActive
                          ? "border-success/25 bg-success-weak text-success"
                          : "border-hairline bg-surface-3 text-ink-subtle"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${t.isActive ? "bg-success" : "bg-ink-subtle"}`} />
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t)}
                        className="rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
                      >
                        {t.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", leaveType: t })}
                        aria-label={`Edit ${t.name}`}
                        className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <LeaveTypeFormModal
          key={modal.mode === "edit" ? modal.leaveType.id : "create"}
          mode={modal.mode}
          leaveType={modal.mode === "edit" ? modal.leaveType : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
