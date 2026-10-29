DROP POLICY IF EXISTS "Admins can view resend log" ON public.resend_log;
DROP POLICY IF EXISTS "Admins can insert resend log" ON public.resend_log;
DROP POLICY IF EXISTS "Admins can delete resend log" ON public.resend_log;

CREATE POLICY "Admins and secretaries can view resend log"
ON public.resend_log FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true)
  OR public.has_role(auth.uid(), 'secretary')
);

CREATE POLICY "Admins and secretaries can insert resend log"
ON public.resend_log FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true)
  OR public.has_role(auth.uid(), 'secretary')
);

CREATE POLICY "Admins and secretaries can delete resend log"
ON public.resend_log FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true)
  OR public.has_role(auth.uid(), 'secretary')
);