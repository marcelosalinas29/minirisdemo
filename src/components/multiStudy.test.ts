import { describe, it, expect } from 'vitest';
import { buildMultiStudyHtml } from './TemplateSuggestion';

describe('varios estudios en un turno', () => {
  it('cada estudio lleva su título en negrita y mayúscula', () => {
    const html = buildMultiStudyHtml('Ecografía Mamaria + Ecografía Transvaginal + Ecografía Renal');
    expect(html).toContain('<strong>ECOGRAFÍA MAMARIA</strong>');
    expect(html).toContain('<strong>ECOGRAFÍA TRANSVAGINAL</strong>');
    expect(html).toContain('<strong>ECOGRAFÍA RENAL</strong>');
    expect(html.indexOf('MAMARIA')).toBeLessThan(html.indexOf('TRANSVAGINAL'));
  });
});

describe('plantillas propias', () => {
  it('la plantilla propia reemplaza a la de la app para ese estudio', () => {
    const own = [{ id: '1', name: 'Mi mamaria', studyType: 'Ecografía Mamaria', content: '<p>MI TEXTO PROPIO</p>' }];
    const html = buildMultiStudyHtml('Ecografía Mamaria + Ecografía Renal', own);
    expect(html).toContain('MI TEXTO PROPIO');
    expect(html).toContain('<strong>ECOGRAFÍA RENAL</strong>');
  });
});
