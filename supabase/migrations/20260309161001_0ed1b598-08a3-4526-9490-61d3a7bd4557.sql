-- Create storage bucket for reports (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true);

-- Allow authenticated users to upload reports
CREATE POLICY "Authenticated users can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports');

-- Allow public read access to reports
CREATE POLICY "Public can read reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports');

-- Allow authenticated users to delete reports
CREATE POLICY "Authenticated users can delete reports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reports');