/** Funciones puras de la exportación por fechas (se prueban aparte de la pantalla). */
import { safeName } from '@/lib/backup/backupHelpers';

export const STATUS_ES: Record<string, string> = {
  pending: 'Pendiente', 'in-study': 'En estudio', reported: 'Reportado', sent: 'Enviado', cancelled: 'Cancelado', 'no-show': 'Ausente',
};
export const ARRIVAL_ES: Record<string, string> = { arrived: 'Llegó', late: 'Demorado / avisó', missed: 'No llegó' };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type Preset = 'hoy' | 'semana' | 'mes' | 'mes_pasado';

/** Rango de fechas (YYYY-MM-DD) para los botones rápidos. La semana va de lunes a domingo. */
export function rangeFor(preset: Preset, today = new Date()): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === 'hoy') return { from: iso(t), to: iso(t) };
  if (preset === 'semana') {
    const dow = (t.getDay() + 6) % 7; // lunes = 0
    const mon = new Date(t); mon.setDate(t.getDate() - dow);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: iso(mon), to: iso(sun) };
  }
  if (preset === 'mes') return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
  return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
}

export function ageFrom(p: { fecha_nacimiento?: string | null; age?: number | null } | undefined, ref = new Date()): number | '' {
  if (!p) return '';
  if (p.fecha_nacimiento) {
    const b = new Date(p.fecha_nacimiento + 'T00:00:00');
    if (!isNaN(b.getTime())) {
      let a = ref.getFullYear() - b.getFullYear();
      const m = ref.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) a--;
      return a;
    }
  }
  return p.age ?? '';
}

export function pdfFileName(a: { id: string; date: string; study_type: string }, patientName: string): string {
  return `${a.date}_${safeName(patientName, 40)}_${safeName(a.study_type, 30)}_${a.id.slice(0, 8)}.pdf`;
}

export interface ExportRow {
  fecha: string; hora: string; paciente: string; dni: string; edad: number | ''; obraSocial: string; telefono: string;
  estudio: string; medico: string; firmo: string; estado: string; llegada: string; observaciones: string; pdf: string;
}

export function buildRows(
  appts: any[], patients: Record<string, any>, names: Record<string, string>, pdfAvailable: Set<string>,
): ExportRow[] {
  return [...appts]
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))
    .map((a) => {
      const p = patients[a.patient_id];
      const arrival = a.arrival_state ?? (a.asistio ? 'arrived' : null);
      const hasPdf = pdfAvailable.has(`informe_${a.id}.pdf`);
      return {
        fecha: a.date, hora: (a.time || '').slice(0, 5), paciente: p?.name || '', dni: p?.dni || '', edad: ageFrom(p),
        obraSocial: p?.obra_social || '', telefono: p?.phone || '', estudio: a.study_type || '',
        medico: (a.doctor_id && names[a.doctor_id]) || '', firmo: (a.reported_by && names[a.reported_by]) || '',
        estado: STATUS_ES[a.status] || a.status || '', llegada: arrival ? ARRIVAL_ES[arrival] || arrival : '',
        observaciones: a.observations || '', pdf: hasPdf ? `informes_pdf/${pdfFileName(a, p?.name || 'paciente')}` : '',
      };
    });
}

/** Cuenta cuántos hay de cada valor de un campo, de mayor a menor. */
export function countBy(rows: ExportRow[], key: keyof ExportRow, empty = '(sin dato)'): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) { const k = String(r[key] || empty); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
