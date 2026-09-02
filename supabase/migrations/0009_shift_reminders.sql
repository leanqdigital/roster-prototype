-- Dedup flag for shift reminder emails. Written only by the service-role
-- cron route (app/api/cron/shift-reminders/route.ts).
alter table public.shifts
  add column if not exists reminder_sent_at timestamptz;
