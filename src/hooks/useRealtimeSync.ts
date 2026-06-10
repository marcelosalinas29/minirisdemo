import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClinicStore } from '@/store/useClinicStore';
import { calcularEdad } from '@/types/medical';

// Track recently mutated IDs to avoid re-fetching from realtime
const recentMutations = new Map<string, number>();
const MUTATION_COOLDOWN = 3000; // 3 seconds

export function trackMutation(id: string) {
  recentMutations.set(id, Date.now());
}

function wasRecentlyMutated(id: string): boolean {
  const ts = recentMutations.get(id);
  if (!ts) return false;
  if (Date.now() - ts < MUTATION_COOLDOWN) return true;
  recentMutations.delete(id);
  return false;
}

/**
 * Map a raw appointment row + patient into the store shape.
 * Used when we have patient data available (from JOIN or existing store).
 */
function mapRealtimeAppointment(row: any, patient: any) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patient: {
      id: patient.id,
      dni: patient.dni || '',
      name: patient.name,
      age: patient.fecha_nacimiento
        ? calcularEdad(patient.fecha_nacimiento)
        : patient.age,
      phone: patient.phone,
      fechaNacimiento: patient.fecha_nacimiento || undefined,
      obraSocial: patient.obra_social || '',
    },
    studyType: row.study_type,
    status: row.status as any,
    date: row.date,
    time: row.time,
    report: row.report || '',
    images: (row.images as string[]) || [],
    imageUrls: (row.image_urls as string[]) || [],
    observations: row.observations || '',
    reportedBy: row.reported_by || null,
    asistio: row.asistio ?? false,
    createdAt: row.created_at,
  };
}

/**
 * Global realtime subscription for appointments AND patients.
 * Mount once in App.tsx so every page/device stays in sync.
 * 
 * OPTIMIZATION: For UPDATEs, we update fields directly from the payload
 * using existing patient data from the store — no extra DB query needed.
 * Only for INSERTs of new appointments do we fetch the full row (to get patient data).
 */
export function useRealtimeSync() {
  useEffect(() => {
    const appointmentsChannel = supabase
      .channel('global-appointments-realtime')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'appointments' },
        (payload) => {
          const oldId = (payload.old as any)?.id;
          if (oldId) {
            useClinicStore.setState((s) => ({
              appointments: s.appointments.filter((a) => a.id !== oldId),
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow?.id || wasRecentlyMutated(newRow.id)) return;

          // For UPDATEs, use existing patient data from store — no extra query
          useClinicStore.setState((s) => {
            const existing = s.appointments.find((a) => a.id === newRow.id);
            if (!existing) return s; // Unknown appointment, skip
            
            return {
              appointments: s.appointments.map((a) => {
                if (a.id !== newRow.id) return a;
                return {
                  ...a,
                  studyType: newRow.study_type ?? a.studyType,
                  status: (newRow.status as any) ?? a.status,
                  date: newRow.date ?? a.date,
                  time: newRow.time ?? a.time,
                  report: newRow.report ?? a.report,
                  images: newRow.images ?? a.images,
                  imageUrls: newRow.image_urls ?? a.imageUrls,
                  observations: newRow.observations ?? a.observations,
                  reportedBy: newRow.reported_by ?? a.reportedBy,
                  asistio: newRow.asistio ?? a.asistio,
                };
              }),
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow?.id || wasRecentlyMutated(newRow.id)) return;

          // For INSERTs, we need patient data — check store first, fetch only if needed
          const state = useClinicStore.getState();
          const existingPatient = state.patients.find((p) => p.id === newRow.patient_id);
          
          if (existingPatient) {
            // Patient already in store — no DB query needed
            const mapped = mapRealtimeAppointment(newRow, {
              id: existingPatient.id,
              dni: existingPatient.dni,
              name: existingPatient.name,
              age: existingPatient.age,
              phone: existingPatient.phone,
              fecha_nacimiento: existingPatient.fechaNacimiento,
              obra_social: existingPatient.obraSocial,
            });
            useClinicStore.setState((s) => ({
              appointments: [mapped, ...s.appointments],
            }));
          } else {
            // New patient — single query to get patient data
            supabase
              .from('patients')
              .select('*')
              .eq('id', newRow.patient_id)
              .single()
              .then(({ data: patientData }) => {
                if (!patientData) return;
                const mapped = mapRealtimeAppointment(newRow, patientData);
                // Also add the patient to the store
                const patient = {
                  id: patientData.id,
                  dni: patientData.dni || '',
                  name: patientData.name,
                  age: patientData.fecha_nacimiento
                    ? calcularEdad(patientData.fecha_nacimiento)
                    : patientData.age,
                  phone: patientData.phone,
                  fechaNacimiento: patientData.fecha_nacimiento || undefined,
                  obraSocial: patientData.obra_social || '',
                };
                useClinicStore.setState((s) => ({
                  patients: s.patients.some((p) => p.id === patient.id)
                    ? s.patients
                    : [...s.patients, patient],
                  appointments: s.appointments.some((a) => a.id === newRow.id)
                    ? s.appointments
                    : [mapped, ...s.appointments],
                }));
              });
          }
        }
      )
      .subscribe();

    const patientsChannel = supabase
      .channel('global-patients-realtime')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'patients' },
        (payload) => {
          const oldId = (payload.old as any)?.id;
          if (oldId) {
            useClinicStore.setState((s) => ({
              patients: s.patients.filter((p) => p.id !== oldId),
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'patients' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow?.id || wasRecentlyMutated(newRow.id)) return;

          const mapped = {
            id: newRow.id,
            dni: newRow.dni || '',
            name: newRow.name,
            age: newRow.fecha_nacimiento
              ? calcularEdad(newRow.fecha_nacimiento)
              : newRow.age,
            phone: newRow.phone,
            fechaNacimiento: newRow.fecha_nacimiento || undefined,
            obraSocial: newRow.obra_social || '',
          };

          useClinicStore.setState((s) => ({
            patients: s.patients.some((p) => p.id === newRow.id)
              ? s.patients
              : [mapped, ...s.patients],
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow?.id || wasRecentlyMutated(newRow.id)) return;

          const mapped = {
            id: newRow.id,
            dni: newRow.dni || '',
            name: newRow.name,
            age: newRow.fecha_nacimiento
              ? calcularEdad(newRow.fecha_nacimiento)
              : newRow.age,
            phone: newRow.phone,
            fechaNacimiento: newRow.fecha_nacimiento || undefined,
            obraSocial: newRow.obra_social || '',
          };

          useClinicStore.setState((s) => ({
            patients: s.patients.map((p) => p.id === newRow.id ? mapped : p),
            // Also update patient data in appointments
            appointments: s.appointments.map((a) =>
              a.patientId === newRow.id ? { ...a, patient: mapped } : a
            ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(patientsChannel);
    };
  }, []);
}
