CREATE POLICY "Authenticated users can update reports"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reports')
WITH CHECK (bucket_id = 'reports');