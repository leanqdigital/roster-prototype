export default function EditedBadge({
  editedBy,
  editReason,
}: {
  editedBy?: string;
  editReason?: string;
}) {
  const title = [editedBy ? `Edited by ${editedBy}` : "Edited", editReason]
    .filter(Boolean)
    .join(" — ");
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted"
    >
      Edited
    </span>
  );
}
