
-- Create doctor_schedules table for availability blocks
CREATE TABLE public.doctor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN avatar_url text DEFAULT NULL;

-- Enable RLS on doctor_schedules
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for doctor_schedules
CREATE POLICY "Authenticated users can view all schedules"
  ON public.doctor_schedules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Doctors can manage their own schedules"
  ON public.doctor_schedules FOR INSERT TO authenticated
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update their own schedules"
  ON public.doctor_schedules FOR UPDATE TO authenticated
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can delete their own schedules"
  ON public.doctor_schedules FOR DELETE TO authenticated
  USING (doctor_id = auth.uid());

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
