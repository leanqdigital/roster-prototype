-- Per-person time overrides on shift_assignments, populated when an approved
-- shift adjustment request (early_out / late_in) is applied to that person's
-- assignment. The shared shift row stays untouched — other assignees keep the
-- original times. Null = assignment follows the shift's scheduled time.
--
-- Call sites: `adjustment.approved` writes the matching boundary (early_out →
-- adjusted_end_time, late_in → adjusted_start_time); `adjustment.reverted`
-- clears both.

alter table shift_assignments
  add column adjusted_start_time time,
  add column adjusted_end_time time;