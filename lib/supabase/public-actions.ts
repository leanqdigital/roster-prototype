"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email";

// Unauthenticated actions live here, distinctly from actions.ts — every
// export in actions.ts role-gates before touching the admin client; this
// file is the opposite (public routes only), so the trust boundary is a
// file-level fact rather than something to check per-function.
//
// Always returns { ok: true } regardless of whether the email matches an
// account — no enumeration oracle on this public endpoint.
export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  const h = await headers();
  const host = h.get("host");
  const isLocal = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${isLocal ? "http" : "https"}://${host}` : "");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    },
  });

  if (error?.code === "user_not_found") {
    console.log(`[password-reset] no account for ${normalizedEmail}`);
    return { ok: true };
  }
  if (error || !data) {
    console.error("[password-reset] generateLink failed:", error?.message);
    return { ok: true };
  }

  // Same reasoning as inviteEmployee: don't email Supabase's own
  // action_link (a GET consumes the token immediately, so email-scanner
  // prefetch would burn it). Email a link to our own confirm page instead,
  // which only calls verifyOtp() on explicit click.
  const confirmLink = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
    data.properties!.hashed_token,
  )}&type=recovery&next=${encodeURIComponent("/reset-password")}`;

  const sent = await sendPasswordResetEmail(normalizedEmail, confirmLink);
  if (!sent.ok) {
    console.error("[password-reset] send email failed:", sent.error);
  }

  return { ok: true };
}
