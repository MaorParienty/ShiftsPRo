-- Manual hours adjustments (admin-only), layered on top of the
-- system-calculated total from actual shift start/end timestamps. Each
-- adjustment is its own auditable record with a reason, rather than
-- overwriting the computed total directly.
CREATE TABLE public.hours_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  hours numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hours_adjustments_emp_month_idx ON public.hours_adjustments (employee_id, year, month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hours_adjustments TO authenticated;
GRANT ALL ON public.hours_adjustments TO service_role;

ALTER TABLE public.hours_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage hours adjustments" ON public.hours_adjustments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
