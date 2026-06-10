import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, Patient, StudyStatus } from '@/types/medical';
import { calcularEdad } from '@/types/medical';
import { trackMutation } from '@/hooks/useRealtimeSync';

let lastPatientsLoad = 0;
let lastAppointmentsLoad = 0;
const LOAD_COOLDOWN = 30000; // 30 seconds minimum between full reloads

interface ClinicStore {
  patients: Patient[];
  appointments: Appointment[];
  loading: boolean;
  fetchAppointmentDetail: (id: string) => Promise<Appointment | null>;
  fetchPatients: (force?: boolean) => Promise<void>;
  fetchAppointments: (force?: boolean) => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'age'> & { age?: number }) => Promise<Patient>;
  addAppointment: (data: { patientId: string; studyType: string; date: string; time: string }) => Promise<Appointment>;
  updateAppointmentStatus: (id: string, status: StudyStatus) => Promise<void>;
  updateAppointmentReport: (id: string, report: string, reportedBy?: string) => Promise<void>;
  updateAppointmentStudyType: (id: string, studyType: string) => Promise<void>;
  updateAppointmentTime: (id: string, time: string) => Promise<void>;
  updateAppointmentDate: (id: string, date: string) => Promise<void>;
  updateAppointmentObservations: (id: string, observations: string) => Promise<void>;
  updateAppointmentAsistio: (id: string, asistio: boolean) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  rescheduleAppointment: (id: string, date: string, time: string) => Promise<void>;
  addImagesToAppointment: (id: string, images: string[]) => Promise<void>;
  addStorageImagesToAppointment: (id: string, urls: string[]) => Promise<void>;
  removeImageFromAppointment: (id: string, index: number) => Promise<void>;
  removeStorageImage: (id: string, index: number) => Promise<void>;
  getAppointmentsByDate: (date: string) => Appointment[];
  getPatientAppointments: (patientId: string) => Appointment[];
  searchPatients: (query: string) => Patient[];
  updatePatient: (id: string, data: Partial<Pick<Patient, 'name' | 'phone' | 'dni' | 'obraSocial' | 'fechaNacimiento'>>) => Promise<void>;
  getAppointment: (id: string) => Appointment | undefined;
  getPatient: (id: string) => Patient | undefined;
  findPatientByDni: (dni: string) => Promise<Patient | null>;
}

function mapPatient(p: any): Patient {
  return {
    id: p.id,
    dni: p.dni || '',
    name: p.name,
    age: p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : p.age,
    phone: p.phone,
    fechaNacimiento: p.fecha_nacimiento || undefined,
    obraSocial: p.obra_social || '',
  };
}

function mapAppointment(a: any): Appointment {
  return {
    id: a.id,
    patientId: a.patient_id,
    patient: mapPatient(a.patients),
    studyType: a.study_type,
    status: a.status as StudyStatus,
    date: a.date,
    time: a.time,
    report: a.report || '',
    images: (a.images as string[]) || [],
    imageUrls: (a.image_urls as string[]) || [],
    observations: a.observations || '',
    reportedBy: a.reported_by || null,
    asistio: a.asistio ?? false,
    createdAt: a.created_at,
  };
}

