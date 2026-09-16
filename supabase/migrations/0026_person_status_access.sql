-- Fail current_company_id() closed for a deactivated employee/manager.
-- Every RLS policy scoped by company_id = current_company_id() (people,
-- shifts, clock entries, etc.) then denies reads/writes for that user in
-- one shot. person_id is null for company_admin/super_admin/hr — unaffected.
-- profiles_select still lets the inactive user read their own profile row
-- directly (id = auth.uid()), so client code can detect personStatus and
-- sign them out gracefully instead of every query silently failing.

create or replace function public.current_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
    and (
      p.person_id is null
      or exists (
        select 1 from public.people pe
        where pe.id = p.person_id and pe.status <> 'inactive'
      )
    )
$$;
