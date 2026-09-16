-- Daily understaffed-shift alert: pg_cron fires once a day and calls the
-- /api/cron/understaffed-alerts route via pg_net, same pattern as the
-- every-minute shift-reminder job (0010_pg_cron_shift_reminders.sql).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Secrets come from Vault (set once via SQL editor, never committed):
--
--   select vault.create_secret('https://your-app.vercel.app', 'app_base_url');
--   select vault.create_secret('your-cron-secret-value', 'cron_secret');

create or replace function public.trigger_understaffed_alerts()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_base_url text;
  v_secret text;
begin
  select decrypted_secret into v_base_url
  from vault.decrypted_secrets where name = 'app_base_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'cron_secret';

  if v_base_url is null or v_secret is null then
    raise notice 'understaffed alerts: app_base_url / cron_secret not set in vault, skipping';
    return;
  end if;

  perform net.http_get(
    url := v_base_url || '/api/cron/understaffed-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret)
  );
end;
$$;

-- Daily at 09:00 UTC. The route only acts on shifts dated tomorrow in each
-- company's timezone, so a single run per day lands one-day-ahead alerts.
select cron.schedule(
  'understaffed-alerts-daily',
  '0 9 * * *',
  $$ select public.trigger_understaffed_alerts(); $$
);

-- To remove: select cron.unschedule('understaffed-alerts-daily');