CREATE TABLE public.doctor_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  study_type text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX doctor_templates_user_id_idx ON public.doctor_templates(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_templates TO authenticated;
GRANT ALL ON public.doctor_templates TO service_role;

ALTER TABLE public.doctor_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors and admins can view own templates"
ON public.doctor_templates
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);

CREATE POLICY "Doctors and admins can insert own templates"
ON public.doctor_templates
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);

CREATE POLICY "Doctors and admins can update own templates"
ON public.doctor_templates
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);

CREATE POLICY "Doctors and admins can delete own templates"
ON public.doctor_templates
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'doctor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);
