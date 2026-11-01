import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Loader2, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicStore } from '@/store/useClinicStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listZipEntries, readZipEntry } from '@/lib/import/zipReader';
import {
  docxToText, parseReportText, parseFileName, looksLikeAppBackup, matchPatients, sha256Hex, type MatchPatient,
} from '@/lib/import/studyParser';

// La tabla y el bucket "estudios_previos" son nuevos; se accede sin tipos.
const db = supabase as any;

type Status = 'listo' | 'revisar' | 'pendiente' | 'repetido' | 'en-sistema' | 'respaldo' | 'error';

interface Item {
  key: string;
  fileName: string;
  getBlob: () => Promise<Blob>;
  hash: string;
  detected: string; // nombre detectado
  dni: string;
  fecha: string; // '' si no se detectó
  tipo: string;
  candidates: MatchPatient[];
  patientId: string; // '' = pendiente
  status: Status;
  note: string;
  include: boolean;
}

const ALLOWED = /\.(docx|doc|pdf|jpe?g|png)$/i;
const STATUS_LABEL: Record<Status, string> = {
  listo: 'Listo', revisar: 'Revisar', pendiente: 'Sin paciente', repetido: 'Ya importado',
  'en-sistema': 'Ya está en el sistema', respaldo: 'Respaldo de la app', error: 'Error',
};
const STATUS_STYLE: Record<Status, string> = {
  listo: 'bg-green-100 text-green-800', revisar: 'bg-yellow-100 text-yellow-800', pendiente: 'bg-orange-100 text-orange-800',
  repetido: 'bg-gray-100 text-gray-700', 'en-sistema': 'bg-gray-100 text-gray-700', respaldo: 'bg-gray-100 text-gray-700', error: 'bg-red-100 text-red-800',
};
const PAGE_SIZE = 50;

