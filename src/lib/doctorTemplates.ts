import { supabase } from '@/integrations/supabase/client';
import { docxToText } from '@/lib/import/studyParser';

export interface DoctorTemplate {
  id: string;
  name: string;
  studyType: string | null;
  content: string; // HTML
}

type Row = { id: string; name: string; study_type: string | null; content: string };
const toTemplate = (r: Row): DoctorTemplate => ({ id: r.id, name: r.name, studyType: r.study_type, content: r.content });

// La tabla es nueva: el cliente generado puede no conocerla todavía, por eso el acceso va sin tipos.
const table = () => (supabase as unknown as { from: (t: string) => any }).from('doctor_templates');

/** Plantillas propias del médico que está usando la app (la base de datos solo devuelve las suyas). */
export async function fetchMyTemplates(): Promise<DoctorTemplate[]> {
  const { data, error } = await table().select('id,name,study_type,content').order('name');
  if (error) throw error;
  return ((data || []) as Row[]).map(toTemplate);
}

export async function saveMyTemplate(t: { name: string; studyType: string | null; content: string }): Promise<void> {
  const { error } = await table().insert({ name: t.name.trim(), study_type: t.studyType, content: t.content });
  if (error) throw error;
}

export async function deleteMyTemplate(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id);
  if (error) throw error;
}

/** Plantillas propias que corresponden a alguno de los estudios del turno. */
export function templatesForStudy(own: DoctorTemplate[], studyType: string): DoctorTemplate[] {
  const parts = studyType.split(' + ').map((s) => s.trim()).filter(Boolean);
  return own.filter((t) => t.studyType && parts.includes(t.studyType));
}

/** Texto de un archivo .docx o de texto plano (.txt). Drive: descargarlo primero como Word. */
export async function textFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return docxToText(file);
  if (name.endsWith('.txt') || file.type.startsWith('text/')) return file.text();
  throw new Error('Formato no admitido. Usá un archivo Word (.docx) o de texto (.txt).');
}
