CREATE TABLE leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  key text NOT NULL, -- slug stored on leave_requests.type, e.g. "vacation"
  tracks_balance boolean NOT NULL DEFAULT false,
  default_balance_days numeric(6,1) NOT NULL DEFAULT 0, -- informational only
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);

CREATE INDEX idx_leave_types_company ON leave_types(company_id);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_types_select" ON leave_types
  FOR SELECT USING (company_id = current_company_id() OR is_super_admin());

CREATE POLICY "leave_types_insert" ON leave_types
  FOR INSERT WITH CHECK (
    company_id = current_company_id()
    AND current_app_role() = 'company_admin'
  );

CREATE POLICY "leave_types_update" ON leave_types
  FOR UPDATE USING (
    company_id = current_company_id()
    AND current_app_role() = 'company_admin'
  );

CREATE POLICY "leave_types_delete" ON leave_types
  FOR DELETE USING (
    company_id = current_company_id()
    AND current_app_role() = 'company_admin'
  );

CREATE TRIGGER set_company_id_insert
  BEFORE INSERT ON leave_types
  FOR EACH ROW EXECUTE FUNCTION set_company_id();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed function + trigger: every new company gets the 5 defaults that used
-- to be hardcoded in the app, preserving current behavior (only vacation
-- tracks a balance) without any app-code changes to the signup flow.
CREATE FUNCTION public.seed_default_leave_types() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO leave_types (company_id, name, key, tracks_balance, sort_order) VALUES
    (NEW.id, 'Vacation', 'vacation', true, 0),
    (NEW.id, 'Sick', 'sick', false, 1),
    (NEW.id, 'Personal', 'personal', false, 2),
    (NEW.id, 'Bereavement', 'bereavement', false, 3),
    (NEW.id, 'Other', 'other', false, 4);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_default_leave_types
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_leave_types();

-- Backfill: give every existing company the same 5 defaults so current
-- leave_requests.type values ("vacation", "sick", ...) keep resolving.
INSERT INTO leave_types (company_id, name, key, tracks_balance, sort_order)
SELECT c.id, v.name, v.key, v.tracks_balance, v.sort_order
FROM companies c
CROSS JOIN (VALUES
  ('Vacation', 'vacation', true, 0),
  ('Sick', 'sick', false, 1),
  ('Personal', 'personal', false, 2),
  ('Bereavement', 'bereavement', false, 3),
  ('Other', 'other', false, 4)
) AS v(name, key, tracks_balance, sort_order)
ON CONFLICT (company_id, key) DO NOTHING;
