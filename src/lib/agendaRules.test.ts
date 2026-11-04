import { describe, it, expect } from 'vitest';
import { checkPlacement, slotsNeeded, secondSlotsOf, type SlottedAppointment } from './agendaRules';

const A = (id: string, time: string, studyType: string, extra: Partial<SlottedAppointment> = {}): SlottedAppointment =>
  ({ id, time, studyType, status: 'pending', ...extra });

const SLOTS = ['15:00', '15:10', '15:20', '15:30', '15:40', '15:50', '16:00'];

describe('regla de 2 turnos', () => {
  it('reconoce los estudios dobles', () => {
    expect(slotsNeeded('Eco Doppler Venoso MMII')).toBe(2);
    expect(slotsNeeded('DOPPLER Y MAPEO')).toBe(2);
    expect(slotsNeeded('Ecografía Obstétrica Morfológica')).toBe(2);
    expect(slotsNeeded('Ecografía Abdominal + Doppler Renal')).toBe(2);
    expect(slotsNeeded('Ecografía de Partes Blandas')).toBe(1);
    expect(slotsNeeded('Ecografía Abdominal')).toBe(1);
  });

  it('un Doppler no entra si el turno siguiente está ocupado', () => {
    const day = [A('1', '15:10', 'Ecografía Abdominal')];
    const r = checkPlacement(day, { time: '15:00', studyType: 'Doppler Arterial', validSlots: SLOTS });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('next_taken');
  });

  it('un Doppler entra si el siguiente está libre', () => {
    const day = [A('1', '15:20', 'Ecografía Abdominal')];
    expect(checkPlacement(day, { time: '15:00', studyType: 'Doppler Arterial', validSlots: SLOTS }).ok).toBe(true);
  });

  it('el segundo turno de un Doppler queda bloqueado para cualquier estudio', () => {
    const day = [A('1', '15:00', 'Doppler Arterial')];
    const r = checkPlacement(day, { time: '15:10', studyType: 'Ecografía Abdominal', validSlots: SLOTS });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('inside_other');
    expect([...secondSlotsOf(day)]).toEqual(['15:10']);
  });

  it('el sobreturno puede ir en el segundo turno', () => {
    const day = [A('1', '15:00', 'Doppler Arterial')];
    expect(checkPlacement(day, { time: '15:10', studyType: 'Ecografía Abdominal', sobreturno: true }).ok).toBe(true);
  });

  it('un sobreturno ya cargado no bloquea al Doppler', () => {
    const day = [A('1', '15:10', 'Ecografía Abdominal', { esSobreturno: true })];
    expect(checkPlacement(day, { time: '15:00', studyType: 'Doppler Arterial', validSlots: SLOTS }).ok).toBe(true);
  });

  it('un turno cancelado libera el horario', () => {
    const day = [A('1', '15:10', 'Ecografía Abdominal', { status: 'cancelled' })];
    expect(checkPlacement(day, { time: '15:00', studyType: 'Doppler Arterial', validSlots: SLOTS }).ok).toBe(true);
  });

  it('cambiar un turno a Doppler (mismo horario) se revisa contra el siguiente, sin contarse a sí mismo', () => {
    const day = [A('1', '15:00', 'Ecografía de Partes Blandas'), A('2', '15:10', 'Ecografía Abdominal')];
    expect(checkPlacement(day, { id: '1', time: '15:00', studyType: 'Doppler de Partes Blandas', validSlots: SLOTS }).ok).toBe(false);
    expect(checkPlacement([A('1', '15:00', 'Ecografía de Partes Blandas')], { id: '1', time: '15:00', studyType: 'Doppler de Partes Blandas', validSlots: SLOTS }).ok).toBe(true);
  });

  it('reprogramar: el mismo turno no se bloquea a sí mismo', () => {
    const day = [A('1', '15:00', 'Doppler Arterial')];
    expect(checkPlacement(day, { id: '1', time: '15:10', studyType: 'Doppler Arterial', validSlots: SLOTS }).ok).toBe(true);
  });

  it('un Doppler en el último horario de la agenda no entra (no hay turno siguiente)', () => {
    const r = checkPlacement([], { time: '16:00', studyType: 'Doppler Arterial', validSlots: SLOTS });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('no_next_slot');
  });

  it('dos Doppler seguidos: el segundo tiene que ir 20 minutos después', () => {
    const day = [A('1', '15:00', 'Doppler Arterial')];
    expect(checkPlacement(day, { time: '15:10', studyType: 'Doppler Venoso', validSlots: SLOTS }).ok).toBe(false);
    expect(checkPlacement(day, { time: '15:20', studyType: 'Doppler Venoso', validSlots: SLOTS }).ok).toBe(true);
  });

  it('un Doppler tampoco entra si el siguiente es el segundo turno de otro Doppler', () => {
    const day = [A('1', '15:10', 'Doppler Arterial')];
    // 15:00 + 15:10 -> 15:10 está ocupado por el otro Doppler
    expect(checkPlacement(day, { time: '15:00', studyType: 'Doppler Venoso', validSlots: SLOTS }).ok).toBe(false);
  });

  it('turnos de otro médico no interfieren', () => {
    const day = [A('1', '15:10', 'Ecografía Abdominal', { doctorId: 'dr-b' })];
    expect(checkPlacement(day, { time: '15:00', studyType: 'Doppler Arterial', doctorId: 'dr-a', validSlots: SLOTS }).ok).toBe(true);
  });
});
