-- Switch employee auth from phone-only identity check to full name + password.
-- Confirmed with the project owner that only test data exists, so it's safe to
-- clear existing rows rather than backfill a password for them.
TRUNCATE TABLE public.employees RESTART IDENTITY CASCADE;

ALTER TABLE public.employees ADD COLUMN password_hash text NOT NULL;

DROP INDEX IF EXISTS public.employees_name_key;

-- Full name is no longer required to be globally unique — phone number is kept
-- as the tiebreaker between two employees who happen to share a name.
CREATE UNIQUE INDEX employees_name_phone_key ON public.employees (
  lower(btrim(first_name)),
  lower(btrim(last_name)),
  phone
);
