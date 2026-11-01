import { describe, it, expect, vi } from 'vitest';
import { Blob as NodeBlob } from 'buffer';

const tables: Record<string, any[]> = {
  patients: [{ id: 'p1', name: 'PEREZ JUAN', dni: '123' }],
  appointments: [{ id: 'a1', patient_id: 'p1', study_type: 'Eco', status: 'sent', date: '2026-01-01', time: '08:00', report: 'x', image_urls: ['https://x/storage/v1/object/sign/estudios_imagenes/a1/1.jpg?token=t'], images: [] }],
  estudios_previos: [{ id: 'e1', archivo_path: 'p1/h_doc.pdf' }],
  report_versions: [], audit_log: [], profiles: [],
};
vi.mock('@/integrations/supabase/client', () => {
  const q = (name: string) => {
    const b: any = { select: () => b, order: () => b, not: () => ({ then: (r: any) => r({ data: [], error: null }) }), range: async (a: number) => ({ data: a === 0 ? tables[name] : [], error: null }) };
    return b;
  };
  return { supabase: {
    from: (n: string) => q(n),
    storage: { from: (bucket: string) => ({
      list: async (_p: string, o: any) => ({ data: bucket === 'reports' && o.offset === 0 ? [{ id: '1', name: 'informe_a1.pdf' }, { id: null, name: 'carpeta' }] : [], error: null }),
      download: async (path: string) => ({ data: new NodeBlob([`${bucket}:${path}`]), error: null }),
    }) },
  } };
});
import { runBackup } from './runBackup';

function memDir(files: Map<string, string>, prefix = ''): any {
  return {
    getDirectoryHandle: async (n: string) => memDir(files, `${prefix}${n}/`),
    getFileHandle: async (n: string, o?: any) => {
      const key = prefix + n;
      if (!o?.create && !files.has(key)) throw new Error('nf');
      return { getFile: async () => ({ size: (files.get(key) || '').length }), createWritable: async () => ({ write: async (d: any) => { files.set(key, typeof d === 'string' ? d : await d.text()); }, close: async () => {} }) };
    },
  };
}

describe('runBackup', () => {
  it('copia datos, PDF, imágenes y estudios previos; la segunda vez omite lo ya copiado', async () => {
    const files = new Map<string, string>();
    const r1 = await runBackup(memDir(files), () => {});
    expect(r1.errors).toEqual([]);
    expect(r1.copied).toBe(3);
    expect([...files.keys()]).toEqual(expect.arrayContaining(['informes_pdf/informe_a1.pdf', 'imagenes/a1/1.jpg', 'estudios_previos/p1/h_doc.pdf', 'LEEME.txt']));
    expect([...files.keys()].some((k) => k.startsWith('datos/indice_'))).toBe(true);
    expect([...files.entries()].find(([k]) => k.startsWith('datos/indice_'))![1]).toContain('informes_pdf/informe_a1.pdf');
    const r2 = await runBackup(memDir(files), () => {});
    expect(r2.copied).toBe(0);
    expect(r2.skipped).toBe(3);
  });
});
