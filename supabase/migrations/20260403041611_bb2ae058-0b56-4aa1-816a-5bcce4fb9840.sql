
-- Create storage bucket for study images
INSERT INTO storage.buckets (id, name, public)
VALUES ('estudios_imagenes', 'estudios_imagenes', true);

-- Storage policies
CREATE POLICY "Public read access for estudios_imagenes"
ON storage.objects FOR SELECT
USING (bucket_id = 'estudios_imagenes');

CREATE POLICY "Authenticated users can upload to estudios_imagenes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'estudios_imagenes');

CREATE POLICY "Authenticated users can delete from estudios_imagenes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'estudios_imagenes');

-- Add new column for storage URLs (keeps old images column intact)
ALTER TABLE public.appointments
ADD COLUMN image_urls text[] DEFAULT '{}';
