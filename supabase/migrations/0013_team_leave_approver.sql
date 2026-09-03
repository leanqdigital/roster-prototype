-- Per-team override for who handles leave requests (falls back to the
-- team manager, then company admins).
alter table teams add column leave_approver_id uuid references people(id) on delete set null;
