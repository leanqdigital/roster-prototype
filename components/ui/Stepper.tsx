import { CheckIcon } from "./icons";

interface StepperProps {
  steps: string[];
  current: number; // 1-indexed
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                  done
                    ? "bg-primary"
                    : active
                      ? "border-2 border-primary bg-surface-2 ring-4 ring-primary/20"
                      : "border border-hairline bg-surface-3"
                }`}
              >
                {done && <CheckIcon className="size-2.5 text-white" strokeWidth={3} />}
                {active && <span className="size-1.5 rounded-full bg-primary" />}
              </span>
              {n < steps.length && (
                <span
                  className={`mx-1.5 h-px flex-1 transition-colors ${
                    done ? "bg-primary" : "bg-hairline"
                  }`}
                />
              )}
            </div>
            <span
              className={`mt-1.5 max-w-full truncate text-[11px] font-medium ${
                active ? "text-primary" : done ? "text-ink-muted" : "text-ink-subtle"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
