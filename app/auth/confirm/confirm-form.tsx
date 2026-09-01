"use client";

import { useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/lib/toast";
import LogoMark from "@/components/ui/Logo";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";

// Deliberately requires an explicit button click before calling verifyOtp().
// If we auto-verified on page load (GET), email security scanners that
// prefetch links in incoming mail would burn the single-use token before
// the invitee ever opens it — scanners follow redirects but don't click
// buttons or submit forms.
export default function ConfirmInviteForm() {
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = !!tokenHash && !!type;

  const onConfirm = async () => {
    if (!tokenHash || !type) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    pushToast({ tone: "success", message: "Invite confirmed" });
    // Hard navigation, not router.replace(). verifyOtp() persists the session
    // to cookies, but AuthProvider picks it up via an async onAuthStateChange
    // -> loadAuthUser() chain (network round trip). A soft client-side nav
    // lands on /accept-invite before that chain resolves, so it reads a
    // stale user=null and shows "invite invalid or expired". A full reload
    // forces AuthProvider to remount and read the already-persisted session
    // cleanly, no race.
    window.location.assign(next);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="fixed right-4 top-4 rounded-lg border border-hairline bg-surface-2 p-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        {theme === "dark" ? (
          <SunIcon className="size-4" />
        ) : (
          <MoonIcon className="size-4" />
        )}
      </button>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3">
          <LogoMark className="size-11" />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Confirm your invite
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {valid
                ? "Click below to confirm and set your password."
                : "This invite link is missing or malformed."}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-6">
          {(error || !valid) && (
            <p className="mb-4 rounded-lg border border-danger/30 bg-danger-weak px-3 py-2 text-[13px] font-medium text-danger">
              {error ?? "Ask your admin to resend the invite, then open the new link."}
            </p>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={!valid || submitting}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Spinner className="size-3.5" />}
            {submitting ? "Confirming…" : "Confirm invite"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center">
          <Link
            href="/login"
            className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
