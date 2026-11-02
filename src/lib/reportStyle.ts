import { studyTitle } from '@/types/medical';

/** Estilo de informe de cada médico. Se guarda en su configuración y se aplica al cargar una plantilla. */
export interface ReportStyle {
  lineHeight: number; // 1.0 a 2.0 (1.6 = el de siempre)
  align: 'left' | 'justify' | 'center';
  titleBold: boolean; // título de cada estudio en negrita
  titleUpper: boolean; // título de cada estudio en mayúscula
  sectionBold: boolean; // líneas de sección en mayúscula (SISTEMA VENOSO PROFUNDO) en negrita
  labelBold: boolean; // etiquetas tipo "Hígado:" en negrita
  singleHeading: 'none' | 'informe' | 'estudio'; // un solo estudio: sin encabezado, "INFORME:" o el título del estudio
  gapBetweenStudies: number; // renglones vacíos entre estudios (varios estudios)
}

export const DEFAULT_STYLE: ReportStyle = {
  lineHeight: 1.6,
  align: 'left',
  titleBold: true,
  titleUpper: true,
  sectionBold: true,
  labelBold: true,
  singleHeading: 'none',
  gapBetweenStudies: 1,
};

export const STYLE_PRESETS: { name: string; description: string; style: ReportStyle }[] = [
  { name: 'Clásico', description: 'Como viene hoy la app', style: { ...DEFAULT_STYLE } },
  { name: 'Compacto', description: 'Más texto por hoja', style: { ...DEFAULT_STYLE, lineHeight: 1.15, gapBetweenStudies: 1 } },
  { name: 'Formal justificado', description: 'Texto justificado, "INFORME:" arriba', style: { ...DEFAULT_STYLE, lineHeight: 1.3, align: 'justify', singleHeading: 'informe' } },
  { name: 'Aireado', description: 'Más espacio entre renglones y estudios', style: { ...DEFAULT_STYLE, lineHeight: 2, gapBetweenStudies: 2 } },
  { name: 'Títulos de estudio', description: 'Cada estudio con su título también si es uno solo', style: { ...DEFAULT_STYLE, singleHeading: 'estudio' } },
];

export function normalizeStyle(raw: unknown): ReportStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReportStyle>;
  const lh = Number(r.lineHeight);
  return {
    lineHeight: lh >= 1 && lh <= 2.5 ? lh : DEFAULT_STYLE.lineHeight,
    align: r.align === 'justify' || r.align === 'center' ? r.align : 'left',
    titleBold: r.titleBold ?? DEFAULT_STYLE.titleBold,
    titleUpper: r.titleUpper ?? DEFAULT_STYLE.titleUpper,
    sectionBold: r.sectionBold ?? DEFAULT_STYLE.sectionBold,
    labelBold: r.labelBold ?? DEFAULT_STYLE.labelBold,
    singleHeading: r.singleHeading === 'informe' || r.singleHeading === 'estudio' ? r.singleHeading : 'none',
    gapBetweenStudies: Math.min(3, Math.max(0, Math.round(Number(r.gapBetweenStudies ?? DEFAULT_STYLE.gapBetweenStudies)))),
  };
}

/** Interlineado y alineación en cada párrafo (lo que lee el PDF). */
export function applyParagraphStyle(html: string, style: ReportStyle): string {
  const css = `line-height: ${style.lineHeight}; text-align: ${style.align}`;
  return html.replace(/<p(\s[^>]*)?>/g, (_m, attrs: string | undefined) => {
    const a = attrs || '';
    const withoutStyle = a.replace(/\sstyle="[^"]*"/, '');
    return `<p${withoutStyle} style="${css}">`;
  });
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Título de un estudio según el estilo del médico. */
export function studyHeadingHtml(studyType: string, style: ReportStyle): string {
  let t = studyTitle(studyType);
  if (!style.titleUpper) t = t.charAt(0) + t.slice(1).toLowerCase();
  const inner = style.titleBold ? `<strong>${esc(t)}</strong>` : esc(t);
  return `<p>${inner}</p>`;
}

/** Encabezado cuando hay un solo estudio ('' si el médico no quiere encabezado). */
export function singleHeadingHtml(studyType: string, style: ReportStyle): string {
  if (style.singleHeading === 'informe') return `<p>${style.titleBold ? '<strong>INFORME:</strong>' : 'INFORME:'}</p>`;
  if (style.singleHeading === 'estudio') return studyHeadingHtml(studyType, style);
  return '';
}

/** Separación entre estudios: renglones vacíos. */
export function studyGapHtml(style: ReportStyle): string {
  return '<p></p>'.repeat(Math.max(0, style.gapBetweenStudies));
}
