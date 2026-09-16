-- Compliance violation update policy: widen to include HR role.
-- HR can acknowledge/resolve violations but cannot dismiss (manager/admin only).

drop policy "compliance_violations_update" on compliance_violations;
create policy "compliance_violations_update" on compliance_violations for update
  using (
    company_id = current_company_id()
    and current_app_role()::text in ('manager', 'company_admin', 'hr')
  )
  with check (
    company_id = current_company_id()
    and (
      current_app_role()::text in ('manager', 'company_admin')
      or (current_app_role()::text = 'hr' and status != 'dismissed')
    )
  );
