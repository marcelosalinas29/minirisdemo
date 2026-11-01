-- 1-2) Permitir filas pendientes sin paciente ni fecha asignados
ALTER TABLE public.estudios_previos ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE public.estudios_previos ALTER COLUMN fecha DROP NOT NULL;

-- 3) Columnas para detección automática y estado de asignación
ALTER TABLE public.estudios_previos ADD COLUMN IF NOT EXISTS nombre_detectado text;
ALTER TABLE public.estudios_previos ADD COLUMN IF NOT EXISTS dni_detectado text;
ALTER TABLE public.estudios_previos ADD COLUMN IF NOT EXISTS archivo_hash text;
ALTER TABLE public.estudios_previos ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'asignado';
ALTER TABLE public.estudios_previos ADD CONSTRAINT estudios_previos_estado_check CHECK (estado IN ('asignado','pendiente'));

-- 4-5) Índices: deduplicación por hash y filtro por estado
CREATE UNIQUE INDEX IF NOT EXISTS estudios_previos_archivo_hash_uq ON public.estudios_previos(archivo_hash) WHERE archivo_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS estudios_previos_estado_idx ON public.estudios_previos(estado);

-- 6) Policy de UPDATE para doctor/secretary (se mantienen las existentes)
CREATE POLICY "Doctor/secretary can update estudios_previos"
  ON public.estudios_previos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'))
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));