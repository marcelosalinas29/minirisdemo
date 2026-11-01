import { REPORT_TEMPLATES } from '@/data/reportTemplates';

/** Tipo de estudio -> nombres de plantillas candidatas. Solo relaciones claras; el médico siempre confirma. */
const MAP: Record<string, string[]> = {
  'Ecografía Abdominal': ['Ecografía Abdominal'],
  'Ecografía Hepatobiliopancreática (Abdomen Superior)': ['Ecografía Hepatobiliopancreática'],
  'Ecografía Renal': ['Ecografía Renal'],
  'Ecografía Renal y Vesicoprostática': ['Renal y Vesicoprostática'],
  'Ecografía Tiroidea': ['Ecografía Tiroidea'],
  'Ecografía Mamaria': ['Ecografía Mamaria'],
  'Ecografía Transvaginal': ['Ginecológica TV'],
  'Ecografía Ginecológica': ['Ginecológica TV'],
  'Ecografía Mamaria y Transvaginal': ['Mamaria y Ginecológica TV'],
  'Ecografía Mamaria y Ginecológica TV': ['Mamaria y Ginecológica TV'],
  'Ecografía Obstétrica': ['Obstétrica 1er Trimestre', 'Ecografía Obstétrica'],
  'TN y Doppler Uterino': ['TN y Doppler Uterino'],
  'Scan Fetal': ['Scan Fetal'],
  'Doppler Materno-Fetal': ['Doppler Maternofetal'],
  'Ecografía Testicular': ['Ecografía Testicular'],
  'Ecografía Muscular': ['Ecografía Muscular'],
  'Ecografía Cerebral': ['Ecografía Cerebral'],
  'Ecografía de Caderas': ['Ecografía de Caderas'],
  'Ecografía de Hombro': ['Ecografía de Hombro'],
  'Eco Doppler Aorta Abdominal': ['Ecodoppler Aorta Abdominal'],
  'Eco Doppler Arterias Renales': ['Ecodoppler Arterias Renales'],
  'Eco Doppler Hepático': ['Doppler Hepático'],
  'Eco Doppler TSA': ['Ecodoppler TSA (Vasos de Cuello)'],
  'Ecografía Doppler de Vasos de Cuello': ['Ecodoppler TSA (Vasos de Cuello)'],
  'Eco Doppler Sustancia Nigra': ['Eco Doppler Sustancia Nigra'],
  'Eco Doppler Arterial MMII': ['Doppler Arterial MMII'],
  'Eco Doppler Arterial MMSS': ['Doppler Arterial MMSS'],
  'Eco Doppler Venoso MMII': ['Doppler Venoso MMII (Completo)', 'Doppler Venoso MMII (TVP)', 'MIV (Mapeo Insuf. Venosa)'],
  'Eco Doppler Venoso MMII (TVP)': ['Doppler Venoso MMII (TVP)'],
  'Eco Doppler Venoso MMII (Insuficiencia / Mapeo)': ['Doppler Venoso MMII (Insuficiencia / Mapeo)', 'MIV (Mapeo Insuf. Venosa)'],
  'Test de Función Endotelial': ['Test Función Endotelial'],
};

/** Plantillas sugeridas para un tipo de estudio (puede ser varios unidos con " + "). */
export function suggestTemplates(studyType: string) {
  const names: string[] = [];
  for (const part of studyType.split(' + ')) {
    for (const n of MAP[part.trim()] || []) if (!names.includes(n)) names.push(n);
  }
  return REPORT_TEMPLATES.filter((t) => names.includes(t.name));
}
