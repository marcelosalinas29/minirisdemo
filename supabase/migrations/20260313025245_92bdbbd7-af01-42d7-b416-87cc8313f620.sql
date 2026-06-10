ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS obra_social text DEFAULT '';