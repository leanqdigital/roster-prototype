-- HR read-only role.
--
-- hr = company member with read-only visibility across the whole company.
-- No person row is ever created (profiles.person_id stays null) — HR is
-- not schedulable, cannot clock in/out, request leave, pick up shifts,
-- or swap. Writes need no policy changes: every insert/update policy
-- checks current_app_role() in ('manager','company_admin') or
-- person_id = current_person_id() (null for HR), so HR is excluded
-- automatically. Reads default to company-wide for most tables; the
-- four request/activity tables below are self-or-manager scoped, so HR
-- is added to their select policies only.

alter type app_role add value 'hr';

-- handle_new_user: accept-invite path for hr. Same trust model as the
-- employee/manager branch (raw meta data is server-minted via
-- admin.generateLink in lib/supabase/actions.ts) — no person lookup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := new.raw_user_meta_data;
  intended_role text := meta->>'intended_role';
  company_name text := meta->>'company_name';
  meta_company_id uuid := nullif(meta->>'company_id', '')::uuid;
  meta_person_id uuid := nullif(meta->>'person_id', '')::uuid;
  display_name text := coalesce(meta->>'name', split_part(new.email, '@', 1));
  new_company_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 0;
  person_name text;
begin
  if intended_role = 'super_admin' then
    insert into public.profiles (id, company_id, person_id, role, email, name)
    values (new.id, null, null, 'super_admin', new.email, display_name);

  elsif intended_role = 'company_admin' then
    base_slug := lower(regexp_replace(trim(coalesce(company_name, display_name)), '[^a-z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
      base_slug := 'company';
    end if;
    final_slug := base_slug;
    while exists(select 1 from public.companies where slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    end loop;

    insert into public.companies (name, slug)
    values (coalesce(company_name, display_name), final_slug)
    returning id into new_company_id;

    insert into public.profiles (id, company_id, person_id, role, email, name)
    values (new.id, new_company_id, null, 'company_admin', new.email, display_name);

  elsif intended_role = 'hr' and meta_company_id is not null then
    insert into public.profiles (id, company_id, person_id, role, email, name)
    values (new.id, meta_company_id, null, 'hr', new.email, display_name);

  elsif intended_role in ('employee', 'manager')
    and meta_company_id is not null
    and meta_person_id is not null then

    select name into person_name from public.people where id = meta_person_id;

    insert into public.profiles (id, company_id, person_id, role, email, name)
    values (
      new.id,
      meta_company_id,
      meta_person_id,
      intended_role::app_role,
      new.email,
      coalesce(person_name, display_name)
    );

    update public.people
      set status = 'active', updated_at = now()
      where id = meta_person_id and status = 'invited';

  end if;

  return new;
end;
$$;

-- activity_entries: HR reads company-wide (was self-or-manager).
-- current_app_role()::text compare: the enum value 'hr' was added by this
-- same migration, so an enum-typed literal would trip 55P04 (unsafe use of
-- new enum value) inside this transaction.
drop policy "activity_entries_select" on activity_entries;
create policy "activity_entries_select" on activity_entries for select
  using (
    person_id = current_person_id()
    or (company_id = current_company_id() and current_app_role()::text in ('manager', 'company_admin', 'hr'))
    or is_super_admin()
  );

-- leave_requests: HR reads company-wide (was self-or-manager).
drop policy "leave_requests_select" on leave_requests;
create policy "leave_requests_select" on leave_requests for select
  using (
    person_id = current_person_id()
    or (company_id = current_company_id() and current_app_role()::text in ('manager', 'company_admin', 'hr'))
    or is_super_admin()
  );

-- compliance_violations: HR reads company-wide — violations are HR's domain.
drop policy "compliance_violations_select" on compliance_violations;
create policy "compliance_violations_select" on compliance_violations for select
  using (
    person_id = current_person_id()
    or (company_id = current_company_id() and current_app_role()::text in ('manager', 'company_admin', 'hr'))
    or is_super_admin()
  );

-- shift_adjustment_requests: HR reads company-wide (was self-or-manager).
drop policy "shift_adjustment_requests_select" on shift_adjustment_requests;
create policy "shift_adjustment_requests_select" on shift_adjustment_requests for select
  using (
    person_id = current_person_id()
    or (company_id = current_company_id() and current_app_role()::text in ('manager', 'company_admin', 'hr'))
    or is_super_admin()
  );