import { addMinutes, toMinutes } from '@/lib/agendaRules';

/** Horario semanal fijo de un médico. */
export interface WeeklyBlock { doctorId: string; dayOfWeek: number; startTime: string; endTime: string; active: boolean }
/** Excepción temporaria: 'block' cierra (todo el día si no tiene horas), 'open' abre un horario puntual. */
export interface ScheduleException {
  id: string; doctorId: string; kind: 'block' | 'open';
  dateFrom: string; dateTo: string; startTime: string | null; endTime: string | null; reason?: string | null;
}

export interface HoursContext { weekly: WeeklyBlock[]; exceptions: ScheduleException[]; blockedDates: { date: string }[] }

/** Día de la semana (0=domingo) de una fecha 'YYYY-MM-DD', sin problemas de zona horaria. */
export function dowOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

type Range = [number, number];

function subtract(ranges: Range[], cut: Range): Range[] {
  const out: Range[] = [];
  for (const [a, b] of ranges) {
    if (cut[1] <= a || cut[0] >= b) { out.push([a, b]); continue; }
    if (cut[0] > a) out.push([a, cut[0]]);
    if (cut[1] < b) out.push([cut[1], b]);
  }
  return out;
}

/** Tramos (en minutos) en que el médico atiende ese día: semanal + aperturas − bloqueos. */
export function workingRanges(doctorId: string, date: string, ctx: HoursContext): Range[] {
  if (ctx.blockedDates.some((b) => b.date === date)) return [];
  const dow = dowOf(date);
  let ranges: Range[] = ctx.weekly
    .filter((b) => b.doctorId === doctorId && b.active && b.dayOfWeek === dow)
    .map((b) => [toMinutes(b.startTime), toMinutes(b.endTime)] as Range);
  const todays = ctx.exceptions.filter((e) => e.doctorId === doctorId && date >= e.dateFrom && date <= e.dateTo);
  for (const e of todays.filter((x) => x.kind === 'open' && x.startTime && x.endTime)) {
    ranges.push([toMinutes(e.startTime!), toMinutes(e.endTime!)]);
  }
  for (const e of todays.filter((x) => x.kind === 'block')) {
    ranges = e.startTime && e.endTime ? subtract(ranges, [toMinutes(e.startTime), toMinutes(e.endTime)]) : [];
  }
  return ranges;
}

export function isWithinHours(doctorId: string, date: string, time: string, ctx: HoursContext): boolean {
  const t = toMinutes(time);
  return workingRanges(doctorId, date, ctx).some(([a, b]) => t >= a && t < b);
}

/** Horarios (cada `interval` min) en que el médico atiende ese día. */
export function slotsForDate(doctorId: string, date: string, ctx: HoursContext, interval = 10): string[] {
  const out = new Set<string>();
  for (const [a, b] of workingRanges(doctorId, date, ctx)) {
    for (let m = a; m < b; m += interval) out.add(addMinutes('00:00', m));
  }
  return [...out].sort();
}

/** Médicos que atienden en ese día y horario. */
export function doctorsAtSlot(doctorIds: string[], date: string, time: string, ctx: HoursContext): string[] {
  return doctorIds.filter((id) => isWithinHours(id, date, time, ctx));
}

/** ¿Atiende en todos los turnos que ocupa el estudio (time, time+10, ...)? Devuelve el primer horario que no. */
export function firstUncoveredSlot(doctorId: string, date: string, time: string, slots: number, ctx: HoursContext, interval = 10): string | null {
  for (let i = 0; i < slots; i++) {
    const t = addMinutes(time, i * interval);
    if (!isWithinHours(doctorId, date, t, ctx)) return t;
  }
  return null;
}
