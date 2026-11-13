import { describe, expect, it } from 'vitest';
import { getAgendaSummary } from './DailyView';
import type { Appointment } from '@/types/medical';

const appointment = (id: string, time: string, overrides: Partial<Appointment> = {}): Appointment => ({
  id, time, date: '2026-06-09', patientId: id,
  patient: { id, name: id, dni: '', phone: '', age: 30 },
  studyType: 'Ecografía', status: 'pending', report: '', images: [], imageUrls: [],
  asistio: false, createdAt: '', ...overrides,
});

describe('resumen de la agenda cargada', () => {
  it('elige el primer pendiente por hora sin llegada, ausencia ni cancelación', () => {
    const summary = getAgendaSummary([
      appointment('tarde', '10:00'), appointment('primero', '09:00'),
      appointment('llego', '08:00', { asistio: true }),
      appointment('demorado', '08:10', { arrivalState: 'late' }),
      appointment('ausente', '08:20', { arrivalState: 'missed' }),
      appointment('cancelado', '08:30', { status: 'cancelled' }),
      appointment('informado', '08:40', { status: 'reported' }),
      appointment('enviado', '08:50', { status: 'sent' }),
      appointment('no-show', '08:55', { status: 'no-show' }),
    ]);
    expect(summary.next?.id).toBe('primero');
    expect(summary.pending).toBe(2);
  });
  it('cuenta llegados, demorados y ausentes sin duplicar ni contar cancelados', () => {
    const summary = getAgendaSummary([
      appointment('llego', '08:00', { asistio: true }),
      appointment('demorado', '08:10', { arrivalState: 'late' }),
      appointment('ausente', '08:20', { arrivalState: 'missed', status: 'no-show' }),
      appointment('cancelado', '08:30', { status: 'cancelled', arrivalState: 'arrived' }),
    ]);
    expect([summary.arrived, summary.late, summary.missed, summary.pending]).toEqual([1, 1, 1, 0]);
    expect(summary.next).toBeUndefined();
  });
  it('un día vacío no tiene próximo turno ni contadores', () => {
    expect(getAgendaSummary([])).toEqual({ next: undefined, arrived: 0, late: 0, missed: 0, pending: 0 });
  });
});