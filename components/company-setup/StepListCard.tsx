import type { ComponentType, SVGProps } from "react";
import { PlusIcon } from "@/components/ui/icons";

interface StepListItem {
  id: string;
  primary: string;
  secondary?: string;
}

interface StepListCardProps {
  items: StepListItem[];
  emptyLabel: string;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  addDisabledHint?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function StepListCard({
  items,
  emptyLabel,
  addLabel,
  onAdd,
  addDisabled = false,
  addDisabledHint,
  icon: Icon,
}: StepListCardProps) {
  return (
    <div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 py-3.5 text-center">
          {Icon && <Icon className="size-4 text-ink-subtle" />}
          <p className="text-[13px] text-ink-subtle">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-3 px-3 py-2"
            >
              <span className="truncate text-[13px] font-medium text-ink">
                {item.primary}
              </span>
              {item.secondary && (
                <span className="shrink-0 text-[11px] text-ink-subtle">
                  {item.secondary}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline bg-surface-3/60 text-[13px] font-medium text-ink transition-colors hover:border-primary/40 hover:bg-surface-3 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-ink"
      >
        <PlusIcon className="size-3.5" />
        {addLabel}
      </button>
      {addDisabled && addDisabledHint && (
        <p className="mt-1.5 text-center text-[11px] text-ink-subtle">{addDisabledHint}</p>
      )}
    </div>
  );
}
