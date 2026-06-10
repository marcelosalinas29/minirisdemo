
CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(date)
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view blocked dates"
  ON public.blocked_dates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Doctor/secretary can insert blocked dates"
  ON public.blocked_dates FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'secretary')
  );

CREATE POLICY "Doctor/secretary can delete blocked dates"
  ON public.blocked_dates FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'secretary')
  );
