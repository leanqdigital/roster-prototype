-- 0026 made current_company_id() return NULL for a deactivated employee/
-- manager. That also blocks their own row in people_select (company_id =
-- current_company_id()), so the people(status) join in lib/auth.tsx and
-- the requireRole() lookup in lib/supabase/dal.ts both silently return
-- nothing instead of 'inactive' — the deactivation goes undetected client-
-- and server-side. current_person_id() is unaffected by status (reads
-- profiles directly), so use it for a narrow self-read policy.
create policy "people_select_self" on people for select
  using (id = current_person_id());
