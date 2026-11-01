export type StudyStatus = 'pending' | 'in-study' | 'reported' | 'sent' | 'cancelled' | 'no-show';

/** Turno cancelado o ausente: se marca, no se borra, y libera el horario. */
export function isInactiveStatus(status: string): boolean {
  return status === 'cancelled' || status === 'no-show';
}

export type StudyType = string;

export interface Patient {
  id: string;
  dni: string;
  name: string;
  age: number;
  phone: string;
  fechaNacimiento?: string; // ISO date
  obraSocial?: string;
  dniTipo?: string; // 'DNI' | 'PASAPORTE' | 'OTRO'
  dniMaterno?: boolean; // recién nacido que usa el DNI de la madre
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
  doctorId?: string | null; // médico asignado al turno (los turnos viejos no tienen)
}

export function normalizeDni(dni?: string | null): string {
  return (dni || '').toUpperCase().replace(/[\s.\-_/]/g, '').trim();
}

/** Al escribir el DNI: sin puntos, espacios ni guiones, sin importar cómo se tipee. Conserva letras (documentos extranjeros). */
export function cleanDniInput(value: string): string {
  return value.toUpperCase().replace(/[\s.\-_/]/g, '');
}

/** Teléfono: característica por defecto de Argentina (celular), modificable. */
export const PHONE_DEFAULT_PREFIX = '+549';
export function cleanPhoneInput(value: string): string {
  return value.replace(/[\s.\-()]/g, '');
}
/** Hay un número real si, además de la característica, quedan más de 4 dígitos. */
export function hasPhoneNumber(value: string): boolean {
  return value.replace(/\D/g, '').length > 6;
}
/** Qué se guarda: vacío si solo quedó la característica por defecto. */
export function phoneToSave(value: string): string {
  const v = cleanPhoneInput(value);
  return hasPhoneNumber(v) ? v : '';
}

/** Arma el nombre completo: primero apellido, después nombres. */
export function composePatientName(apellido: string, nombres: string): string {
  return `${apellido.trim()} ${nombres.trim()}`.replace(/\s+/g, ' ').trim();
}

/** DNI que sirve para reconocer a la persona. Un recién nacido con DNI de la madre NO se une con ella. */
export function identityDni(patient: Pick<Patient, 'dni' | 'dniMaterno'>): string {
  return patient.dniMaterno ? '' : normalizeDni(patient.dni);
}

export const DNI_TIPOS: { value: string; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'OTRO', label: 'Otro documento' },
];

export function getPatientHistoryKey(patient: Pick<Patient, 'id' | 'dni' | 'dniMaterno'>): string {
  const normalizedDni = identityDni(patient);
  return normalizedDni ? `dni:${normalizedDni}` : `patient:${patient.id}`;
}

export const STUDY_TYPES: string[] = [
  'Ecografía Abdominal',
  'Ecografía Hepatobiliopancreática (Abdomen Superior)',
  'Ecografía Tiroidea',
  'Ecografía Obstétrica',
  'Ecografía Pélvica',
  'Ecografía Renal',
  'Ecografía Mamaria',
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
  'Eco Doppler Venoso MMII (TVP)',
  'Eco Doppler Venoso MMII (Insuficiencia / Mapeo)',
  'Eco Doppler Arterial MMSS',
  'Eco Doppler Venoso MMSS',
  'Test de Función Endotelial',
];

export const STATUS_LABELS: Record<StudyStatus, string> = {
  'pending': 'Pendiente',
  'in-study': 'En estudio',
  'reported': 'Reportado',
  'sent': 'Enviado',
  'cancelled': 'Cancelado',
  'no-show': 'Ausente',
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
/** Abreviaturas que se escriben completas en cualquier lugar donde se muestre el nombre del estudio. */
const STUDY_ABBREVIATIONS: [RegExp, string][] = [
  [/^ECO DOPPLER\b/, 'DOPPLER'],
  [/^ECO\b(?!GRAF)/, 'ECOGRAFÍA'],
  [/\bMMII\b/g, 'DE MIEMBROS INFERIORES'],
  [/\bMMSS\b/g, 'DE MIEMBROS SUPERIORES'],
  [/\bTVP\b/g, 'TROMBOSIS VENOSA PROFUNDA'],
  [/\bTSA\b/g, 'TRONCOS SUPRAAÓRTICOS'],
  [/\bTN\b/g, 'TRANSLUCENCIA NUCAL'],
  [/\bTV\b/g, 'TRANSVAGINAL'],
  [/\bABD\.?(?=\s|$)/g, 'ABDOMINAL'],
];

/** Nombre completo del estudio: mayúscula y sin abreviar (los estudios viejos guardados abreviados también se ven completos). */
export function expandStudyName(name: string): string {
  let out = name.toUpperCase().replace(/\s+/g, ' ').trim();
  for (const [re, full] of STUDY_ABBREVIATIONS) out = out.replace(re, full);
  return out.replace(/\s+/g, ' ').trim();
}

/** El protocolo (TVP, Insuficiencia/Mapeo) solo orienta al médico qué plantilla usar: no va en el título del estudio. */
export function studyTitle(name: string): string {
  return expandStudyName(name.replace(/\s*\((TVP|Insuficiencia\s*\/\s*Mapeo)\)/gi, ''));
}

/** Protocolo entre paréntesis (solo identificativo para el médico), si lo tiene. */
export function studyProtocol(name: string): string {
  const m = name.match(/\((TVP|Insuficiencia\s*\/\s*Mapeo)\)/i);
  if (!m) return '';
  return m[1].toUpperCase() === 'TVP' ? 'Protocolo: trombosis venosa profunda' : 'Protocolo: insuficiencia venosa / mapeo';
}

export function formatStudyType(studyType: string): string {
  const parts = studyType.split(/\s*\+\s*/).map(s => studyTitle(s)).filter(Boolean);
  if (parts.length <= 1) return parts[0] || studyType.toUpperCase();
  if (parts.length === 2) return `${parts[0]} Y ${parts[1]}`;
  return parts.slice(0, -1).join(', ') + ' Y ' + parts[parts.length - 1];
}
