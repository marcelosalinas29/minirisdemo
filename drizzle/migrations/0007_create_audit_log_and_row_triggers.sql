CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'view')),
  entity text NOT NULL,
  entity_id uuid NULL,
  patient_id uuid NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.is_admin = true
  ));
CREATE POLICY "Doctor secretary can insert view audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'))
    AND user_id = auth.uid()
    AND action = 'view'
  );

CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_entity_entity_id_idx ON public.audit_log (entity, entity_id);
CREATE INDEX audit_log_patient_id_idx ON public.audit_log (patient_id);

CREATE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j_new jsonb;
  j_old jsonb;
  j_row jsonb;
  changed_fields text[];
  before_values jsonb;
  after_values jsonb;
  audit_details jsonb := '{}'::jsonb;
  row_entity_id uuid;
  row_patient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    j_new := to_jsonb(NEW);
    j_row := j_new;
  ELSIF TG_OP = 'DELETE' THEN
    j_old := to_jsonb(OLD);
    j_row := j_old;
  ELSE
    j_new := to_jsonb(NEW);
    j_old := to_jsonb(OLD);
    j_row := j_new;

    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    INTO changed_fields
    FROM jsonb_object_keys(j_new || j_old) AS keys(k)
    WHERE k NOT IN ('images', 'image_urls')
      AND (j_new -> k) IS DISTINCT FROM (j_old -> k);

    IF cardinality(changed_fields) = 0 OR changed_fields = ARRAY['report']::text[] THEN
      RETURN NEW;
    END IF;

    audit_details := jsonb_build_object('campos', to_jsonb(changed_fields));
    SELECT jsonb_object_agg(k, j_old -> k), jsonb_object_agg(k, j_new -> k)
    INTO before_values, after_values
    FROM unnest(changed_fields) AS fields(k)
    WHERE k IN ('status', 'date', 'time', 'doctor_id', 'study_type');

    IF before_values IS NOT NULL THEN
      audit_details := audit_details || jsonb_build_object(
        'antes', before_values,
        'despues', after_values
      );
    END IF;
  END IF;

  row_entity_id := (j_row ->> 'id')::uuid;
  IF TG_TABLE_NAME = 'patients' THEN
    row_patient_id := row_entity_id;
  ELSE
    row_patient_id := (j_row ->> 'patient_id')::uuid;
  END IF;

  IF TG_OP IN ('INSERT', 'DELETE') THEN
    IF TG_TABLE_NAME = 'appointments' THEN
      SELECT COALESCE(jsonb_object_agg(k, j_row -> k), '{}'::jsonb)
      INTO audit_details
      FROM unnest(ARRAY['study_type', 'date', 'time']) AS fields(k)
      WHERE j_row ? k;
    ELSIF TG_TABLE_NAME = 'patients' AND j_row ? 'name' THEN
      audit_details := jsonb_build_object('name', j_row -> 'name');
    END IF;
  END IF;

  INSERT INTO public.audit_log (user_id, action, entity, entity_id, patient_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, row_entity_id, row_patient_id, audit_details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_patients
AFTER INSERT OR UPDATE OR DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_estudios_previos
AFTER INSERT OR UPDATE OR DELETE ON public.estudios_previos
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();