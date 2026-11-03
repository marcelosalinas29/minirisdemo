import { describe, it, expect } from 'vitest';
import { rangeFor, buildRows, countBy, ageFrom, pdfFileName } from './exportHelpers';

describe('exportación por fechas', () => {
  it('rangos rápidos', () => {
    const d = new Date(2026, 10, 4); // miércoles 4/11/2026
    expect(rangeFor('hoy', d)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(rangeFor('semana', d)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(rangeFor('mes', d)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(rangeFor('mes_pasado', d)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
  it('edad desde fecha de nacimiento', () => {
    expect(ageFrom({ fecha_nacimiento: '1990-06-15' }, new Date(2026, 5, 14))).toBe(35);
    expect(ageFrom({ fecha_nacimiento: '1990-06-15' }, new Date(2026, 5, 15))).toBe(36);
    expect(ageFrom({ age: 40 })).toBe(40);
    expect(ageFrom(undefined)).toBe('');
  });
  it('arma filas ordenadas, con enlace solo si hay PDF', () => {
    const appts = [
      { id: 'bbbbbbbb-1', patient_id: 'p1', date: '2026-11-03', time: '10:00:00', study_type: 'Ecografía', status: 'sent', doctor_id: 'd1', reported_by: 'd1', arrival_state: null, asistio: true },
      { id: 'aaaaaaaa-1', patient_id: 'p2', date: '2026-11-03', time: '09:00:00', study_type: 'Doppler', status: 'cancelled', doctor_id: 'd1' },
    ];
    const rows = buildRows(appts, { p1: { name: 'PÉREZ JUAN', dni: '1', obra_social: 'OSDE' }, p2: { name: 'GÓMEZ ANA' } }, { d1: 'Dr X' }, new Set(['informe_bbbbbbbb-1.pdf']));
    expect(rows.map((r) => r.hora)).toEqual(['09:00', '10:00']);
    expect(rows[0].pdf).toBe('');
    expect(rows[1].pdf).toBe('informes_pdf/2026-11-03_PEREZ JUAN_Ecografia_bbbbbbbb.pdf');
    expect(rows[1].llegada).toBe('Llegó');
    expect(rows[0].estado).toBe('Cancelado');
    expect(pdfFileName({ id: 'x'.repeat(10), date: '2026-01-01', study_type: 'A/B' }, 'Ñu')).toContain('Nu_A_B');
  });
  it('cuenta por campo', () => {
    const rows: any[] = [{ obraSocial: 'A' }, { obraSocial: 'B' }, { obraSocial: 'A' }, { obraSocial: '' }];
    expect(countBy(rows, 'obraSocial')).toEqual([['A', 2], ['(sin dato)', 1], ['B', 1]]);
  });
});
