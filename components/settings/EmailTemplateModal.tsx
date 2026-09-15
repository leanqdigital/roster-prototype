"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { EMAIL_TEMPLATE_META } from "@/lib/email-templates";
import type { EmailTemplateKey, EmailTemplateOverride } from "@/lib/email-templates";

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

const textareaClass =
  "mt-1.5 w-full resize-none rounded-lg border border-hairline bg-surface-3 px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

interface EmailTemplateModalProps {
  templateKey: EmailTemplateKey;
  override?: EmailTemplateOverride;
  onClose: () => void;
  onSave: (override: EmailTemplateOverride) => void;
  onResetToDefault: () => void;
}

export default function EmailTemplateModal({
  templateKey,
  override,
  onClose,
  onSave,
  onResetToDefault,
}: EmailTemplateModalProps) {
  const meta = EMAIL_TEMPLATE_META[templateKey];
  const [subject, setSubject] = useState(override?.subject ?? "");
  const [html, setHtml] = useState(override?.html ?? "");

  const onSubmit = () => {
    onSave({ subject, html });
    onClose();
  };

  return (
    <Modal
      open
      title={`Edit template — ${meta.title}`}
      description="Custom subject and HTML for this notification. Leave blank to use the default template."
      confirmLabel="Save"
      size="lg"
      hideFooter
      onClose={onClose}
      onConfirm={() => {}}
    >
      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="template-subject"
            className="block text-xs font-medium text-ink-muted"
          >
            Subject
          </label>
          <input
            id="template-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. New shift assigned: {{shiftTitle}}"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="template-html" className="block text-xs font-medium text-ink-muted">
            HTML body
          </label>
          <textarea
            id="template-html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<p>Hi, you've been assigned {{shiftTitle}} on {{date}}.</p>"
            rows={12}
            className={textareaClass}
          />
        </div>
        <div>
          <p className="text-xs font-medium text-ink-muted">Available variables</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meta.variables.map((v) => (
              <code
                key={v}
                className="rounded border border-hairline bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-muted"
              >
                {`{{${v}}}`}
              </code>
            ))}
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onResetToDefault();
              onClose();
            }}
            disabled={!override}
            className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!subject.trim() || !html.trim()}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
