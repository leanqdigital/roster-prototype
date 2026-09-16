-- handle_new_user() hardening: block self-registration as elevated roles,
-- validate invites server-side.
--
-- Threat model: anonymous caller hits Supabase REST signup with arbitrary
-- raw_user_meta_data claiming manager/hr/super_admin for a victim company.
--
-- Defenses added:
--   super_admin  → reject entirely (only via scripts/seed-super-admin.mjs)
--   company_admin → unchanged (legitimate self-signup; creates new company)
--   employee/manager → email-match: people.email must match signup email
--                      AND people.company_id must match claimed company_id
--   hr → pending_invites row must exist (server-minted by inviteEmployee)

-- Pending invites table: minted server-side by inviteEmployee(), consumed
-- by the trigger on auth.users INSERT.
create table pending_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email     text not null,
  intended_role app_role not null
    check (intended_role in ('employee', 'manager', 'hr')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index pending_invites_email_company
  on pending_invites (lower(email), company_id);

-- RLS: service-role only (trigger runs as SECURITY DEFINER service_role;
-- inviteEmployee uses the admin client which also bypasses RLS).
alter table pending_invites enable row level security;
create policy "pending_invites_service_role" on pending_invites
  for all using (auth.role() = 'service_role');

-- Hardened handle_new_user
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta          jsonb := new.raw_user_meta_data;
  intended_role text    := meta->>'intended_role';
  company_name  text    := meta->>'company_name';
  meta_company_id uuid  := nullif(meta->>'company_id', '')::uuid;
  meta_person_id  uuid  := nullif(meta->>'person_id', '')::uuid;
  display_name   text   := coalesce(meta->>'name', split_part(new.email, '@', 1));
  new_company_id uuid;
  base_slug      text;
  final_slug     text;
  suffix         int    := 0;
  person_name    text;
  invite_row     record;
begin
  if intended_role = 'super_admin' then
    -- super_admin must be created via scripts/seed-super-admin.mjs which
    -- inserts the profile row directly. Block self-registration entirely.
    raise exception 'Super admin accounts cannot be created via sign-up.';

  elsif intended_role = 'company_admin' then
    -- Legitimate self-signup: creates a new company + admin profile.
    base_slug := lower(regexp_replace(
      trim(coalesce(company_name, display_name)),
      '[^a-z0-9]+', '-', 'g'
    ));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then base_slug := 'company'; end if;
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

  elsif intended_role in ('employee', 'manager') then
    -- Email-match: the people row must exist with matching email + company.
    if meta_company_id is null or meta_person_id is null then
      raise exception 'Invalid invite metadata.';
    end if;

    select name into person_name
    from public.people
    where id = meta_person_id
      and company_id = meta_company_id
      and lower(email) = lower(new.email);

    if person_name is null then
      raise exception 'Invite not found for this email.';
    end if;

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

  elsif intended_role = 'hr' then
    -- Validate against pending_invites table (server-minted by inviteEmployee).
    if meta_company_id is null then
      raise exception 'Invalid HR invite metadata.';
    end if;

    select * into invite_row
    from public.pending_invites
    where lower(email) = lower(new.email)
      and company_id = meta_company_id
      and intended_role = 'hr'
    limit 1;

    if invite_row is null then
      raise exception 'HR invite not found for this email.';
    end if;

    insert into public.profiles (id, company_id, person_id, role, email, name)
    values (new.id, meta_company_id, null, 'hr', new.email, display_name);

    delete from public.pending_invites where id = invite_row.id;
  end if;

  return new;
end;
$$;
