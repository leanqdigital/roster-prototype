import { initials } from "@/lib/format";

export default function Avatar({
  name,
  src,
  className = "size-8 text-[11px] font-semibold",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-4 text-ink ${className}`}
    >
      {initials(name) || "?"}
    </span>
  );
}
