export type StudyStatus = 'pending' | 'in-study' | 'reported' | 'sent';

export type StudyType = string;

export interface Patient {
  id: string;
  dni: string;
  name: string;
  age: number;
  phone: string;
  fechaNacimiento?: string; // ISO date
  obraSocial?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patient: Patient;
  studyType: string;
  status: StudyStatus;
  date: string; // ISO date
  time: string; // HH:mm
  report: string;
  images: string[]; // base64 data URLs (legacy)
  imageUrls: string[]; // Storage URLs (new)
  observations?: string;
  reportedBy?: string | null;
  asistio: boolean;
  createdAt: string;
}

export function normalizeDni(dni?: string | null): string {
  return (dni || '').toUpperCase().replace(/[\s.\-_/]/g, '').trim();
}

export function getPatientHistoryKey(patient: Pick<Patient, 'id' | 'dni'>): string {
  const normalizedDni = normalizeDni(patient.dni);
  return normalizedDni ? `dni:${normalizedDni}` : `patient:${patient.id}`;
}

export const STUDY_TYPES: string[] = [
  'Ecografía Abdominal',
  'Ecografía Tiroidea',
  'Ecografía Obstétrica',
  'Ecografía Pélvica',
  'Ecografía Renal',
  'Ecografía de Tejidos Blandos',
  'Ecografía Mamaria',
  'Ecografía Doppler',
  'Ecografía Vesical',
  'Ecografía Prostática',
  'Ecografía Vesical y Prostática',
  'Ecografía Transvaginal',
  'Ecografía Ginecológica',
  'Ecografía Mamaria y Transvaginal',
  'Ecografía Testicular',
  'Ecografía de Partes Blandas',
  'Ecografía Muscular',
  'Ecografía Articular',
  'Ecografía Doppler Venoso',
  'Ecografía Doppler Arterial',
  'Ecografía Doppler de Vasos de Cuello',
  'Ecografía Mamaria y Ginecológica TV',
  'Ecografía Renal y Vesicoprostática',
  'Ecografía Cerebral',
  'Ecografía de Caderas',
  'Ecografía de Hombro',
  'TN y Doppler Uterino',
  'Scan Fetal',
  'Doppler Materno-Fetal',
  'Eco Doppler Aorta Abdominal',
  'Eco Doppler Arterias Renales',
  'Eco Doppler Hepático',
  'Eco Doppler TSA',
  'Eco Doppler Sustancia Nigra',
  'Eco Doppler Arterial MMII',
  'Eco Doppler Venoso MMII',
  'Eco Doppler Arterial MMSS',
  'Test de Función Endotelial',
];

export const STATUS_LABELS: Record<StudyStatus, string> = {
  'pending': 'Pendiente',
  'in-study': 'En estudio',
  'reported': 'Reportado',
  'sent': 'Enviado',
};

/** Calculate age in years from birth date (legacy, returns number of years) */
export function calcularEdad(fechaNacimiento: string | Date): number {
  const birth = new Date(fechaNacimiento);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export type EdadUnit = 'días' | 'semanas' | 'meses' | 'años';
export interface EdadDetallada {
  value: number;
  unit: EdadUnit;
}

/**
 * Calendar-exact age with smart unit:
 *  < 7 días → días
 *  7 días a < 1 mes → semanas
 *  1 mes a < 1 año → meses
 *  ≥ 1 año → años
 */
export function calcularEdadDetallada(fechaNacimiento: string | Date): EdadDetallada {
  const birth = typeof fechaNacimiento === 'string'
    ? (() => {
        const [y, m, d] = fechaNacimiento.split('T')[0].split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      })()
    : new Date(fechaNacimiento);
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const birthMid = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());

  // Years (calendar-exact)
  let years = todayMid.getFullYear() - birthMid.getFullYear();
  const monthDiff = todayMid.getMonth() - birthMid.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && todayMid.getDate() < birthMid.getDate())) {
    years--;
  }
  if (years >= 1) return { value: years, unit: 'años' };

  // Months (calendar-exact)
  let months = (todayMid.getFullYear() - birthMid.getFullYear()) * 12 + (todayMid.getMonth() - birthMid.getMonth());
  if (todayMid.getDate() < birthMid.getDate()) months--;
  if (months >= 1) return { value: months, unit: 'meses' };

  // Days
  const days = Math.max(0, Math.floor((todayMid.getTime() - birthMid.getTime()) / 86400000));
  if (days >= 7) return { value: Math.floor(days / 7), unit: 'semanas' };
  return { value: days, unit: 'días' };
}

/** Formatted string e.g. "3 meses", "44 años" */
export function formatEdad(fechaNacimiento?: string | Date | null, fallbackYears?: number): string {
  if (fechaNacimiento) {
    const e = calcularEdadDetallada(fechaNacimiento);
    return `${e.value} ${e.unit}`;
  }
  if (typeof fallbackYears === 'number') return `${fallbackYears} años`;
  return '';
}

/** 
 * Calculate study duration in minutes based on study type.
 * Doppler / Obstétrica Morfológica / Obstétrica TN / Scan Fetal → 20 min
 * Combinados con Doppler → 20 min
 * Otherwise → uses the doctor's base interval (default 10)
 */
export function getStudyDuration(studyType: string, baseInterval: number = 10): number {
  if (!studyType) return baseInterval;
  const upper = studyType.toUpperCase();
  const parts = upper.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean);

  const isSpecial = (s: string) =>
    s.includes('DOPPLER') ||
    s.includes('MORFOLÓGICA') ||
    s.includes('MORFOLOGICA') ||
    s.includes(' TN') ||
    s.startsWith('TN ') ||
    s === 'TN' ||
    s.includes('SCAN FETAL') ||
    s.includes('DOPPLER MATERNO') ||
    s.includes('TEST DE FUNCIÓN ENDOTELIAL') ||
    s.includes('TEST DE FUNCION ENDOTELIAL');

  if (parts.some(isSpecial)) return 20;
  return baseInterval;
}

/** Format study type string: replace "+" with "," and last with "y" */
export function formatStudyType(studyType: string): string {
  const parts = studyType.split(/\s*\+\s*/).map(s => s.trim().toUpperCase()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || studyType.toUpperCase();
  if (parts.length === 2) return `${parts[0]} Y ${parts[1]}`;
  return parts.slice(0, -1).join(', ') + ' Y ' + parts[parts.length - 1];
}
