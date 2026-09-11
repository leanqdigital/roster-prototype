-- 0016 shipped reviewed_by as a uuid people FK, but every consumer passes a
-- free-text reviewer display name (e.g. "Company Admin", a manager's name) —
-- never a person id. company_admin accounts have no people row at all, so a
-- people FK can never hold their name. Same issue migration 0007 fixed for
-- leave_requests / shift_assignments. Guards keep this a no-op on fresh
-- installs where 0016 now creates the column as text directly.

alter table shift_adjustment_requests
  drop constraint if exists shift_adjustment_requests_reviewed_by_fkey;

alter table shift_adjustment_requests
  alter column reviewed_by type text using reviewed_by::text;