import { getPatientHistoryKey, isInactiveStatus, type Appointment } from '@/types/medical';

export interface PreviousStudyHistoryRow {
  patient_id: string | null;
  patients: { id: string; dni: string | null; dni_materno: boolean | null } | null;
}

export function buildPatientsWithHistory(
  appointments: Appointment[],
  historicalKeys: Set<string>,
  previousStudies: PreviousStudyHistoryRow[],
): Set<string> {
  const counts = new Map<string, number>();
  for (const appointment of appointments) {
    if (isInactiveStatus(appointment.status)) continue;
    const key = getPatientHistoryKey(appointment.patient);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const result = new Set(historicalKeys);
  counts.forEach((count, key) => { if (count > 1) result.add(key); });
  for (const row of previousStudies) {
    if (!row.patient_id) continue;
    result.add(getPatientHistoryKey({
      id: row.patient_id,
      dni: row.patients?.dni || '',
      dniMaterno: row.patients?.dni_materno ?? false,
    }));
  }
  return result;
}