
-- Patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dni TEXT DEFAULT '',
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all patients"
  ON public.patients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert patients"
  ON public.patients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update patients"
  ON public.patients FOR UPDATE TO authenticated USING (true);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  study_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  date DATE NOT NULL,
  time TEXT NOT NULL,
  report TEXT DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all appointments"
  ON public.appointments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert appointments"
  ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update appointments"
  ON public.appointments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete appointments"
  ON public.appointments FOR DELETE TO authenticated USING (true);
