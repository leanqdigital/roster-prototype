-- Company-wide read for clock/break entries: employees need to see who clocked
-- in on a shift (employee schedule shift detail). Writes stay self-or-manager.

drop policy "clock_entries_select" on clock_entries;
create policy "clock_entries_select" on clock_entries for select
  using (
    company_id = current_company_id()
    or is_super_admin()
  );

drop policy "break_entries_select" on break_entries;
create policy "break_entries_select" on break_entries for select
  using (
    company_id = current_company_id()
    or is_super_admin()
  );
