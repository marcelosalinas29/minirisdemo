import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { Blob as NodeBlob } from 'node:buffer';
import { listZipEntries, readZipEntry } from './zipReader';
import { docxToText, parseReportText, parseFileName, looksLikeAppBackup, matchPatients, sha256Hex } from './studyParser';

const blob = (f: string) => new NodeBlob([readFileSync(`src/lib/import/__fixtures__/${f}`)]) as unknown as Blob;

describe('importador', () => {
  it('lista y extrae un zip con carpetas y compresión', async () => {
    const b = blob('carpeta.zip');
    const entries = await listZipEntries(b);
    expect(entries.map((e) => e.name).sort()).toEqual([
      'NOVIEMBRE 2019/PDF - GOMEZ LAURA MAMA 2026.pdf',
      'NOVIEMBRE 2019/PEREZ JUAN CARLOS - abd.docx',
      'NOVIEMBRE 2019/notas.txt',
    ]);
    const txt = entries.find((e) => e.name.endsWith('notas.txt'))!;
    const bytes = await readZipEntry(b, txt);
    expect(bytes.length).toBe(5000);
  });
  it('lee el .docx dentro del zip y extrae paciente/fecha/estudio', async () => {
    const b = blob('carpeta.zip');
    const e = (await listZipEntries(b)).find((x) => x.name.endsWith('.docx'))!;
    const docBlob = new NodeBlob([await readZipEntry(b, e)]) as unknown as Blob;
    const text = await docxToText(docBlob);
    const p = parseReportText(text)!;
    expect(p.paciente).toBe('PEREZ JUAN CARLOS');
    expect(p.fecha).toBe('2019-11-29');
    expect(p.estudio).toBe('ECOGRAFIA ABDOMINAL');
  });
  it('nombre de archivo', () => {
    expect(parseFileName('NOVIEMBRE 2019/ZORAT GERMAN - pb.docx')).toMatchObject({ paciente: 'ZORAT GERMAN', estudio: 'pb' });
    expect(looksLikeAppBackup('PDF - SOSA NELIDA.pdf')).toBe(true);
    expect(looksLikeAppBackup('SOSA NELIDA - abd.docx')).toBe(false);
  });
  it('coincidencias', () => {
    const pats = [
      { id: '1', name: 'Pérez Juan Carlos', dni: '12345678' },
      { id: '2', name: 'Juan Carlos Gómez', dni: '' },
      { id: '3', name: 'Pérez Juan', dni: '' },
    ];
    expect(matchPatients('PEREZ JUAN CARLOS', '', pats).kind).toBe('exacto');
    expect(matchPatients('GOMEZ JUAN CARLOS', '', pats).kind).toBe('otro-orden');
    expect(matchPatients('PEREZ JUAN CARLOS ANDRES', '', pats).kind).toBe('posible');
    expect(matchPatients('LOPEZ MARIA', '', pats).kind).toBe('ninguno');
    expect(matchPatients('NOMBRE DISTINTO', '12.345.678', pats).candidates[0].id).toBe('1');
  });
  it('hash estable', async () => {
    const h1 = await sha256Hex(blob('informe.docx'));
    const h2 = await sha256Hex(blob('informe.docx'));
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
});
