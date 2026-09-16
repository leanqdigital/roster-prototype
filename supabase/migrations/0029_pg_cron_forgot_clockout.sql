-- Forgot-clock-out alert: pg_cron fires every 15 minutes and calls the
-- /api/cron/forgot-clockout route via pg_net, same pattern as the
-- every-minute shift-reminder job (0010) and daily understaffed job (0027).
-- The route only acts on clock-ins older than the shift end + 1hr grace,
-- so a 15-minute cadence is enough.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Secrets come from Vault (set once via SQL editor, never committed):
--
--   select vault.create_secret('https://your-app.vercel.app', 'app_base_url');
--   select vault.create_secret('your-cron-secret-value', 'cron_secret');

create or replace function public.trigger_forgot_clockout_alerts()
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
    raise notice 'forgot clockout: app_base_url / cron_secret not set in vault, skipping';
    return;
  end if;

  perform net.http_get(
    url := v_base_url || '/api/cron/forgot-clockout',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret)
  );
end;
$$;

select cron.schedule(
  'forgot-clockout-every-15-min',
  '*/15 * * * *',
  $$ select public.trigger_forgot_clockout_alerts(); $$
);

-- To remove: select cron.unschedule('forgot-clockout-every-15-min');