async function runPool<T>(list: T[], size: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (next < list.length) { const i = next++; await fn(list[i], i); }
  }));
}
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const ImportStudiesPage = () => {
  const { user, isViewer } = useAuth();
  const { patients, fetchPatients } = useClinicStore();
  const [tab, setTab] = useState<'importar' | 'pendientes'>('importar');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string>('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [filter, setFilter] = useState<Status | 'todos'>('todos');
  const [page, setPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchPatients(); }, []);

  const matchPool = useMemo<MatchPatient[]>(
    () => patients.map((p) => ({ id: p.id, name: p.name, dni: p.dni, dniMaterno: p.dniMaterno })),
    [patients],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy('Leyendo archivos...'); setItems([]); setPage(0); setFilter('todos');
    try {
      // 1) Expandir zips y juntar los archivos válidos
      const raw: { fileName: string; getBlob: () => Promise<Blob> }[] = [];
      for (const f of Array.from(files)) {
        if (/\.zip$/i.test(f.name)) {
          const entries = await listZipEntries(f);
          for (const e of entries) {
            if (e.name.endsWith('/') || /(^|\/)(__MACOSX|\.)|(^|\/)~\$/.test(e.name) || !ALLOWED.test(e.name)) continue;
            raw.push({ fileName: e.name, getBlob: async () => new Blob([await readZipEntry(f, e) as BlobPart]) });
          }
        } else if (ALLOWED.test(f.name)) {
          raw.push({ fileName: f.name, getBlob: async () => f });
        }
      }
      if (raw.length === 0) { toast.error('No encontré archivos válidos (Word, PDF o fotos).'); return; }

      // 2) Analizar cada archivo
      setBusy('Analizando...'); setProgress({ done: 0, total: raw.length });
      const out: Item[] = new Array(raw.length);
      await runPool(raw, 4, async (r, i) => {
        let item: Item = {
          key: `${i}`, fileName: r.fileName, getBlob: r.getBlob, hash: '', detected: '', dni: '', fecha: '', tipo: '',
          candidates: [], patientId: '', status: 'pendiente', note: '', include: false,
        };
        try {
          const blob = await r.getBlob();
          item.hash = await sha256Hex(blob);
          let parsed = null;
          if (/\.docx$/i.test(r.fileName)) {
            try { parsed = parseReportText(await docxToText(blob)); } catch { /* usa el nombre del archivo */ }
          }
          if (!parsed) parsed = parseFileName(r.fileName);
          item.detected = parsed.paciente; item.dni = parsed.dni; item.fecha = parsed.fecha || ''; item.tipo = parsed.estudio;
          if (!item.tipo) item.tipo = parseFileName(r.fileName).estudio;
          const m = matchPatients(parsed.paciente, parsed.dni, matchPool);
          item.candidates = m.candidates;
          if ((m.kind === 'exacto' || m.kind === 'otro-orden') && m.candidates.length === 1) {
            item.status = 'listo'; item.patientId = m.candidates[0].id; item.include = true;
            if (m.kind === 'otro-orden') item.note = 'Nombre en otro orden';
          } else if (m.candidates.length > 0) {
            item.status = 'revisar'; item.note = m.kind === 'posible' ? 'Posible coincidencia' : 'Varios pacientes con ese nombre';
          } else {
            item.status = 'pendiente'; item.include = true; item.note = 'Se guarda y espera a que aparezca el paciente';
          }
          if (looksLikeAppBackup(r.fileName) && !item.fecha) {
            item.status = 'respaldo'; item.include = false; item.note = 'Parece un PDF generado por la app: seguramente ya está cargado';
          }
        } catch (e: any) {
          item = { ...item, status: 'error', include: false, note: e?.message || 'No se pudo leer' };
        }
        out[i] = item;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      });

      // 3) Detectar archivos ya importados (mismo contenido)
      setBusy('Buscando repetidos...');
      const hashes = out.map((o) => o.hash).filter(Boolean);
      const seen = new Set<string>();
      for (const part of chunk(hashes, 100)) {
        const { data } = await db.from('estudios_previos').select('archivo_hash').in('archivo_hash', part);
        (data || []).forEach((r: any) => seen.add(r.archivo_hash));
      }
      const firstSeen = new Set<string>();
      for (const o of out) {
        if (!o.hash) continue;
        if (seen.has(o.hash) || firstSeen.has(o.hash)) {
          o.status = 'repetido'; o.include = false; o.note = seen.has(o.hash) ? 'Este archivo ya fue importado' : 'Repetido dentro de esta tanda';
        } else firstSeen.add(o.hash);
      }

      // 4) Detectar estudios que ya están como turnos en el sistema (mismo paciente y fecha)
      setBusy('Comparando con los estudios del sistema...');
      const ids = Array.from(new Set(out.filter((o) => o.patientId && o.fecha && o.status === 'listo').map((o) => o.patientId)));
      const existing = new Set<string>();
      for (const part of chunk(ids, 150)) {
        const { data } = await supabase.from('appointments').select('patient_id, date').in('patient_id', part).limit(5000);
        (data || []).forEach((r: any) => existing.add(`${r.patient_id}|${r.date}`));
      }
      for (const o of out) {
        if (o.status === 'listo' && o.fecha && existing.has(`${o.patientId}|${o.fecha}`)) {
          o.status = 'en-sistema'; o.include = false; o.note = 'Ese paciente ya tiene un estudio ese día en el sistema';
        }
      }
      setItems(out);
      toast.success(`${out.length} archivo(s) analizados. Revisá el resumen antes de importar.`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo leer la selección');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const update = (key: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [items]);
  const toImport = items.filter((i) => i.include);
  const visible = items.filter((i) => filter === 'todos' || i.status === filter);
  const pageItems = visible.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const doImport = async () => {
    if (toImport.length === 0) return;
    if (!confirm(`Se van a importar ${toImport.length} archivo(s). ¿Continuar?`)) return;
    setBusy('Importando...'); setProgress({ done: 0, total: toImport.length });
    let ok = 0, dup = 0; const errors: string[] = [];
    await runPool(toImport, 3, async (it) => {
      try {
        const blob = await it.getBlob();
        const safe = it.fileName.replace(/^.*[\\/]/, '').replace(/[^\w.\-]+/g, '_');
        const path = `${it.patientId || 'pendientes'}/${it.hash.slice(0, 16)}_${safe}`;
        const { error: upErr } = await supabase.storage.from('estudios_previos').upload(path, blob, { upsert: true });
        if (upErr) throw upErr;
        const { error: insErr } = await db.from('estudios_previos').insert({
          patient_id: it.patientId || null,
          estado: it.patientId ? 'asignado' : 'pendiente',
          fecha: it.fecha || null,
          tipo: (it.tipo || 'Estudio previo').trim(),
          origen: 'propio',
          archivo_path: path,
          archivo_nombre: it.fileName.replace(/^.*[\\/]/, ''),
          mime: blob.type || null,
          nombre_detectado: it.detected || null,
          dni_detectado: it.dni || null,
          archivo_hash: it.hash,
          created_by: user?.id,
        });
        if (insErr) {
          if ((insErr as any).code === '23505') { dup++; update(it.key, { status: 'repetido', include: false, note: 'Ya importado' }); return; }
          throw insErr;
        }
        ok++; update(it.key, { include: false, status: 'repetido', note: 'Importado ✔' });
      } catch (e: any) {
        errors.push(`${it.fileName}: ${e?.message || 'error'}`);
        update(it.key, { status: 'error', note: e?.message || 'Error al importar' });
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    });
    setBusy('');
    if (errors.length) { console.error(errors); toast.error(`Importados ${ok}. Con error: ${errors.length} (quedan marcados para reintentar).`); }
    else toast.success(`Importados ${ok}${dup ? `, repetidos omitidos: ${dup}` : ''}.`);
  };

  if (isViewer) return <AppLayout title="Importar estudios"><p className="p-4 text-sm">No tenés permiso para importar.</p></AppLayout>;

  return (
    <AppLayout title="Importar estudios previos">
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <Button variant={tab === 'importar' ? 'default' : 'outline'} size="sm" onClick={() => setTab('importar')}>Importar</Button>
          <Button variant={tab === 'pendientes' ? 'default' : 'outline'} size="sm" onClick={() => setTab('pendientes')}>Pendientes</Button>
        </div>

        {tab === 'importar' && (
          <>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-sm">Subí una carpeta comprimida (.zip) o archivos sueltos (Word, PDF, fotos). Nada se guarda hasta que confirmes.</p>
              <input ref={fileRef} type="file" multiple accept=".zip,.docx,.doc,.pdf,.jpg,.jpeg,.png" className="text-xs w-full" onChange={(e) => handleFiles(e.target.files)} disabled={!!busy} />
              {busy && (
                <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{busy} {progress.total > 0 && `${progress.done} de ${progress.total}`}</p>
              )}
            </div>

            {items.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button onClick={() => { setFilter('todos'); setPage(0); }} className={`px-2 py-1 rounded-full border ${filter === 'todos' ? 'bg-primary text-primary-foreground' : ''}`}>Todos {items.length}</button>
                  {(Object.keys(STATUS_LABEL) as Status[]).filter((s) => counts[s]).map((s) => (
                    <button key={s} onClick={() => { setFilter(s); setPage(0); }} className={`px-2 py-1 rounded-full border ${filter === s ? 'bg-primary text-primary-foreground' : ''}`}>{STATUS_LABEL[s]} {counts[s]}</button>
                  ))}
                </div>

                <Button onClick={doImport} disabled={!!busy || toImport.length === 0} className="w-full">
                  <Upload className="w-4 h-4 mr-2" />Importar {toImport.length} seleccionado(s)
                </Button>

                <div className="space-y-2">
                  {pageItems.map((it) => (
                    <div key={it.key} className="bg-card border border-border rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={it.include} disabled={it.status === 'error' || it.status === 'repetido'}
                          onChange={(e) => update(it.key, { include: e.target.checked })} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate flex items-center gap-1"><FileText className="w-3 h-3 shrink-0" />{it.detected || it.fileName}</p>
                          <p className="text-xs text-muted-foreground truncate">{it.fileName}</p>
                        </div>
                        <Badge className={`text-[10px] ${STATUS_STYLE[it.status]}`} variant="outline">{STATUS_LABEL[it.status]}</Badge>
                      </div>
                      {it.note && <p className="text-xs text-muted-foreground">{it.note}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="date" value={it.fecha} onChange={(e) => update(it.key, { fecha: e.target.value })} />
                        <Input value={it.tipo} onChange={(e) => update(it.key, { tipo: e.target.value })} placeholder="Tipo de estudio" />
                      </div>
                      <select value={it.patientId} onChange={(e) => update(it.key, { patientId: e.target.value, include: true, status: e.target.value ? (it.status === 'pendiente' ? 'revisar' : it.status) : 'pendiente' })}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="">— Dejar pendiente (sin paciente) —</option>
                        {it.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.dni ? ` · DNI ${c.dni}` : ''}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {visible.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between text-sm">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <span>{page + 1} / {Math.ceil(visible.length / PAGE_SIZE)}</span>
                    <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= visible.length} onClick={() => setPage(page + 1)}>Siguiente</Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'pendientes' && <PendingList matchPool={matchPool} />}
      </div>
    </AppLayout>
  );
};

interface Pending { id: string; nombre_detectado: string | null; dni_detectado: string | null; fecha: string | null; tipo: string; archivo_nombre: string; archivo_path: string }

const PendingList = ({ matchPool }: { matchPool: MatchPatient[] }) => {
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [onlyWithMatch, setOnlyWithMatch] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.from('estudios_previos').select('id, nombre_detectado, dni_detectado, fecha, tipo, archivo_nombre, archivo_path').eq('estado', 'pendiente').order('nombre_detectado').limit(2000);
    if (error) console.error(error);
    setRows((data || []) as Pending[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const withMatch = useMemo(() => rows.map((r) => ({ r, m: matchPatients(r.nombre_detectado || '', r.dni_detectado || '', matchPool) })), [rows, matchPool]);
  const shown = withMatch
    .filter((x) => (!onlyWithMatch || x.m.candidates.length > 0))
    .filter((x) => !filterText || (x.r.nombre_detectado || '').toLowerCase().includes(filterText.toLowerCase()))
    .slice(0, 100);

  const assign = async (id: string, patientId: string) => {
    const { error } = await db.from('estudios_previos').update({ patient_id: patientId, estado: 'asignado' }).eq('id', id);
    if (error) { toast.error(`No se pudo asignar: ${error.message}`); return; }
    toast.success('Asignado al paciente');
    setRows((prev) => prev.filter((x) => x.id !== id));
  };
  const open = async (path: string) => {
    const { data } = await supabase.storage.from('estudios_previos').createSignedUrl(path, 600);
    if (data) window.open(data.signedUrl, '_blank', 'noopener'); else toast.error('No se pudo abrir');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Estudios guardados sin paciente. Se compara cada nombre con los pacientes actuales; cuando aparece uno que coincide, te lo propone.</p>
      <div className="flex gap-2 items-center">
        <Input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filtrar por nombre" />
        <label className="text-xs flex items-center gap-1 shrink-0"><input type="checkbox" checked={onlyWithMatch} onChange={(e) => setOnlyWithMatch(e.target.checked)} />Solo con propuesta</label>
      </div>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
        <>
          <p className="text-xs text-muted-foreground">{rows.length} pendiente(s) en total · {withMatch.filter((x) => x.m.candidates.length > 0).length} con propuesta</p>
          {shown.map(({ r, m }) => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold truncate">{r.nombre_detectado || r.archivo_nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.tipo} · {r.fecha || 'sin fecha'}</p></div>
                <button className="text-xs text-primary underline shrink-0" onClick={() => open(r.archivo_path)}>Abrir</button>
              </div>
              {m.candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-muted/40 rounded px-2 py-1">
                  <span className="text-xs truncate">¿Es {c.name}{c.dni ? ` (DNI ${c.dni})` : ''}?</span>
                  <Button size="sm" variant="outline" onClick={() => assign(r.id, c.id)}>Sí, asignar</Button>
                </div>
              ))}
            </div>
          ))}
          {shown.length === 0 && <p className="text-sm text-muted-foreground">Nada para mostrar con ese filtro.</p>}
        </>
      )}
    </div>
  );
};

export default ImportStudiesPage;
