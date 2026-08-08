
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employees_name_key ON public.employees (lower(btrim(first_name)), lower(btrim(last_name)));

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  min_people integer NOT NULL DEFAULT 1 CHECK (min_people >= 0),
  max_people integer NOT NULL DEFAULT 1 CHECK (max_people >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_people >= min_people)
);
CREATE INDEX shifts_date_idx ON public.shifts (shift_date);

CREATE TABLE public.shift_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_actual_ts timestamptz,
  end_actual_ts timestamptz,
  note text,
  note_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, employee_id)
);
CREATE INDEX shift_signups_employee_idx ON public.shift_signups (employee_id);

CREATE TABLE public.conflict_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id_a uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_id_b uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (employee_id_a <> employee_id_b)
);
CREATE UNIQUE INDEX conflict_rules_pair_key ON public.conflict_rules (least(employee_id_a::text, employee_id_b::text), greatest(employee_id_a::text, employee_id_b::text));

CREATE TABLE public.shift_conflict_rules (
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.conflict_rules(id) ON DELETE CASCADE,
  PRIMARY KEY (shift_id, rule_id)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employee_projects_emp_idx ON public.employee_projects (employee_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees, public.shifts, public.shift_signups, public.conflict_rules, public.shift_conflict_rules, public.projects, public.employee_projects TO authenticated;
GRANT ALL ON public.employees, public.shifts, public.shift_signups, public.conflict_rules, public.shift_conflict_rules, public.projects, public.employee_projects TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage employees" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage shifts" ON public.shifts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage signups" ON public.shift_signups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage rules" ON public.conflict_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage shift rules" ON public.shift_conflict_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage projects" ON public.projects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage employee projects" ON public.employee_projects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.signup_for_shift(_shift_id uuid, _employee_id uuid, _override boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.shifts%ROWTYPE;
  taken integer;
  conflict_count integer;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.shift_signups WHERE shift_id = _shift_id AND employee_id = _employee_id) THEN
    RETURN 'already';
  END IF;

  IF NOT _override THEN
    IF (s.shift_date + s.start_time) AT TIME ZONE 'Asia/Jerusalem' <= now() THEN
      RETURN 'past';
    END IF;

    SELECT count(*) INTO conflict_count
    FROM public.shift_conflict_rules scr
    JOIN public.conflict_rules cr ON cr.id = scr.rule_id
    JOIN public.shift_signups ss ON ss.shift_id = _shift_id
    WHERE scr.shift_id = _shift_id
      AND ((cr.employee_id_a = _employee_id AND cr.employee_id_b = ss.employee_id)
        OR (cr.employee_id_b = _employee_id AND cr.employee_id_a = ss.employee_id));
    IF conflict_count > 0 THEN RETURN 'conflict'; END IF;

    SELECT count(*) INTO taken FROM public.shift_signups WHERE shift_id = _shift_id;
    IF taken >= s.max_people THEN RETURN 'full'; END IF;
  END IF;

  INSERT INTO public.shift_signups (shift_id, employee_id) VALUES (_shift_id, _employee_id);
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.signup_for_shift(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signup_for_shift(uuid, uuid, boolean) TO service_role;
