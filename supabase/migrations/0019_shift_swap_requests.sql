-- shift_swap_requests: employee-initiated shift swap, two flavors —
-- giveaway (offer a shift, no shift wanted back) or trade (offer +
-- request a specific shift back). Flow: initiator proposes ->
-- target accepts/declines -> manager/company_admin approves/denies.
-- Backfilled from prod schema (table existed live, no migration on
-- record) — keep in sync with actual DB, this file is documentation
-- of what already exists, not a fresh creation on prod.

create table shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  swap_type text not null check (swap_type in ('giveaway', 'trade')),
  offered_shift_id uuid not null references shifts(id) on delete cascade,
  requested_shift_id uuid references shifts(id) on delete cascade,
  initiator_person_id uuid not null references people(id) on delete cascade,
  target_person_id uuid not null references people(id) on delete cascade,
  status text not null default 'pending_target' check (
    status in ('pending_target', 'accepted_pending_manager', 'approved', 'denied', 'declined_by_target', 'cancelled')
  ),
  initiator_comment text,
  target_responded_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  reviewer_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_swap_initiator_not_target check (initiator_person_id <> target_person_id),
  constraint shift_swap_requested_shift_matches_type check (
    (swap_type = 'trade' and requested_shift_id is not null)
    or (swap_type = 'giveaway' and requested_shift_id is null)
  )
);

create index idx_shift_swap_requests_company on shift_swap_requests(company_id);
create index idx_shift_swap_requests_initiator on shift_swap_requests(initiator_person_id);
create index idx_shift_swap_requests_target on shift_swap_requests(target_person_id);
create index idx_shift_swap_requests_offered_shift on shift_swap_requests(offered_shift_id);
create index idx_shift_swap_requests_requested_shift on shift_swap_requests(requested_shift_id);
create index idx_shift_swap_requests_status on shift_swap_requests(status);

create trigger set_updated_at before update on shift_swap_requests
  for each row execute function public.set_updated_at();

create trigger set_company_id before insert on shift_swap_requests
  for each row execute function public.set_company_id();

alter table shift_swap_requests enable row level security;

-- initiator can create swap on own behalf, company-scoped
create policy "shift_swap_requests_insert" on shift_swap_requests for insert
  with check (
    company_id = current_company_id()
    and initiator_person_id = current_person_id()
  );

-- readable by any company member (target needs to see incoming swaps),
-- super_admin cross-company
create policy "shift_swap_requests_select" on shift_swap_requests for select
  using (
    company_id = current_company_id()
    or is_super_admin()
  );

-- target/initiator can update only while pending_target (accept/decline/cancel);
-- manager/company_admin can update any row in their company (final approve/deny)
create policy "shift_swap_requests_update" on shift_swap_requests for update
  using (
    company_id = current_company_id()
    and (
      ((target_person_id = current_person_id() or initiator_person_id = current_person_id()) and status = 'pending_target')
      or current_app_role() in ('manager', 'company_admin')
    )
  )
  with check (
    company_id = current_company_id()
    and (
      target_person_id = current_person_id()
      or initiator_person_id = current_person_id()
      or current_app_role() in ('manager', 'company_admin')
    )
  );
