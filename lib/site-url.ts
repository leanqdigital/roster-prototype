import "server-only";

// Base URL for links embedded in outbound emails (invite / password reset).
// Deliberately NOT derived from the request's Host header: if this app ever
// sits behind a misconfigured proxy/CDN, an attacker-controlled Host header
// would let them poison password-reset and invite links pointing at their
// own domain. NEXT_PUBLIC_SITE_URL is a trusted, server-controlled value —
// the only acceptable source in production.
export function getSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") {
    // Local dev convenience only — never used in production.
    return "http://localhost:3000";
  }
  throw new Error(
    "NEXT_PUBLIC_SITE_URL must be set in production (required for invite/reset email links).",
  );
}
