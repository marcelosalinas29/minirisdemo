import { describe, expect, it } from 'vitest';
import { buildPatientsWithHistory } from './agendaHistory';
import { getPatientHistoryKey, type Appointment } from '@/types/medical';

const patient = { id: 'paciente', dni: '31.386.298', name: 'PRUEBA', age: 0, phone: '' };
const appointment: Appointment = {
  id: 'turno', patientId: patient.id, patient, studyType: 'Estudio', status: 'pending',
  date: '2026-11-12', time: '09:00', report: '', images: [], imageUrls: [], asistio: false, createdAt: '',
};
const previousStudy = { patient_id: 'duplicado', patients: { id: 'duplicado', dni: '31386298', dni_materno: false } };

describe('historial en agenda', () => {
  it('un estudio previo identifica el historial por DNI aunque sea de otro registro del mismo paciente', () => {
    expect(buildPatientsWithHistory([appointment], new Set(), [previousStudy]).has(getPatientHistoryKey(patient))).toBe(true);
  });
  it('sin estudios previos ni otros turnos no hay historial', () => {
    expect(buildPatientsWithHistory([appointment], new Set(), []).has(getPatientHistoryKey(patient))).toBe(false);
  });
  it('al eliminar o reasignar el último estudio se pierde el historial si no hay otros turnos', () => {
    const reassigned = { patient_id: 'otro', patients: { id: 'otro', dni: '', dni_materno: false } };
    expect(buildPatientsWithHistory([appointment], new Set(), [reassigned]).has(getPatientHistoryKey(patient))).toBe(false);
    expect(buildPatientsWithHistory([appointment], new Set(), [reassigned]).has('patient:otro')).toBe(true);
  });
  it('con otro turno mantiene el historial aunque se elimine el estudio previo', () => {
    expect(buildPatientsWithHistory([appointment, { ...appointment, id: 'otro-turno' }], new Set(), []).has(getPatientHistoryKey(patient))).toBe(true);
  });
  it('para DNI materno o vacío usa patient_id y no une el historial con la madre', () => {
    const rows = [
      { patient_id: 'bebe', patients: { id: 'bebe', dni: patient.dni, dni_materno: true } },
      { patient_id: 'sin-dni', patients: { id: 'sin-dni', dni: '', dni_materno: false } },
      { patient_id: null, patients: null },
    ];
    expect([...buildPatientsWithHistory([], new Set(), rows)].sort()).toEqual(['patient:bebe', 'patient:sin-dni']);
  });
});