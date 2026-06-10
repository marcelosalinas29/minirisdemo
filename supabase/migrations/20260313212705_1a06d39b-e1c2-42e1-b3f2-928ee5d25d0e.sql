
-- Allow secretaries to manage doctor schedules (INSERT, UPDATE, DELETE)
CREATE POLICY "Secretaries can insert doctor schedules"
ON public.doctor_schedules
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Secretaries can update doctor schedules"
ON public.doctor_schedules
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Secretaries can delete doctor schedules"
ON public.doctor_schedules
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'secretary'));