export const useClinicStore = create<ClinicStore>()((set, get) => ({
  patients: [],
  appointments: [],
  loading: false,

  fetchAppointmentDetail: async (id: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const full = mapAppointment(data);
    set((s) => ({
      appointments: s.appointments.some((a) => a.id === id)
        ? s.appointments.map((a) => a.id === id ? full : a)
        : [full, ...s.appointments],
    }));
    return full;
  },

  fetchPatients: async (force = false) => {
    if (!force && get().patients.length > 0 && Date.now() - lastPatientsLoad < LOAD_COOLDOWN) return;
    const { data } = await supabase.from('patients').select('*').order('name');
    if (data) {
      set({ patients: data.map(mapPatient) });
      lastPatientsLoad = Date.now();
    }
  },

  fetchAppointments: async (force = false) => {
    if (!force && get().appointments.length > 0 && Date.now() - lastAppointmentsLoad < LOAD_COOLDOWN) {
      set({ loading: false });
      return;
    }
    set({ loading: true });
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateFilter = ninetyDaysAgo.toISOString().split('T')[0];
    const existingAppointments = new Map(get().appointments.map((appointment) => [appointment.id, appointment]));
    const { data } = await supabase
      .from('appointments')
      .select('id, patient_id, study_type, status, date, time, observations, reported_by, asistio, created_at, created_by, patients(*)')
      .gte('date', dateFilter)
      .order('created_at', { ascending: false });
    if (data) {
      set({
        appointments: data.map((a: any) => {
          const existing = existingAppointments.get(a.id);
          return mapAppointment({
            ...a,
            report: existing?.report ?? '',
            images: existing?.images ?? [],
            image_urls: a.image_urls ?? existing?.imageUrls ?? [],
            reported_by: a.reported_by ?? existing?.reportedBy ?? null,
          });
        }),
      });
      lastAppointmentsLoad = Date.now();
    }
    set({ loading: false });
  },

  addPatient: async (data) => {
    const age = data.fechaNacimiento ? calcularEdad(data.fechaNacimiento) : (data.age || 0);
    const { data: inserted, error } = await supabase
      .from('patients')
      .insert({
        dni: data.dni,
        name: data.name,
        age,
        phone: data.phone,
        fecha_nacimiento: data.fechaNacimiento || null,
        obra_social: data.obraSocial || '',
      } as any)
      .select()
      .single();
    if (error) {
      console.error('Error adding patient:', error);
      throw error;
    }
    const patient = mapPatient(inserted);
    set((s) => ({ patients: [...s.patients, patient] }));
    return patient;
  },

  addAppointment: async (data) => {
    const { data: inserted, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: data.patientId,
        study_type: data.studyType,
        status: 'pending',
        date: data.date,
        time: data.time,
        report: '',
        images: [],
      } as any)
      .select('*, patients(*)')
      .single();
    if (error) {
      console.error('Error adding appointment:', error, data);
      throw error;
    }
    const appointment = mapAppointment(inserted);
    trackMutation(appointment.id);
    set((s) => ({
      patients: s.patients.some((p) => p.id === appointment.patientId)
        ? s.patients
        : [...s.patients, appointment.patient],
      appointments: [appointment, ...s.appointments],
    }));
    return appointment;
  },

  updateAppointmentStatus: async (id, status) => {
    trackMutation(id);
    await supabase.from('appointments').update({ status }).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
  },

  updateAppointmentReport: async (id, report, reportedBy) => {
    trackMutation(id);
    const updateData: any = { report };
    if (reportedBy) updateData.reported_by = reportedBy;
    const { data: updated, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select('*, patients(*)')
      .maybeSingle();
    if (error) {
      console.error('Error saving report:', error);
      throw error;
    }
    if (!updated) {
      throw new Error('No se pudo verificar el guardado del informe');
    }
    const updatedAppointment = mapAppointment(updated);
    set((s) => ({
      appointments: s.appointments.some((a) => a.id === id)
        ? s.appointments.map((a) => (a.id === id ? updatedAppointment : a))
        : [updatedAppointment, ...s.appointments],
    }));
  },

  updateAppointmentStudyType: async (id, studyType) => {
    trackMutation(id);
    await supabase.from('appointments').update({ study_type: studyType }).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, studyType } : a)),
    }));
  },

  updateAppointmentTime: async (id, time) => {
    trackMutation(id);
    await supabase.from('appointments').update({ time }).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, time } : a)),
    }));
  },

  updateAppointmentDate: async (id, date) => {
    trackMutation(id);
    await supabase.from('appointments').update({ date }).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, date } : a)),
    }));
  },

  updateAppointmentObservations: async (id, observations) => {
    trackMutation(id);
    await supabase.from('appointments').update({ observations } as any).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, observations } : a)),
    }));
  },

  updateAppointmentAsistio: async (id, asistio) => {
    trackMutation(id);
    const { error } = await supabase.from('appointments').update({ asistio } as any).eq('id', id);
    if (!error) {
      set((s) => ({
        appointments: s.appointments.map((a) => (a.id === id ? { ...a, asistio } : a)),
      }));
    }
  },

  addImagesToAppointment: async (id, images) => {
    const current = get().appointments.find((a) => a.id === id);
    if (!current) return;
    const updated = [...current.images, ...images];
    trackMutation(id);
    await supabase.from('appointments').update({ images: updated }).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => a.id === id ? { ...a, images: updated } : a),
    }));
  },

  addStorageImagesToAppointment: async (id, urls) => {
    const current = get().appointments.find((a) => a.id === id);
    if (!current) return;
    const updated = [...current.imageUrls, ...urls];
    trackMutation(id);
    await supabase.from('appointments').update({ image_urls: updated } as any).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => a.id === id ? { ...a, imageUrls: updated } : a),
    }));
  },

  removeImageFromAppointment: async (id, index) => {
    const current = get().appointments.find((a) => a.id === id);
    if (!current) return;
    const updated = current.images.filter((_, i) => i !== index);
    trackMutation(id);
    await supabase.from('appointments').update({ images: updated }).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => a.id === id ? { ...a, images: updated } : a),
    }));
  },

  removeStorageImage: async (id, index) => {
    const current = get().appointments.find((a) => a.id === id);
    if (!current) return;
    const updated = current.imageUrls.filter((_, i) => i !== index);
    trackMutation(id);
    await supabase.from('appointments').update({ image_urls: updated } as any).eq('id', id);
    set((s) => ({
      appointments: s.appointments.map((a) => a.id === id ? { ...a, imageUrls: updated } : a),
    }));
  },

  getAppointmentsByDate: (date) => get().appointments.filter((a) => a.date === date),

  getPatientAppointments: (patientId) =>
    get()
      .appointments.filter((a) => a.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  searchPatients: (query) => {
    const q = query.toLowerCase();
    return get().patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.dni && p.dni.includes(q))
    );
  },

  deleteAppointment: async (id) => {
    trackMutation(id);
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({
      appointments: s.appointments.filter((a) => a.id !== id),
    }));
  },

  rescheduleAppointment: async (id, date, time) => {
    trackMutation(id);
    const { error } = await supabase.from('appointments').update({ date, time }).eq('id', id);
    if (error) throw error;
    set((s) => ({
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, date, time } : a)),
    }));
  },

  getAppointment: (id) => get().appointments.find((a) => a.id === id),
  updatePatient: async (id, data) => {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.dni !== undefined) updateData.dni = data.dni;
    if (data.obraSocial !== undefined) updateData.obra_social = data.obraSocial;
    if (data.fechaNacimiento !== undefined) {
      updateData.fecha_nacimiento = data.fechaNacimiento;
      updateData.age = calcularEdad(data.fechaNacimiento);
    }
    const { error } = await supabase.from('patients').update(updateData).eq('id', id);
    if (error) throw error;
    const age = data.fechaNacimiento ? calcularEdad(data.fechaNacimiento) : undefined;
    const merged = age !== undefined ? { ...data, age } : data;
    set((s) => ({
      patients: s.patients.map((p) => p.id === id ? { ...p, ...merged } : p),
      appointments: s.appointments.map((a) => a.patientId === id ? { ...a, patient: { ...a.patient, ...merged } } : a),
    }));
  },

  getPatient: (id) => get().patients.find((p) => p.id === id),

  findPatientByDni: async (dni: string) => {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('dni', dni)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return mapPatient(data);
  },
}));
