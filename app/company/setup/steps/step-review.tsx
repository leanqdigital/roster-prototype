"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-data";
import { completeCompanySetup } from "@/lib/company";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui/Spinner";

interface StepReviewProps {
  category: string;
  onBack: () => void;
}

export default function StepReview({ category, onBack }: StepReviewProps) {
  const router = useRouter();
  const { locations, teams, people, shiftTemplates } = useCompany();
  const { pushToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async () => {
    setError(null);
    setSubmitting(true);
    const result = await completeCompanySetup(category);
    setSubmitting(false);
    if (!result) {
      setError("Couldn't save setup — try again.");
      return;
    }
    pushToast({ tone: "success", message: "Company set up" });
    router.replace("/dashboard");
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">Review</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Confirm what you've set up. You can add more from the app anytime.
      </p>

      <ul className="mt-4 space-y-1.5">
        <li className="flex items-center justify-between rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px]">
          <span className="text-ink-muted">Category</span>
          <span className="font-medium text-ink">{category}</span>
        </li>
        <li className="flex items-center justify-between rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px]">
          <span className="text-ink-muted">Locations</span>
          <span className="font-medium text-ink">{locations.length}</span>
        </li>
        <li className="flex items-center justify-between rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px]">
          <span className="text-ink-muted">Teams</span>
          <span className="font-medium text-ink">{teams.length}</span>
        </li>
        <li className="flex items-center justify-between rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px]">
          <span className="text-ink-muted">People</span>
          <span className="font-medium text-ink">{people.length}</span>
        </li>
        <li className="flex items-center justify-between rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px]">
          <span className="text-ink-muted">Shift templates</span>
          <span className="font-medium text-ink">{shiftTemplates.length}</span>
        </li>
      </ul>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger-weak px-3 py-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={submitting}
          className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting && <Spinner className="size-3.5" />}
          {submitting ? "Saving…" : "Finish setup"}
        </button>
      </div>
    </div>
  );
}
