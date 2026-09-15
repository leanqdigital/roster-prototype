"use client";

import Modal from "@/components/ui/Modal";

interface EmailTemplatePreviewModalProps {
  subject: string;
  html: string;
  onClose: () => void;
}

export default function EmailTemplatePreviewModal({
  subject,
  html,
  onClose,
}: EmailTemplatePreviewModalProps) {
  return (
    <Modal
      open
      title="Email preview"
      description="Rendered with sample data — not sent."
      confirmLabel="Close"
      size="xl"
      hideFooter
      onClose={onClose}
      onConfirm={() => {}}
    >
      <div className="mt-5 space-y-3">
        <div>
          <p className="text-xs font-medium text-ink-muted">Subject</p>
          <p className="mt-1 rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px] text-ink">
            {subject}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-muted">Body</p>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={html}
            className="mt-1 h-[500px] w-full rounded-lg border border-hairline bg-white"
          />
        </div>
      </div>
    </Modal>
  );
}
