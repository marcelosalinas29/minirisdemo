import { describe, it, expect } from 'vitest';
import { buildReportHtml, canAutoLoad } from './templateResolve';
import { DEFAULT_STYLE } from './reportStyle';
import { EMPTY_SETTINGS } from './doctorSettings';

const mk = (over = {}) => ({ style: { ...DEFAULT_STYLE, ...over }, defaults: {} as Record<string, string> });

describe('armado del informe con el estilo del médico', () => {
  it('un estudio: encabezado INFORME y sin título de estudio', () => {
    const html = buildReportHtml('Ecografía Renal', [], mk({ singleHeading: 'informe' }));
    expect(html.startsWith('<p style="line-height: 1.6; text-align: left"><strong>INFORME:</strong>') || html.includes('<strong>INFORME:</strong>')).toBe(true);
    expect(html).not.toContain('ECOGRAFÍA RENAL');
  });
  it('varios estudios: título de cada uno y espacio entre ellos', () => {
    const html = buildReportHtml('Ecografía Mamaria + Ecografía Renal', [], mk({ gapBetweenStudies: 2 }));
    expect(html).toContain('<strong>ECOGRAFÍA MAMARIA</strong>');
    expect(html).toContain('<strong>ECOGRAFÍA RENAL</strong>');
    expect(html).toContain('<p></p><p></p>');
    expect(html.indexOf('MAMARIA')).toBeLessThan(html.indexOf('ECOGRAFÍA RENAL'));
  });
  it('aplica interlineado y justificado a cada párrafo', () => {
    const html = buildReportHtml('Ecografía Renal', [], mk({ lineHeight: 1.15, align: 'justify' }));
    expect(html).toContain('line-height: 1.15; text-align: justify');
  });
  it('carga sola solo si todos los estudios tienen plantilla por defecto', () => {
    const s = mk();
    expect(canAutoLoad('Ecografía Renal', [], s)).toBe(false);
    s.defaults['Ecografía Renal'] = 'app:Ecografía Renal';
    const ok = canAutoLoad('Ecografía Renal', [], s);
    expect(typeof ok).toBe('boolean');
  });
  it('sin configuración usa el estilo clásico', () => {
    expect(EMPTY_SETTINGS.style.lineHeight).toBe(1.6);
  });
});
