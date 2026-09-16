-- shift_adjustment_requests: employee requests to start a shift later
-- (late_in) or leave earlier (early_out) than scheduled, on a given day.
-- Standalone by design — not linked to a specific shift row. Manager /
-- company_admin review like leave_requests.

create table shift_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('early_out', 'late_in')),
  date date not null,
  requested_time time not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  reviewer_comment text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_shift_adjustment_requests_company on shift_adjustment_requests(company_id);
create index idx_shift_adjustment_requests_person on shift_adjustment_requests(person_id);

create trigger set_updated_at before update on shift_adjustment_requests
  for each row execute function public.set_updated_at();

create trigger set_company_id before insert on shift_adjustment_requests
  for each row execute function public.set_company_id();

alter table shift_adjustment_requests enable row level security;

-- Same shape as leave_requests: self or manager/company_admin read;
-- self-only insert; self may update own pending row (cancel), manager /
-- company_admin may update any row in their company (approve/deny).
create policy "shift_adjustment_requests_select" on shift_adjustment_requests for select
  using (
    person_id = current_person_id()
    or (company_id = current_company_id() and current_app_role() in ('manager', 'company_admin'))
    or is_super_admin()
  );

create policy "shift_adjustment_requests_insert" on shift_adjustment_requests for insert
  with check (
    company_id = current_company_id()
    and person_id = current_person_id()
  );

create policy "shift_adjustment_requests_update" on shift_adjustment_requests for update
  using (
    company_id = current_company_id()
    and (
      (person_id = current_person_id() and status = 'pending')
      or current_app_role() in ('manager', 'company_admin')
    )
  )
  with check (
    company_id = current_company_id()
    and (
      person_id = current_person_id()
      or current_app_role() in ('manager', 'company_admin')
    )
  );