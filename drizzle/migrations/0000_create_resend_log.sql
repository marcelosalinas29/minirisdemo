CREATE TABLE public.resend_log (
  appointment_id uuid NOT NULL UNIQUE,
  marked_by uuid DEFAULT auth.uid(),
  marked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.resend_log TO authenticated;
GRANT ALL ON public.resend_log TO service_role;
ALTER TABLE public.resend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view resend log"
ON public.resend_log FOR SELECT TO authenticated
USING (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true));
CREATE POLICY "Admins can insert resend log"
ON public.resend_log FOR INSERT TO authenticated
WITH CHECK (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true));
CREATE POLICY "Admins can delete resend log"
ON public.resend_log FOR DELETE TO authenticated
USING (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true));