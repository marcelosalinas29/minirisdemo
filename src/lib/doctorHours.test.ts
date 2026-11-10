import { describe, it, expect } from 'vitest';
import { workingRanges, isWithinHours, slotsForDate, doctorsAtSlot, firstUncoveredSlot, dowOf, type HoursContext } from './doctorHours';

const W = (doctorId: string, dayOfWeek: number, startTime: string, endTime: string) => ({ doctorId, dayOfWeek, startTime, endTime, active: true });
const TUE = '2027-03-02'; // martes
const ctx = (extra: Partial<HoursContext> = {}): HoursContext => ({
  weekly: [W('a', 2, '08:00', '12:00'), W('a', 2, '16:00', '20:00'), W('b', 2, '14:00', '15:00')],
  exceptions: [], blockedDates: [], ...extra,
});
const ex = (o: any) => ({ id: 'x', reason: null, startTime: null, endTime: null, dateFrom: TUE, dateTo: TUE, ...o });

describe('horarios del médico', () => {
  it('dia de la semana', () => { expect(dowOf(TUE)).toBe(2); expect(dowOf('2027-03-07')).toBe(0); });
  it('horario semanal', () => {
    expect(isWithinHours('a', TUE, '08:00', ctx())).toBe(true);
    expect(isWithinHours('a', TUE, '11:50', ctx())).toBe(true);
    expect(isWithinHours('a', TUE, '12:00', ctx())).toBe(false);
    expect(isWithinHours('a', '2027-03-07', '09:00', ctx())).toBe(false);
  });
  it('bloqueo de un día', () => {
    expect(workingRanges('a', TUE, ctx({ exceptions: [ex({ doctorId: 'a', kind: 'block' })] }))).toEqual([]);
  });
  it('bloqueo de una mañana deja la tarde', () => {
    const c = ctx({ exceptions: [ex({ doctorId: 'a', kind: 'block', startTime: '08:00', endTime: '12:00' })] });
    expect(isWithinHours('a', TUE, '09:00', c)).toBe(false);
    expect(isWithinHours('a', TUE, '17:00', c)).toBe(true);
  });
  it('bloqueo de varios días (vacaciones)', () => {
    const c = ctx({ exceptions: [ex({ doctorId: 'a', kind: 'block', dateFrom: '2027-02-28', dateTo: '2027-03-10' })] });
    expect(isWithinHours('a', TUE, '09:00', c)).toBe(false);
    expect(isWithinHours('a', '2027-03-11', '09:00', ctx())).toBe(false); // jueves no atiende igual
  });
  it('apertura puntual', () => {
    const c = ctx({ exceptions: [ex({ doctorId: 'b', kind: 'open', startTime: '09:00', endTime: '10:00' })] });
    expect(isWithinHours('b', TUE, '09:30', c)).toBe(true);
  });
  it('día bloqueado del consultorio', () => {
    expect(isWithinHours('a', TUE, '09:00', ctx({ blockedDates: [{ date: TUE }] }))).toBe(false);
  });
  it('slots, médicos disponibles y turnos dobles', () => {
    expect(slotsForDate('b', TUE, ctx())).toEqual(['14:00', '14:10', '14:20', '14:30', '14:40', '14:50']);
    expect(doctorsAtSlot(['a', 'b'], TUE, '14:30', ctx())).toEqual(['b']);
    expect(firstUncoveredSlot('a', TUE, '11:50', 2, ctx())).toBe('12:00');
    expect(firstUncoveredSlot('a', TUE, '11:40', 2, ctx())).toBeNull();
  });
});
