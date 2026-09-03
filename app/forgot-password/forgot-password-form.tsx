"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import LogoMark from "@/components/ui/Logo";
import { ArrowLeftIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";

export default function ForgotPasswordForm() {
  const { requestPasswordReset } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);
    // Always show the same confirmation, regardless of whether the email
    // matched an account — no enumeration oracle on this public route.
    setSubmitted(true);
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
              Reset your password
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {submitted
                ? "Check your inbox for a reset link."
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-6 text-center text-[13px] text-ink-muted">
            If an account exists for that email, we&apos;ve sent a reset link.
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-6 rounded-xl border border-hairline bg-surface-2 p-6"
          >
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting && <Spinner className="size-3.5" />}
              Send reset link
            </button>
          </form>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to sign in
          </Link>
          <Link
            href="/"
            className="shrink-0 text-xs text-ink-subtle transition-colors hover:text-ink-muted"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
