import { supabase } from '@/integrations/supabase/client';
import { fetchAll, listBucket, writeFile, pool, type BackupProgress } from '@/lib/backup/runBackup';
import { buildRows, countBy, type ExportRow } from './exportHelpers';

const db = supabase as any;
export interface ExportResult { turnos: number; pdfsCopiados: number; sinPdf: number; errores: string[]; excel: string }

export async function runExport(root: FileSystemDirectoryHandle, from: string, to: string, onProgress: (p: BackupProgress) => void): Promise<ExportResult> {
  const res: ExportResult = { turnos: 0, pdfsCopiados: 0, sinPdf: 0, errores: [], excel: '' };

  onProgress({ phase: 'Leyendo los turnos…', done: 0, total: 1 });
  const appts: any[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db.from('appointments')
      .select('id, patient_id, study_type, status, date, time, observations, reported_by, asistio, arrival_state, doctor_id')
      .gte('date', from).lte('date', to).order('date').order('id').range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`turnos: ${error.message}`);
    appts.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const pids = Array.from(new Set(appts.map((a) => a.patient_id).filter(Boolean)));
  const patients: Record<string, any> = {};
  for (let i = 0; i < pids.length; i += 100) {
    const { data, error } = await db.from('patients').select('id, name, dni, age, phone, obra_social, fecha_nacimiento').in('id', pids.slice(i, i + 100));
    if (error) throw new Error(`pacientes: ${error.message}`);
    for (const p of data || []) patients[p.id] = p;
  }
  const profs = await fetchAll('profiles', 'user_id, full_name', 'user_id');
  const names: Record<string, string> = Object.fromEntries(profs.map((p: any) => [p.user_id, p.full_name]));

  const available = new Set(await listBucket('reports'));
  const rows = buildRows(appts, patients, names, available);
  res.turnos = rows.length;

  // PDF de los informes del período
  const pdfJobs = [...appts].sort((x, y) => `${x.date} ${x.time || ''}`.localeCompare(`${y.date} ${y.time || ''}`))
    .map((a, i) => ({ id: a.id, dest: rows[i].pdf })).filter((j) => j.dest);
  res.sinPdf = rows.length - pdfJobs.length;
  let done = 0;
  onProgress({ phase: 'Copiando los PDF de los informes…', done: 0, total: pdfJobs.length });
  await pool(pdfJobs, 4, async (j) => {
    try {
      const { data, error } = await supabase.storage.from('reports').download(`informe_${j.id}.pdf`);
      if (error || !data) throw new Error(error?.message || 'sin datos');
      await writeFile(root, j.dest, data);
      res.pdfsCopiados++;
    } catch (e: any) { res.errores.push(`${j.dest}: ${e?.message || 'error'}`); }
    done++;
    if (done % 5 === 0 || done === pdfJobs.length) onProgress({ phase: 'Copiando los PDF de los informes…', done, total: pdfJobs.length });
  });

  onProgress({ phase: 'Armando el Excel…', done: 0, total: 1 });
  const blob = await buildWorkbook(rows, from, to);
  res.excel = `turnos_${from}_a_${to}.xlsx`;
  await writeFile(root, res.excel, blob);
  return res;
}

async function buildWorkbook(rows: ExportRow[], from: string, to: string): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Turnos');
  ws.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Hora', key: 'hora', width: 8 }, { header: 'Paciente', key: 'paciente', width: 30 },
    { header: 'DNI', key: 'dni', width: 12 }, { header: 'Edad', key: 'edad', width: 7 }, { header: 'Obra social', key: 'obraSocial', width: 20 },
    { header: 'Teléfono', key: 'telefono', width: 15 }, { header: 'Estudio', key: 'estudio', width: 28 }, { header: 'Médico', key: 'medico', width: 24 },
    { header: 'Firmó el informe', key: 'firmo', width: 24 }, { header: 'Estado', key: 'estado', width: 13 }, { header: 'Llegada', key: 'llegada', width: 16 },
    { header: 'Observaciones', key: 'observaciones', width: 30 }, { header: 'Informe PDF', key: 'pdf', width: 14 },
  ];
  for (const r of rows) {
    const row = ws.addRow({ ...r, pdf: '' });
    if (r.pdf) row.getCell('pdf').value = { text: 'Abrir PDF', hyperlink: r.pdf } as any;
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'N1' };
  ws.eachRow((row, n) => { if (n > 1) row.getCell('pdf').font = { color: { argb: 'FF0563C1' }, underline: true }; });

  const rs = wb.addWorksheet('Resumen');
  rs.columns = [{ width: 34 }, { width: 12 }];
  rs.addRow([`Período: ${from} a ${to}`]).font = { bold: true };
  rs.addRow(['Total de turnos', rows.length]);
  const blocks: [string, keyof ExportRow][] = [['Por estado', 'estado'], ['Por tipo de estudio', 'estudio'], ['Por médico', 'medico'], ['Por obra social', 'obraSocial'], ['Por día', 'fecha']];
  for (const [title, key] of blocks) {
    rs.addRow([]); rs.addRow([title, 'Cantidad']).font = { bold: true };
    const list = key === 'fecha' ? countBy(rows, key).sort((a, b) => a[0].localeCompare(b[0])) : countBy(rows, key);
    for (const [k, n] of list) rs.addRow([k, n]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
