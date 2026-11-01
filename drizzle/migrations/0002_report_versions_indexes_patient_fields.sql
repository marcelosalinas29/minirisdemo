-- 1) Historial de versiones de informes
CREATE TABLE IF NOT EXISTS public.report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  report text NOT NULL,
  saved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_versions_appointment_idx ON public.report_versions (appointment_id, created_at DESC);
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctor/secretary can view report versions"
  ON public.report_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));
-- sin políticas de INSERT/UPDATE/DELETE: solo escribe el trigger

CREATE OR REPLACE FUNCTION public.snapshot_report_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.report IS NOT NULL
     AND btrim(regexp_replace(OLD.report, '<[^>]*>', '', 'g')) <> ''
     AND NEW.report IS DISTINCT FROM OLD.report THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.report_versions
      WHERE appointment_id = OLD.id AND created_at > now() - interval '2 minutes'
    ) THEN
      INSERT INTO public.report_versions (appointment_id, report, saved_by)
      VALUES (OLD.id, OLD.report, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS appointments_snapshot_report ON public.appointments;
CREATE TRIGGER appointments_snapshot_report
  BEFORE UPDATE OF report ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_report_version();

-- 2) Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments (date);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON public.appointments (patient_id);
CREATE INDEX IF NOT EXISTS appointments_created_at_idx ON public.appointments (created_at DESC);
CREATE INDEX IF NOT EXISTS patients_dni_idx ON public.patients (dni);

-- 3) Pacientes: apellido y nombres separados, tipo de documento, DNI de la madre (recién nacidos)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS apellido text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nombres text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dni_tipo text NOT NULL DEFAULT 'DNI';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dni_materno boolean NOT NULL DEFAULT false;