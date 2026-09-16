-- Dedup flag for understaffed-shift alert emails. Written only by the
-- service-role cron route (app/api/cron/understaffed-alerts/route.ts).
-- Set once per shift when tomorrow's headcount check fires, so a shift
-- short-handed at alert time isn't re-notified every day until it fills.
alter table public.shifts
  add column if not exists understaffed_alert_sent_at timestamptz;

-- Backfill the new email-setting toggle for companies created before this
-- key existed (default: on — same as the other email toggles).
update public.companies
  set email_settings = email_settings || '{"understaffedShift": true}'
  where email_settings is null or not email_settings ? 'understaffedShift';