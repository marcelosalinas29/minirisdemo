import { REPORT_TEMPLATES } from '@/data/reportTemplates';
import { suggestTemplates } from '@/data/studyTemplateMap';
import { textToHtml } from '@/components/TemplateSelector';
import type { DoctorTemplate } from '@/lib/doctorTemplates';
import type { DoctorSettings } from '@/lib/doctorSettings';
import { applyParagraphStyle, singleHeadingHtml, studyGapHtml, studyHeadingHtml, type ReportStyle } from '@/lib/reportStyle';

const parts = (studyType: string) => studyType.split(' + ').map((s) => s.trim()).filter(Boolean);

/** HTML de una plantilla de la app con las preferencias de formato del médico. */
export function appTemplateHtml(content: string, style: ReportStyle): string {
  return applyParagraphStyle(textToHtml(content, { sectionBold: style.sectionBold, labelBold: style.labelBold }), style);
}

/** Opciones de plantilla para un estudio: primero las mías de ese estudio, después las de la app. */
export function optionsForStudy(part: string, own: DoctorTemplate[]) {
  const mine = own.filter((o) => o.studyType === part).map((o) => ({ ref: `own:${o.id}`, name: o.name, own: true, html: o.content, content: '' }));
  const app = suggestTemplates(part)
    .filter((t) => !own.some((o) => o.name === t.name && o.studyType))
    .map((t) => ({ ref: `app:${t.name}`, name: t.name, own: false, html: '', content: t.content }));
  return [...mine, ...app];
}

function optionHtml(o: { own: boolean; html: string; content: string }, style: ReportStyle): string {
  return o.own ? applyParagraphStyle(o.html, style) : appTemplateHtml(o.content, style);
}

/** La plantilla por defecto de ese estudio, o la primera disponible si no hay por defecto. */
export function pickForStudy(part: string, own: DoctorTemplate[], settings: DoctorSettings) {
  const opts = optionsForStudy(part, own);
  if (opts.length === 0) return null;
  const ref = settings.defaults[part];
  return { opt: opts.find((o) => o.ref === ref) ?? opts[0], isDefault: !!opts.find((o) => o.ref === ref) };
}

/** ¿Se puede cargar sola? Solo si TODOS los estudios que tienen plantilla tienen una por defecto elegida. */
export function canAutoLoad(studyType: string, own: DoctorTemplate[], settings: DoctorSettings): boolean {
  const withTemplates = parts(studyType).filter((p) => optionsForStudy(p, own).length > 0);
  return withTemplates.length > 0 && withTemplates.every((p) => pickForStudy(p, own, settings)?.isDefault);
}

/** Informe armado con el estilo del médico: uno o varios estudios, cada uno con su título y su espacio. */
export function buildReportHtml(studyType: string, own: DoctorTemplate[], settings: DoctorSettings): string {
  const ps = parts(studyType);
  const style = settings.style;
  const blocks: string[] = [];
  for (const part of ps) {
    const pick = pickForStudy(part, own, settings);
    if (!pick) continue;
    const body = optionHtml(pick.opt, style);
    blocks.push(ps.length > 1 ? studyHeadingHtml(part, style) + body : singleHeadingHtml(part, style) + body);
  }
  return blocks.join(studyGapHtml(style));
}

export { optionHtml };
