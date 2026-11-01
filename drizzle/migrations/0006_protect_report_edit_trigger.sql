CREATE OR REPLACE FUNCTION public.protect_report_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (auth.uid() IS NULL) siempre puede pasar
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo se controla si cambia el informe o quien lo firmó
  IF NEW.report IS DISTINCT FROM OLD.report
     OR NEW.reported_by IS DISTINCT FROM OLD.reported_by THEN

    -- Debe ser médico
    IF NOT public.has_role(auth.uid(), 'doctor') THEN
      RAISE EXCEPTION 'Solo el médico que realizó el informe puede modificarlo'
        USING ERRCODE = '42501';
    END IF;

    -- Y además: informe vacío, sin firmante, o firmado por el mismo médico
    IF NOT (
      COALESCE(OLD.report, '') = ''
      OR OLD.reported_by IS NULL
      OR OLD.reported_by = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Solo el médico que realizó el informe puede modificarlo'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_report_edit_trigger ON public.appointments;
CREATE TRIGGER protect_report_edit_trigger
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_report_edit();