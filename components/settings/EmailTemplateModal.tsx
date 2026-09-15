"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { previewEmailTemplate } from "@/lib/supabase/actions";
import { EMAIL_TEMPLATE_META } from "@/lib/email-templates";
import type { EmailTemplateKey, EmailTemplateOverride } from "@/lib/email-templates";
import EmailTemplatePreviewModal from "./EmailTemplatePreviewModal";
import { EyeIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

const textareaClass =
  "mt-1.5 w-full resize-none rounded-lg border border-hairline bg-surface-3 px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

interface EmailTemplateModalProps {
  templateKey: EmailTemplateKey;
  override?: EmailTemplateOverride;
  onClose: () => void;
  // Both persist directly to the DB (no outer form "Save changes" needed).
  // Return false on failure to keep the modal open.
  onSave: (override: EmailTemplateOverride) => Promise<boolean>;
  onResetToDefault: () => Promise<boolean>;
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
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const busy = saving || resetting;

  const onSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      const ok = await onSave({ subject, html });
      if (ok) onClose();
      else setError("Couldn't save template.");
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    setError(null);
    setResetting(true);
    try {
      const ok = await onResetToDefault();
      if (ok) onClose();
      else setError("Couldn't reset template.");
    } finally {
      setResetting(false);
    }
  };

  const onPreview = async () => {
    setError(null);
    setPreviewing(true);
    try {
      const draft = subject.trim() && html.trim() ? { subject, html } : null;
      const result = await previewEmailTemplate(templateKey, draft);
      if (result.ok) setPreview({ subject: result.subject, html: result.html });
      else setError(result.error);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Modal
      open
      title={`Edit template — ${meta.title}`}
      description="Custom subject and HTML for this notification. Leave blank to use the default template. Saves immediately."
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
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger-weak px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={onReset}
            disabled={!override || busy}
            className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resetting ? "Resetting…" : "Reset to default"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={previewing}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {previewing ? <Spinner className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              Preview
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!subject.trim() || !html.trim() || busy}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Spinner className="size-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <EmailTemplatePreviewModal
          subject={preview.subject}
          html={preview.html}
          onClose={() => setPreview(null)}
        />
      )}
    </Modal>
  );
}
