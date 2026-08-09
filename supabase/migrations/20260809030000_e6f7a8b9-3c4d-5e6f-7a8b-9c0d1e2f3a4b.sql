-- Employees may no longer cancel their own signup within 12 hours of the
-- shift's scheduled start, even if they haven't pressed "Start Shift" yet.
CREATE OR REPLACE FUNCTION public.employee_cancel_signup(_secret text, _employee_id uuid, _shift_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row public.shift_signups%ROWTYPE;
  s public.shifts%ROWTYPE;
BEGIN
  PERFORM public._require_secret(_secret);

  SELECT * INTO row FROM public.shift_signups WHERE shift_id = _shift_id AND employee_id = _employee_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF row.start_actual_ts IS NOT NULL THEN RETURN 'started'; END IF;

  SELECT * INTO s FROM public.shifts WHERE id = _shift_id;
  IF (s.shift_date + s.start_time) AT TIME ZONE 'Asia/Jerusalem' - now() <= interval '12 hours' THEN
    RETURN 'too_close';
  END IF;

  DELETE FROM public.shift_signups WHERE id = row.id;
  RETURN 'ok';
END;
$$;
