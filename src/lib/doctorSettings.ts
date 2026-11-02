import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_STYLE, normalizeStyle, type ReportStyle } from '@/lib/reportStyle';

/** Plantilla por defecto de cada estudio: 'own:<id>' (una mía), 'app:<nombre>' (de la app). Sin entrada = preguntar. */
export type DefaultTemplates = Record<string, string>;

export interface DoctorSettings {
  style: ReportStyle;
  defaults: DefaultTemplates;
}

export const EMPTY_SETTINGS: DoctorSettings = { style: DEFAULT_STYLE, defaults: {} };

// Tabla nueva: acceso sin tipos generados.
const table = () => (supabase as unknown as { from: (t: string) => any }).from('doctor_settings');

export async function fetchMySettings(): Promise<DoctorSettings> {
  const { data, error } = await table().select('report_style,default_templates').maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_SETTINGS;
  const d = data.default_templates;
  return {
    style: normalizeStyle(data.report_style),
    defaults: d && typeof d === 'object' ? (d as DefaultTemplates) : {},
  };
}

export async function saveMySettings(s: DoctorSettings): Promise<void> {
  const { error } = await table().upsert({
    report_style: s.style,
    default_templates: s.defaults,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
