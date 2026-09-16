-- Dedup flag for forgot-clockout alert emails. Written only by the
-- service-role cron route (app/api/cron/forgot-clockout/route.ts), once
-- per open clock-in session after the reminder fires.
alter table public.clock_entries
  add column if not exists forgot_clockout_notified_at timestamptz;

-- Backfill the email-setting toggle for companies created before this
-- key existed (default: on — same as the other email toggles).
update public.companies
  set email_settings = email_settings || '{"forgotClockOut": true}'
  where email_settings is null or not email_settings ? 'forgotClockOut';