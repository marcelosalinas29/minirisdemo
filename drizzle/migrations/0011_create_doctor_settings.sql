CREATE TABLE public.doctor_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_settings TO authenticated;
GRANT ALL ON public.doctor_settings TO service_role;

ALTER TABLE public.doctor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor settings select own"
ON public.doctor_settings
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);

CREATE POLICY "Doctor settings insert own"
ON public.doctor_settings
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);

CREATE POLICY "Doctor settings update own"
ON public.doctor_settings
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);

CREATE POLICY "Doctor settings delete own"
ON public.doctor_settings
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);