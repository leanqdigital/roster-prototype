import { Spinner } from "@/components/ui/Spinner";

export default function PageLoading() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <Spinner className="size-6 text-ink-faint" />
      <p className="text-sm font-medium text-ink-subtle">Loading…</p>
    </div>
  );
}
