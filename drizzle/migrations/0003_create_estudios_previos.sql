-- Estudios previos del paciente (archivos Word/PDF/fotos cargados a mano)
CREATE TABLE IF NOT EXISTS public.estudios_previos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo text NOT NULL,
  origen text NOT NULL DEFAULT 'propio' CHECK (origen IN ('propio','externo')),
  archivo_path text NOT NULL,
  archivo_nombre text NOT NULL,
  mime text,
  notas text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS estudios_previos_patient_idx ON public.estudios_previos (patient_id, fecha DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudios_previos TO authenticated;
GRANT ALL ON public.estudios_previos TO service_role;

ALTER TABLE public.estudios_previos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor/secretary can view estudios_previos"
  ON public.estudios_previos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));
CREATE POLICY "Doctor/secretary can insert estudios_previos"
  ON public.estudios_previos FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary')) AND created_by = auth.uid());

CREATE POLICY "Doctor/secretary can read estudios_previos files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'estudios_previos' AND (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary')));
CREATE POLICY "Doctor/secretary can upload estudios_previos files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estudios_previos' AND (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary')));