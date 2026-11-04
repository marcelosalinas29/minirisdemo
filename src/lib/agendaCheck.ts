import { supabase } from '@/integrations/supabase/client';
import { checkPlacement, type PlacementResult, type SlottedAppointment } from '@/lib/agendaRules';

/** Turnos del día leídos en el momento (no de la pantalla, que puede estar desactualizada). */
export async function fetchDaySlots(date: string): Promise<SlottedAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, time, study_type, status, doctor_id, es_sobreturno')
    .eq('date', date);
  if (error) throw error;
  return (data || []).map((a: any) => ({
    id: a.id, time: a.time, studyType: a.study_type, status: a.status, doctorId: a.doctor_id, esSobreturno: !!a.es_sobreturno,
  }));
}

/** Verificación final contra la base antes de guardar o mover un turno. */
export async function verifyPlacement(p: {
  date: string; time: string; studyType: string; id?: string; doctorId?: string | null; sobreturno?: boolean; validSlots?: string[];
}): Promise<PlacementResult> {
  if (p.sobreturno) return { ok: true, message: '' };
  const day = await fetchDaySlots(p.date);
  return checkPlacement(day, p);
}
