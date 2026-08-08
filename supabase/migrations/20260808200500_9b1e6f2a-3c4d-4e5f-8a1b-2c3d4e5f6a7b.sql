-- Remove the app's dependency on the Supabase service-role key entirely.
--
-- Admin operations already work fine through the admin's own authenticated
-- Supabase session plus the existing "admins manage X" RLS policies — no
-- change needed there beyond a couple of new EXECUTE grants below.
--
-- Employees authenticate via a custom name+password flow (not Supabase Auth,
-- since per-employee accounts would require email confirmation with no real
-- inbox to confirm from). Their server-side operations run through a small
-- set of SECURITY DEFINER functions gated by a shared secret that only the
-- app server knows. The secret's VALUE is intentionally not part of this
-- migration — it's inserted separately via the SQL editor so it never ends
-- up in git history.

CREATE TABLE IF NOT EXISTS public._app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public._app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._app_secrets FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._require_secret(_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _secret IS NULL OR _secret <> (SELECT value FROM public._app_secrets WHERE key = 'rpc_secret') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

/* ------------------------------ admin bootstrap ----------------------------- */

CREATE OR REPLACE FUNCTION public.admin_bootstrap_needed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.admin_bootstrap_needed() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin');
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;

-- Admins call this directly (via their own authenticated session) to add/override signups.
GRANT EXECUTE ON FUNCTION public.signup_for_shift(uuid, uuid, boolean) TO authenticated;

/* ------------------------------ employee auth ------------------------------- */

CREATE OR REPLACE FUNCTION public.employee_register(
  _secret text, _first_name text, _last_name text, _phone text, _password_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_id uuid;
  created public.employees%ROWTYPE;
BEGIN
  PERFORM public._require_secret(_secret);

  SELECT id INTO existing_id FROM public.employees
    WHERE lower(btrim(first_name)) = lower(btrim(_first_name))
      AND lower(btrim(last_name)) = lower(btrim(_last_name))
      AND phone = _phone;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'exists');
  END IF;

  INSERT INTO public.employees (first_name, last_name, phone, password_hash)
  VALUES (btrim(_first_name), btrim(_last_name), _phone, _password_hash)
  RETURNING * INTO created;

  RETURN jsonb_build_object('status', 'ok', 'employee', jsonb_build_object(
    'id', created.id, 'first_name', created.first_name, 'last_name', created.last_name, 'phone', created.phone
  ));
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_register(text, text, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.employee_find_candidates(_secret text, _first_name text, _last_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'first_name', first_name, 'last_name', last_name, 'phone', phone, 'password_hash', password_hash
    ))
    FROM public.employees
    WHERE lower(btrim(first_name)) = lower(btrim(_first_name))
      AND lower(btrim(last_name)) = lower(btrim(_last_name))
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_find_candidates(text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.employee_get_by_id(_secret text, _employee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row public.employees%ROWTYPE;
BEGIN
  PERFORM public._require_secret(_secret);
  SELECT * INTO row FROM public.employees WHERE id = _employee_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', row.id, 'first_name', row.first_name, 'last_name', row.last_name, 'phone', row.phone);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_get_by_id(text, uuid) TO anon;

/* -------------------------------- employee data ------------------------------ */

CREATE OR REPLACE FUNCTION public.employee_select_shifts_range(_secret text, _start date, _end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.start_time)
    FROM public.shifts s
    WHERE s.shift_date >= _start AND s.shift_date <= _end
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_select_shifts_range(text, date, date) TO anon;

CREATE OR REPLACE FUNCTION public.employee_select_shifts_by_date(_secret text, _date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.start_time)
    FROM public.shifts s
    WHERE s.shift_date = _date
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_select_shifts_by_date(text, date) TO anon;

CREATE OR REPLACE FUNCTION public.employee_select_signups_by_shift_ids(_secret text, _shift_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(ss))
    FROM public.shift_signups ss
    WHERE ss.shift_id = ANY(_shift_ids)
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_select_signups_by_shift_ids(text, uuid[]) TO anon;

CREATE OR REPLACE FUNCTION public.employee_select_shift_conflict_rules(_secret text, _shift_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'shift_id', scr.shift_id,
      'employee_id_a', cr.employee_id_a,
      'employee_id_b', cr.employee_id_b
    ))
    FROM public.shift_conflict_rules scr
    JOIN public.conflict_rules cr ON cr.id = scr.rule_id
    WHERE scr.shift_id = ANY(_shift_ids)
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_select_shift_conflict_rules(text, uuid[]) TO anon;

CREATE OR REPLACE FUNCTION public.employee_signup_for_shift(_secret text, _employee_id uuid, _shift_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN public.signup_for_shift(_shift_id, _employee_id, false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_signup_for_shift(text, uuid, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_cancel_signup(_secret text, _employee_id uuid, _shift_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row public.shift_signups%ROWTYPE;
BEGIN
  PERFORM public._require_secret(_secret);
  SELECT * INTO row FROM public.shift_signups WHERE shift_id = _shift_id AND employee_id = _employee_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF row.start_actual_ts IS NOT NULL THEN RETURN 'started'; END IF;
  DELETE FROM public.shift_signups WHERE id = row.id;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_cancel_signup(text, uuid, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_start_shift(_secret text, _employee_id uuid, _shift_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  UPDATE public.shift_signups
    SET start_actual_ts = now()
    WHERE shift_id = _shift_id AND employee_id = _employee_id AND start_actual_ts IS NULL;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_start_shift(text, uuid, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_end_shift(_secret text, _employee_id uuid, _shift_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  UPDATE public.shift_signups
    SET end_actual_ts = now()
    WHERE shift_id = _shift_id AND employee_id = _employee_id
      AND start_actual_ts IS NOT NULL AND end_actual_ts IS NULL;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_end_shift(text, uuid, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_save_note(_secret text, _employee_id uuid, _shift_id uuid, _note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  UPDATE public.shift_signups
    SET note = NULLIF(btrim(_note), ''), note_updated_at = now()
    WHERE shift_id = _shift_id AND employee_id = _employee_id;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_save_note(text, uuid, uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.employee_select_my_shifts(_secret text, _employee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ss.id,
      'start_actual_ts', ss.start_actual_ts,
      'end_actual_ts', ss.end_actual_ts,
      'note', ss.note,
      'note_updated_at', ss.note_updated_at,
      'created_at', ss.created_at,
      'shifts', jsonb_build_object(
        'id', s.id, 'shift_date', s.shift_date, 'start_time', s.start_time, 'end_time', s.end_time
      )
    ))
    FROM public.shift_signups ss
    JOIN public.shifts s ON s.id = ss.shift_id
    WHERE ss.employee_id = _employee_id
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_select_my_shifts(text, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_select_my_projects(_secret text, _employee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ep.id,
      'order_index', ep.order_index,
      'status', ep.status,
      'completed_at', ep.completed_at,
      'projects', jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description)
    ) ORDER BY ep.order_index)
    FROM public.employee_projects ep
    JOIN public.projects p ON p.id = ep.project_id
    WHERE ep.employee_id = _employee_id
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_select_my_projects(text, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_complete_project(_secret text, _employee_id uuid, _employee_project_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_secret(_secret);
  UPDATE public.employee_projects
    SET status = 'completed', completed_at = now()
    WHERE id = _employee_project_id AND employee_id = _employee_id AND status = 'assigned';
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_complete_project(text, uuid, uuid) TO anon;
