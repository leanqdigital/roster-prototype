-- Move shift-reminder scheduling from Vercel Cron (Hobby plan caps cron to
-- once/day) to Supabase pg_cron, which supports minute-level schedules on
-- the free tier. pg_cron fires inside Postgres and calls out to the existing
-- /api/cron/shift-reminders route via pg_net (async HTTP), so the route
-- itself (auth, query logic, email sending) is unchanged.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Secrets (app URL + CRON_SECRET) are NOT hardcoded here — never commit
-- secrets in a migration file. Set them once via the SQL editor (service
-- role only) before this job can run:
--
--   select vault.create_secret('https://your-app.vercel.app', 'app_base_url');
--   select vault.create_secret('your-cron-secret-value', 'cron_secret');
--
-- Vault is available on Supabase free tier. If you'd rather not use Vault,
-- swap the two `select decrypted_secret from vault.decrypted_secrets ...`
-- lookups below for `current_setting('app.settings.xxx')` and set those via
-- `alter database postgres set app.settings.xxx = '...'` instead.

create or replace function public.trigger_shift_reminders()
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
    raise notice 'shift reminders: app_base_url / cron_secret not set in vault, skipping';
    return;
  end if;

  perform net.http_get(
    url := v_base_url || '/api/cron/shift-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret)
  );
end;
$$;

select cron.schedule(
  'shift-reminders-every-minute',
  '* * * * *',
  $$ select public.trigger_shift_reminders(); $$
);

-- To remove: select cron.unschedule('shift-reminders-every-minute');
