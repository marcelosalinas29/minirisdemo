ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_doctor_date_idx ON public.appointments(doctor_id, date);