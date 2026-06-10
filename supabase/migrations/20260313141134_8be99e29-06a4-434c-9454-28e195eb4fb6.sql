
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS observations text DEFAULT '';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES auth.users(id) DEFAULT NULL;
