CREATE TABLE person_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  balance_days numeric(6,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, leave_type_id)
);

CREATE INDEX idx_person_leave_balances_company ON person_leave_balances(company_id);
CREATE INDEX idx_person_leave_balances_person ON person_leave_balances(person_id);

ALTER TABLE person_leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_leave_balances_select" ON person_leave_balances
  FOR SELECT USING (company_id = current_company_id() OR is_super_admin());

-- Writes restricted to company_admin/manager (same roles that can already
-- edit a person's row) — mirrors the `people` UPDATE policy.
CREATE POLICY "person_leave_balances_insert" ON person_leave_balances
  FOR INSERT WITH CHECK (
    company_id = current_company_id()
    AND current_app_role() IN ('company_admin', 'manager')
  );

CREATE POLICY "person_leave_balances_update" ON person_leave_balances
  FOR UPDATE USING (
    company_id = current_company_id()
    AND current_app_role() IN ('company_admin', 'manager')
  );

CREATE TRIGGER set_company_id_insert
  BEFORE INSERT ON person_leave_balances
  FOR EACH ROW EXECUTE FUNCTION set_company_id();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON person_leave_balances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
