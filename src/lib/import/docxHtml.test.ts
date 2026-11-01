import { describe, it, expect } from 'vitest';
import { docxXmlToHtml } from './studyParser';

const run = (t: string, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;

describe('docx a HTML con formato', () => {
  it('conserva negrita, cursiva, subrayado y alineación', () => {
    const xml = `<w:body><w:p><w:pPr><w:jc w:val="both"/></w:pPr>${run('Hígado: ', '<w:b/>')}${run('de tamaño normal')}</w:p>` +
      `<w:p>${run('Nota', '<w:i/><w:u w:val="single"/>')}</w:p><w:p></w:p><w:p>${run('No negrita', '<w:b w:val="0"/>')} ${run('A &amp; B &lt;x&gt;')}</w:p></w:body>`;
    const html = docxXmlToHtml(xml);
    expect(html).toContain('<p style="text-align: justify"><strong>Hígado: </strong>de tamaño normal</p>');
    expect(html).toContain('<em><u>Nota</u></em>');
    expect(html).toContain('<p>No negrita');
    expect(html).not.toContain('<strong>No negrita');
    expect(html).toContain('A &amp; B &lt;x&gt;');
  });
});
