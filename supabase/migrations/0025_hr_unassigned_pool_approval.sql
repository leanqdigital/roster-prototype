-- HR fallback approval (unassigned pool).
--
-- Employees with no manager chain — no team, or teams with neither
-- manager_id nor leave_approver_id — have nobody to review their
-- leave/adjustment/swap requests. HR acts as the fallback reviewer.
-- Managers keep sole authority over their own teams (guard on team
-- membership), so HR can never override a manager.

-- leave_requests: HR may set pending -> approved/denied for unassigned people.
create policy "leave_requests_hr_fallback" on leave_requests for update
  using (
    company_id = current_company_id()
    and current_app_role()::text = 'hr'
    and status = 'pending'
    and not exists (
      select 1
      from people p
      join teams t on t.id = any(p.team_ids)
      where p.id = leave_requests.person_id
        and (t.manager_id is not null or t.leave_approver_id is not null)
    )
  )
  with check (
    company_id = current_company_id()
    and current_app_role()::text = 'hr'
    and status in ('approved', 'denied')
  );

-- shift_adjustment_requests: same fallback.
create policy "shift_adjustment_requests_hr_fallback" on shift_adjustment_requests for update
  using (
    company_id = current_company_id()
    and current_app_role()::text = 'hr'
    and status = 'pending'
    and not exists (
      select 1
      from people p
      join teams t on t.id = any(p.team_ids)
      where p.id = shift_adjustment_requests.person_id
        and (t.manager_id is not null or t.leave_approver_id is not null)
    )
  )
  with check (
    company_id = current_company_id()
    and current_app_role()::text = 'hr'
    and status in ('approved', 'denied')
  );

-- shift_swap_requests: HR may give the final go/no-go for swaps where BOTH
-- parties are unassigned (if either side has a manager, that manager owns it).
create policy "shift_swap_requests_hr_fallback" on shift_swap_requests for update
  using (
    company_id = current_company_id()
    and current_app_role()::text = 'hr'
    and status = 'accepted_pending_manager'
    and not exists (
      select 1
      from people p
      join teams t on t.id = any(p.team_ids)
      where (p.id = shift_swap_requests.initiator_person_id
             or p.id = shift_swap_requests.target_person_id)
        and (t.manager_id is not null or t.leave_approver_id is not null)
    )
  )
  with check (
    company_id = current_company_id()
    and current_app_role()::text = 'hr'
    and status in ('approved', 'denied')
  );