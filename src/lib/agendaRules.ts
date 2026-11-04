import { getStudyDuration, isInactiveStatus } from '@/types/medical';

/**
 * REGLA DE LA AGENDA: un estudio de 2 turnos (Doppler, morfológica, TN, scan fetal, test endotelial)
 * ocupa su horario y el siguiente. Solo se puede dar si el siguiente está libre, y ese segundo turno
 * queda bloqueado para cualquier otro turno. La única excepción es el sobreturno, que se atiende
 * por encima de la agenda.
 * La misma regla está en la base de datos (función enforce_double_slot) como última barrera.
 */
export const SLOT_MIN = 10;

export interface SlottedAppointment {
  id: string;
  time: string;
  studyType: string;
  status: string;
  doctorId?: string | null;
  esSobreturno?: boolean;
}

export interface PlacementResult {
  ok: boolean;
  code?: 'next_taken' | 'no_next_slot' | 'inside_other';
  slot?: string;
  message: string; // vacío si ok
}

/** Cantidad de turnos que ocupa un estudio (la regla de qué estudios son dobles está en getStudyDuration). */
export function slotsNeeded(studyType: string, interval: number = SLOT_MIN): number {
  return Math.max(1, Math.ceil(getStudyDuration(studyType, interval) / interval));
}

export function toMinutes(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function addMinutes(t: string, n: number): string {
  return fromMinutes(toMinutes(t) + n);
}

const sameDoctor = (a?: string | null, b?: string | null) => !a || !b || a === b;

/**
 * ¿Se puede poner este estudio en este horario?
 * `existing` = los turnos de ese día. `validSlots` (opcional) = horarios reales de la agenda del médico:
 * si se pasa, el horario siguiente tiene que existir en ella.
 */
export function checkPlacement(
  existing: SlottedAppointment[],
  p: {
    id?: string;
    time: string;
    studyType: string;
    doctorId?: string | null;
    sobreturno?: boolean;
    validSlots?: string[];
    interval?: number;
  },
): PlacementResult {
  if (p.sobreturno) return { ok: true, message: '' };
  const interval = p.interval ?? SLOT_MIN;
  const others = existing.filter(
    (a) => a.id !== p.id && !isInactiveStatus(a.status) && !a.esSobreturno && sameDoctor(a.doctorId, p.doctorId),
  );
  const start = toMinutes(p.time);

  // 1) El horario elegido no puede ser el segundo turno de otro estudio doble.
  for (const o of others) {
    const n = slotsNeeded(o.studyType, interval);
    const os = toMinutes(o.time);
    if (n > 1 && start > os && start < os + n * interval) {
      return {
        ok: false, code: 'inside_other', slot: o.time,
        message: `Las ${p.time} es el segundo turno de un estudio de 2 turnos que empieza a las ${o.time}. Elegí otro horario o usá Sobreturno.`,
      };
    }
  }

  // 2) Si este estudio es doble, los turnos siguientes tienen que existir y estar libres.
  const needed = slotsNeeded(p.studyType, interval);
  for (let i = 1; i < needed; i++) {
    const slot = fromMinutes(start + i * interval);
    if (p.validSlots && p.validSlots.length > 0 && !p.validSlots.includes(slot)) {
      return {
        ok: false, code: 'no_next_slot', slot,
        message: `Este estudio ocupa 2 turnos y a las ${slot} no hay horario en la agenda del médico. Elegí un horario anterior.`,
      };
    }
    const taken = others.find((o) => {
      const os = toMinutes(o.time);
      const on = slotsNeeded(o.studyType, interval);
      return slot === o.time || (on > 1 && toMinutes(slot) > os && toMinutes(slot) < os + on * interval);
    });
    if (taken) {
      return {
        ok: false, code: 'next_taken', slot,
        message: `Este estudio ocupa 2 turnos y el horario de las ${slot} ya está ocupado. Elegí otro horario.`,
      };
    }
  }
  return { ok: true, message: '' };
}

/** Horarios que quedan bloqueados porque son el segundo turno de un estudio doble (para mostrarlos como ocupados). */
export function secondSlotsOf(existing: SlottedAppointment[], interval: number = SLOT_MIN): Set<string> {
  const out = new Set<string>();
  for (const o of existing) {
    if (isInactiveStatus(o.status) || o.esSobreturno) continue;
    const n = slotsNeeded(o.studyType, interval);
    for (let i = 1; i < n; i++) out.add(addMinutes(o.time, i * interval));
  }
  return out;
}
