<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roster prototype

Shift-scheduling app: Next.js 16 App Router + React 19, Tailwind v4, Supabase (Postgres + Auth + RLS), nodemailer, rrule. npm only; no lockfile for other package managers.

## Commands

- `npm run dev` / `build` / `lint` (eslint only). No test suite exists — verify with `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- Requires `.env` (copy `.env.example`): Supabase URL/anon key, `SUPABASE_SERVICE_ROLE_KEY`, `MAIL_*`, `CRON_SECRET`.
- `npm run seed:super-admin <email> <password>` hardcodes `--env-file=.env.local` — it fails if you only have `.env`. Symlink or copy `.env` to `.env.local` first.
- Local Supabase: `supabase start` (config in `supabase/config.toml`). Note `config.toml` enables seeding from `./seed.sql`, but that file doesn't exist — `db reset` warns/skips it.

## Next 16 gotchas

- Middleware is now `proxy.ts` at repo root exporting `proxy()`. Do NOT create `middleware.ts` — that convention is gone.

## Auth model (three layers — don't collapse them)

1. `proxy.ts` + `lib/supabase/proxy.ts`: optimistic cookie-presence gate + session refresh. NOT a security boundary.
2. Client: `AuthGuard` in each section layout (`app/(company)`, `app/manager`, `app/employee`, `app/admin`) gates rendering via `useAuth`.
3. Server (real enforcement): Postgres RLS + `requireRole()` from `lib/supabase/dal.ts` (uses `auth.getUser()`, not `getSession()`). Any new Server Action must call `requireRole([...])` before doing work.
- `lib/supabase/admin.ts` `createAdminClient()` bypasses RLS (service role). Only for invite flow, cron route, and explicit cross-company ops — and verify the caller's role with the regular client first. `server-only` enforced.
- Roles: `super_admin | company_admin | manager | employee` (`lib/roles.ts`). `homeForRole()` maps role → landing route. `app/(company)` is the company_admin workspace with unprefixed URLs (`/dashboard`, `/people`, …).

## Data layer

- `lib/company-data/` is the client-side store for company data: `context.tsx` (`CompanyProvider`, useReducer, optimistic updates), `queries.ts` (browser Supabase client; RLS scopes every query to the user's company — no explicit `company_id` filters), `mappers.ts` (snake_case rows ↔ camelCase types, column lists live here), `business.ts` (pure logic), `reducer.ts`. Adding an entity means touching mappers + queries + reducer + context.
- Shifts are stored as wall-clock `date` + `start_time` strings with a per-person `timezone`; convert with `lib/timezone.ts` `zonedTimeToUtc` (single-pass, ~10-min DST tolerance — don't "fix" without understanding).
- `lib/data.ts` holds shared types (Company, AuditEntry, `COMPANY_COLORS`) used by both admin (`lib/store.tsx`) and company UIs.

## Cron / emails

- Shift reminders: Supabase `pg_cron` (migration `0010`) → pg_net → `GET /api/cron/shift-reminders` (bearer `CRON_SECRET`). The route comment mentioning `vercel.json` is stale — no such file; `proxy.ts` exempts `/api/cron` from the cookie gate.
- Migration `0010` requires Vault secrets `app_base_url` and `cron_secret` (set via SQL editor, never hardcoded in migrations).
- Emails via nodemailer (`lib/email.ts`), config from `MAIL_*` env vars.
