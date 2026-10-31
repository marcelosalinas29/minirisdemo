-- Historial de versiones de informes: cada vez que cambia el texto del informe,
-- se guarda la versión anterior. Funciona con un trigger para cubrir todos los caminos de guardado.
CREATE TABLE IF NOT EXISTS public.report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  report text NOT NULL,
  saved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_versions_appointment_idx
  ON public.report_versions (appointment_id, created_at DESC);

ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor/secretary can view report versions"
  ON public.report_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));
-- Sin políticas de INSERT/UPDATE/DELETE: solo escribe el trigger (SECURITY DEFINER); nadie edita ni borra versiones desde la app.

CREATE OR REPLACE FUNCTION public.snapshot_report_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.report IS NOT NULL
     AND btrim(regexp_replace(OLD.report, '<[^>]*>', '', 'g')) <> ''
     AND NEW.report IS DISTINCT FROM OLD.report THEN
    -- Con autoguardado, no guardar más de una versión cada 2 minutos por turno
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
