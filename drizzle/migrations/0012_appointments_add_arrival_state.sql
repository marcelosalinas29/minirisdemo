ALTER TABLE public.appointments ADD COLUMN arrival_state text NULL CHECK (arrival_state IN ('arrived','late','missed'));

UPDATE public.appointments SET arrival_state = 'arrived' WHERE asistio = true AND arrival_state IS NULL;