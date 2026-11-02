import { describe, it, expect } from 'vitest';
import { resolveArrival } from './medical';

describe('llegada del paciente', () => {
  it('turnos viejos marcados como asistió figuran como llegó', () => {
    expect(resolveArrival({ asistio: true })).toBe('arrived');
    expect(resolveArrival({ asistio: false })).toBe(null);
  });
  it('el estado nuevo manda sobre el viejo', () => {
    expect(resolveArrival({ arrivalState: 'late', asistio: false })).toBe('late');
    expect(resolveArrival({ arrivalState: null, asistio: true })).toBe('arrived');
  });
});
