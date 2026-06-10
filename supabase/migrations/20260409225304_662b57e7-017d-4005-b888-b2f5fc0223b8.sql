
-- Table for clinic notes
CREATE TABLE public.clinic_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated doctor/secretary can view notes"
  ON public.clinic_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Authenticated doctor/secretary can insert notes"
  ON public.clinic_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Authenticated doctor/secretary can update notes"
  ON public.clinic_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Authenticated doctor/secretary can delete notes"
  ON public.clinic_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

-- Table for chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated doctor/secretary can view messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Authenticated doctor/secretary can insert messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

CREATE POLICY "Authenticated doctor/secretary can delete messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'secretary'));

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Auto-purge function: deletes records older than 28 days
CREATE OR REPLACE FUNCTION public.purge_old_communication_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.clinic_notes WHERE created_at < now() - interval '28 days';
  DELETE FROM public.chat_messages WHERE created_at < now() - interval '28 days';
END;
$$;

-- Create a cron extension and schedule (pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-old-communication',
  '0 3 * * *',
  $$SELECT public.purge_old_communication_records()$$
);
