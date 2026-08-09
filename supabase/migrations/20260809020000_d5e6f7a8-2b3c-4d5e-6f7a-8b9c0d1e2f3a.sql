-- Admin-only variant of signup_for_shift that never blocks on the shift
-- being in the past — the admin explicitly navigating to a past date and
-- assigning someone there is the whole point (recording who actually
-- worked a shift after the fact), not a mistake to guard against.
-- Conflict/capacity checks still apply unless the admin explicitly
-- overrides them, same as before.
CREATE OR REPLACE FUNCTION public.admin_signup_for_shift(
  _shift_id uuid, _employee_id uuid, _override boolean DEFAULT false
)
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
GRANT EXECUTE ON FUNCTION public.admin_signup_for_shift(uuid, uuid, boolean) TO authenticated;
