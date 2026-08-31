interface WizardNavProps {
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  /** "primary" for a completed/confirmed step, "ghost" for an optional skip. */
  continueVariant?: "primary" | "ghost";
}

export default function WizardNav({
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueVariant = "primary",
}: WizardNavProps) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onContinue}
        className={
          continueVariant === "primary"
            ? "h-8 rounded-lg bg-primary px-4 text-[13px] font-medium text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
            : "h-8 rounded-lg px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        }
      >
        {continueLabel}
      </button>
    </div>
  );
}
