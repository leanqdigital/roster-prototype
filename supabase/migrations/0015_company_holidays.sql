CREATE TABLE company_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_holidays_select" ON company_holidays
  FOR SELECT USING (company_id = current_company_id() OR is_super_admin());

CREATE POLICY "company_holidays_insert" ON company_holidays
  FOR INSERT WITH CHECK (
    company_id = current_company_id()
    AND current_app_role() IN ('company_admin', 'manager')
  );

CREATE POLICY "company_holidays_update" ON company_holidays
  FOR UPDATE USING (
    company_id = current_company_id()
    AND current_app_role() IN ('company_admin', 'manager')
  );

CREATE POLICY "company_holidays_delete" ON company_holidays
  FOR DELETE USING (
    company_id = current_company_id()
    AND current_app_role() IN ('company_admin', 'manager')
  );

CREATE TRIGGER set_company_id_insert
  BEFORE INSERT ON company_holidays
  FOR EACH ROW EXECUTE FUNCTION set_company_id();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON company_holidays
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_company_holidays_company ON company_holidays(company_id);
CREATE INDEX idx_company_holidays_dates ON company_holidays(start_date, end_date);
