CREATE POLICY "Doctor admin can delete estudios_previos"
ON public.estudios_previos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'doctor')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.is_admin = true
  )
);

CREATE POLICY "Doctor admin can delete estudios_previos files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'estudios_previos'
  AND (
    public.has_role(auth.uid(), 'doctor')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  )
);