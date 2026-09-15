-- email_settings existed live before migration history caught up (same
-- backfill situation as shift_swap_requests, see 0019) — add it here so
-- fresh envs match prod. email_templates is new: per-type custom
-- subject/html override, keyed same as EmailSettings boolean keys.
alter table companies
  add column if not exists email_settings jsonb not null default '{"shiftAssigned":true,"leaveReviewed":true,"swapProposed":true,"swapResponded":true,"swapReviewed":true,"shiftAdjustmentReviewed":true,"shiftReminder":true,"shiftReminderMinutesBefore":10,"forgotClockOut":true}',
  add column if not exists email_templates jsonb not null default '{}';
