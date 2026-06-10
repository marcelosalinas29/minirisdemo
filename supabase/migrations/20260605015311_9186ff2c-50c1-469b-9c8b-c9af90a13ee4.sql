
-- 1) Appointments: restrict writes to doctor/secretary
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;

CREATE POLICY "Doctor/secretary can insert appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role));

CREATE POLICY "Doctor/secretary can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role));

CREATE POLICY "Doctor/secretary can delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role));

-- 2) Patients: restrict writes to doctor/secretary
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;

CREATE POLICY "Doctor/secretary can insert patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role));

CREATE POLICY "Doctor/secretary can update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role));

-- 3) user_roles: explicitly deny writes from clients (only service_role can write)
CREATE POLICY "Block client inserts on user_roles"
  ON public.user_roles FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block client updates on user_roles"
  ON public.user_roles FOR UPDATE TO authenticated, anon
  USING (false);

CREATE POLICY "Block client deletes on user_roles"
  ON public.user_roles FOR DELETE TO authenticated, anon
  USING (false);

-- 4) Storage: restrict DELETE/UPDATE on reports & estudios_imagenes to doctor/secretary
DROP POLICY IF EXISTS "Authenticated users can delete reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from estudios_imagenes" ON storage.objects;

CREATE POLICY "Doctor/secretary can delete reports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role)));

CREATE POLICY "Doctor/secretary can update reports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reports' AND (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role)))
  WITH CHECK (bucket_id = 'reports' AND (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role)));

CREATE POLICY "Doctor/secretary can delete from estudios_imagenes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'estudios_imagenes' AND (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'secretary'::app_role)));

-- 5) Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- They still work inside RLS policies because policies run as the table owner.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.purge_old_communication_records() FROM anon, authenticated, public;
