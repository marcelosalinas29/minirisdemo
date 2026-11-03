import { supabase } from '@/integrations/supabase/client';
import { safeName, storagePathFromUrl, toCsv, dataUrlInfo } from './backupHelpers';

const db = supabase as any;
type Dir = FileSystemDirectoryHandle;

export interface BackupProgress { phase: string; done: number; total: number }
export interface BackupResult { copied: number; skipped: number; errors: string[]; tables: Record<string, number> }

async function sub(dir: Dir, path: string): Promise<{ dir: Dir; name: string }> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop() as string;
  let d = dir;
  for (const p of parts) d = await d.getDirectoryHandle(safeName(p, 120), { create: true });
  return { dir: d, name: safeName(name, 160) };
}

export async function exists(dir: Dir, path: string): Promise<boolean> {
  try {
    const { dir: d, name } = await sub(dir, path);
    const f = await (await d.getFileHandle(name)).getFile();
    return f.size > 0;
  } catch { return false; }
}

export async function writeFile(dir: Dir, path: string, data: Blob | string): Promise<void> {
  const { dir: d, name } = await sub(dir, path);
  const fh = await d.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  try { await w.write(data); } finally { await w.close(); }
}

export async function pool<T>(list: T[], size: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (next < list.length) { const i = next++; await fn(list[i]); }
  }));
}

export async function fetchAll(table: string, columns: string, order = 'id'): Promise<any[]> {
  const out: any[] = [];
  const PAGE = 1000;
  for (let page = 0; ; page++) {
    const { data, error } = await db.from(table).select(columns).order(order).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export async function listBucket(bucket: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    if (!data || data.length === 0) break;
    names.push(...data.filter((o) => o.id).map((o) => o.name)); // solo archivos
    if (data.length < 1000) break;
  }
  return names;
}

export async function runBackup(root: Dir, onProgress: (p: BackupProgress) => void): Promise<BackupResult> {
  const res: BackupResult = { copied: 0, skipped: 0, errors: [], tables: {} };
  const stamp = new Date().toISOString().slice(0, 10);

  // 1) Datos
  onProgress({ phase: 'Copiando los datos…', done: 0, total: 1 });
  const patients = await fetchAll('patients', '*');
  const appointments = await fetchAll('appointments', 'id, patient_id, study_type, status, date, time, report, observations, reported_by, asistio, arrival_state, created_at, created_by, doctor_id, image_urls');
  const previos = await fetchAll('estudios_previos', '*');
  const versions = await fetchAll('report_versions', '*').catch((e) => { res.errors.push(String(e.message)); return []; });
  const audit = await fetchAll('audit_log', '*').catch(() => []);
  const profiles = await fetchAll('profiles', 'user_id, full_name, email, specialty, license_numbers');
  const tables: Record<string, any[]> = { pacientes: patients, turnos: appointments, estudios_previos: previos, versiones_informe: versions, registro_actividad: audit, usuarios: profiles };
  for (const [name, rows] of Object.entries(tables)) {
    await writeFile(root, `datos/${name}_${stamp}.json`, JSON.stringify(rows));
    res.tables[name] = rows.length;
  }

  // Índice legible en Excel
  const pById = new Map(patients.map((p: any) => [p.id, p]));
  const pdfs = await listBucket('reports');
  const pdfSet = new Set(pdfs);
  await writeFile(root, `datos/indice_${stamp}.csv`, toCsv(
    ['Fecha', 'Hora', 'Paciente', 'DNI', 'Estudio', 'Estado', 'Imágenes', 'PDF del informe'],
    appointments.map((a: any) => {
      const p: any = pById.get(a.patient_id) || {};
      return [a.date, a.time, p.name, p.dni, a.study_type, a.status, (a.image_urls || []).length, pdfSet.has(`informe_${a.id}.pdf`) ? `informes_pdf/informe_${a.id}.pdf` : ''];
    }),
  ));

  // 2) Lista de archivos a copiar
  type Job = { bucket: string; path: string; dest: string };
  const jobs: Job[] = pdfs.map((n) => ({ bucket: 'reports', path: n, dest: `informes_pdf/${n}` }));
  for (const a of appointments as any[]) {
    for (const url of a.image_urls || []) {
      const path = storagePathFromUrl(url, 'estudios_imagenes');
      if (path) jobs.push({ bucket: 'estudios_imagenes', path, dest: `imagenes/${path}` });
    }
  }
  for (const e of previos as any[]) {
    if (e.archivo_path) jobs.push({ bucket: 'estudios_previos', path: e.archivo_path, dest: `estudios_previos/${e.archivo_path}` });
  }

  let done = 0;
  onProgress({ phase: 'Copiando archivos (PDF e imágenes)…', done, total: jobs.length });
  await pool(jobs, 3, async (j) => {
    try {
      if (await exists(root, j.dest)) { res.skipped++; return; }
      const { data, error } = await supabase.storage.from(j.bucket).download(j.path);
      if (error || !data) throw error || new Error('vacío');
      await writeFile(root, j.dest, data);
      res.copied++;
    } catch (e: any) {
      res.errors.push(`${j.bucket}/${j.path}: ${e?.message || 'error'}`);
    } finally {
      done++;
      if (done % 5 === 0 || done === jobs.length) onProgress({ phase: 'Copiando archivos (PDF e imágenes)…', done, total: jobs.length });
    }
  });

  // 3) Imágenes antiguas guardadas dentro de la base (base64), de a pocas
  const { data: legacyIds } = await db.from('appointments').select('id').not('images', 'eq', '[]');
  const legacy: string[] = (legacyIds || []).map((r: any) => r.id);
  let ld = 0;
  onProgress({ phase: 'Copiando imágenes antiguas…', done: 0, total: legacy.length });
  for (const id of legacy) {
    try {
      const { data } = await db.from('appointments').select('images').eq('id', id).single();
      const imgs: string[] = data?.images || [];
      for (let i = 0; i < imgs.length; i++) {
        const info = dataUrlInfo(imgs[i]);
        if (!info) continue;
        const dest = `imagenes_antiguas/${id}/${i + 1}.${info.ext}`;
        if (await exists(root, dest)) { res.skipped++; continue; }
        const bin = atob(info.base64);
        const bytes = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
        await writeFile(root, dest, new Blob([bytes]));
        res.copied++;
      }
    } catch (e: any) { res.errors.push(`imagen antigua ${id}: ${e?.message || 'error'}`); }
    onProgress({ phase: 'Copiando imágenes antiguas…', done: ++ld, total: legacy.length });
  }

  // 4) Explicación y errores
  await writeFile(root, 'LEEME.txt',
`Respaldo del sistema — generado el ${new Date().toLocaleString('es-AR')}

datos/            Datos completos en JSON (pacientes, turnos con el texto del informe, estudios previos,
                  versiones del informe, registro de actividad, usuarios) e indice_*.csv para abrir en Excel.
informes_pdf/     PDF de cada informe (informe_<id del turno>.pdf; el índice dice a qué paciente corresponde).
imagenes/         Imágenes de cada estudio, en una carpeta por turno.
estudios_previos/ Archivos importados de estudios anteriores.

Guardar este respaldo en dos lugares distintos (por ejemplo disco externo y Drive).
Si se vuelve a ejecutar sobre la misma carpeta, solo copia lo nuevo.
Contiene datos de pacientes: tratar como información confidencial.
`);
  if (res.errors.length) await writeFile(root, `errores_${stamp}.txt`, res.errors.join('\n'));
  return res;
}
