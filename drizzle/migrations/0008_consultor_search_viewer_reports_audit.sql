CREATE OR REPLACE FUNCTION public.consultor_search(
  p_query text DEFAULT '',
  p_study text DEFAULT '',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  dni text,
  study_date date,
  study_type text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_study text;
  v_dni_query text;
  v_words text[];
BEGIN
  IF NOT COALESCE(
    public.has_role(auth.uid(), 'viewer')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'secretary'),
    false
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_query := trim(translate(
    lower(trim(COALESCE(p_query, ''))),
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'
  ));
  v_query := trim(translate(v_query, E'%_\\.', ''));
  v_study := translate(COALESCE(p_study, ''), E'%_\\', '');

  IF char_length(v_query) < 2 AND v_study = '' THEN
    RETURN;
  END IF;

  v_dni_query := regexp_replace(v_query, '[[:space:].-]', '', 'g');
  v_words := regexp_split_to_array(v_query, '[[:space:]]+');

  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    p.name,
    p.dni,
    a.date,
    a.study_type,
    a.status
  FROM public.appointments AS a
  JOIN public.patients AS p ON p.id = a.patient_id
  WHERE a.status IN ('reported', 'sent')
    AND (
      v_query = ''
      OR (
        v_dni_query ~ '^[[:alnum:]]{5,}$'
        AND v_dni_query = lower(regexp_replace(COALESCE(p.dni, ''), '[[:space:]./-]', '', 'g'))
      )
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(v_words) AS w(word)
        WHERE translate(lower(COALESCE(p.name, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')
          NOT LIKE '%' || w.word || '%'
      )
    )
    AND (v_study = '' OR a.study_type ILIKE '%' || v_study || '%')
  ORDER BY a.date DESC, a.time DESC
  LIMIT least(p_limit, 200)
  OFFSET greatest(p_offset, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consultor_search(text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultor_search(text, text, int, int) TO authenticated;

CREATE POLICY "Viewers can select reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reports' AND public.has_role(auth.uid(), 'viewer'));

DROP POLICY "Doctor secretary can insert view audit log" ON public.audit_log;
CREATE POLICY "Doctor secretary can insert view audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'secretary')
    OR public.has_role(auth.uid(), 'viewer')
  )
  AND user_id = auth.uid()
  AND action = 'view'
);