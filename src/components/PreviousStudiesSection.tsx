import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useClinicStore } from '@/store/useClinicStore';
import { savePreviousStudyFile } from '@/lib/previousStudiesStorage';

// La tabla/bucket "estudios_previos" son nuevos; se accede sin tipos hasta que se regeneren.
const db = supabase as any;

interface PreviousStudy {
  id: string;
  patient_id: string;
  fecha: string | null;
  tipo: string;
  origen: 'propio' | 'externo';
  archivo_path: string;
  archivo_nombre: string;
  notas: string | null;
}

const MAX_MB = 25;

interface Props { patientIds: string[]; primaryPatientId: string; canEdit: boolean; initiallyAdding?: boolean }

/** Estudios previos del paciente (Word, PDF, fotos de papel): se guardan tal cual y se abren desde acá. */
const PreviousStudiesSection = ({ patientIds, primaryPatientId, canEdit, initiallyAdding = false }: Props) => {
  const { user, isDoctor, isAdmin } = useAuth();
  const canManage = isDoctor || isAdmin; // eliminar / reasignar
  const { searchPatients, searchPatientsRemote } = useClinicStore();
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [reassignQuery, setReassignQuery] = useState('');
  const [items, setItems] = useState<PreviousStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(initiallyAdding && canEdit);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState('Estudio previo');
  const [origen, setOrigen] = useState<'propio' | 'externo'>('propio');
  const [notas, setNotas] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const idsKey = patientIds.join(',');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.from('estudios_previos').select('*').in('patient_id', patientIds).order('fecha', { ascending: false });
    if (error) console.error('estudios_previos:', error);
    setItems((data || []) as PreviousStudy[]);
    setLoading(false);
  }, [idsKey]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!canEdit || saving) return;
    if (!files.length) { toast.error('Elegí el archivo del estudio'); return; }
    if (files.some((file) => file.size > MAX_MB * 1024 * 1024)) { toast.error(`Cada archivo debe pesar hasta ${MAX_MB} MB`); return; }
    setSaving(true);
    const failed: File[] = [];
    let saved = 0;
    try {
      for (const file of files) {
        try {
          const safeName = file.name.replace(/[^\w.\-]+/g, '_');
          const path = `${primaryPatientId}/${crypto.randomUUID()}_${safeName}`;
          await savePreviousStudyFile(supabase.storage.from('estudios_previos'), path, file, () => db.from('estudios_previos').insert({
            patient_id: primaryPatientId, fecha: fecha || null, tipo: tipo.trim() || 'Estudio previo', origen,
            archivo_path: path, archivo_nombre: file.name, mime: file.type || null,
            notas: notas.trim() || null, created_by: user?.id, estado: 'asignado',
          }));
          saved++;
        } catch (error) {
          console.error('Error al guardar estudio previo:', error);
          failed.push(file);
        }
      }
      setFiles(failed);
      if (fileRef.current) fileRef.current.value = '';
      if (saved) toast.success(`${saved} estudio(s) previo(s) agregado(s)`);
      if (failed.length) toast.error('No se pudo guardar el archivo, probá de nuevo');
      else { setAdding(false); setFecha(''); setTipo('Estudio previo'); setNotas(''); setOrigen('propio'); }
      await load();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (reassignQuery.trim().length < 2) return;
    const t = setTimeout(() => { searchPatientsRemote(reassignQuery); }, 350);
    return () => clearTimeout(t);
  }, [reassignQuery]);

  const handleDelete = async (it: PreviousStudy) => {
    if (!confirm(`¿Eliminar "${it.archivo_nombre}"? Se borra el archivo y no se puede recuperar.`)) return;
    const { data, error } = await db.from('estudios_previos').delete().eq('id', it.id).select('id');
    if (error || !data || data.length === 0) { toast.error('No se pudo eliminar (sin permiso o ya no existe).'); return; }
    const { error: rmErr } = await supabase.storage.from('estudios_previos').remove([it.archivo_path]);
    if (rmErr) console.warn('No se pudo borrar el archivo del almacenamiento:', rmErr.message);
    toast.success('Estudio previo eliminado');
    await load();
  };

  const handleReassign = async (it: PreviousStudy, newPatientId: string) => {
    if (newPatientId === it.patient_id) { setReassigning(null); return; }
    const { data, error } = await db.from('estudios_previos').update({ patient_id: newPatientId, estado: 'asignado' }).eq('id', it.id).select('id');
    if (error || !data || data.length === 0) { toast.error('No se pudo reasignar.'); return; }
    toast.success('Estudio reasignado al otro paciente');
    setReassigning(null); setReassignQuery('');
    await load();
  };

  const openFile = async (it: PreviousStudy) => {
    const { data, error } = await supabase.storage.from('estudios_previos').createSignedUrl(it.archivo_path, 60 * 10);
    if (error || !data) { toast.error('No se pudo abrir el archivo'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const fmt = (d: string | null) => { if (!d) return 'sin fecha'; const [y, m, day] = d.split('-').map(Number); return format(new Date(y, m - 1, day), "d 'de' MMMM yyyy", { locale: es }); };

  return (
    <div className="space-y-2 border-t border-border pt-3 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Estudios previos</p>
        {canEdit && !adding && (
          <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" />Agregar estudio previo</Button>
        )}
      </div>

      {canEdit && adding && (
        <div className="space-y-2 bg-muted/30 border border-border rounded-lg p-3">
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,image/*" aria-label="Archivos del estudio" disabled={saving} onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-xs w-full" />
          {files.map((file, index) => <p key={`${index}-${file.name}`} className="text-xs break-all">{file.name}</p>)}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">Fecha (opcional)<Input type="date" value={fecha} disabled={saving} onChange={(e) => setFecha(e.target.value)} /></label>
            <select aria-label="Origen" disabled={saving} value={origen} onChange={(e) => setOrigen(e.target.value as 'propio' | 'externo')} className="h-10 self-end rounded-md border border-input bg-background px-2 text-sm">
              <option value="propio">Hecho en el consultorio</option>
              <option value="externo">De otro centro</option>
            </select>
          </div>
          <Input aria-label="Tipo de estudio" disabled={saving} value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Tipo de estudio (ej. Ecografía abdominal)" />
          <Input disabled={saving} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nota (opcional)" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ninguno cargado.</p>
      ) : (
        items.map((it) => (
          <div key={it.id} className="bg-muted/30 rounded-lg p-3 border border-border space-y-1">
            <button onClick={() => openFile(it)} className="w-full text-left hover:opacity-80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase flex items-center gap-1"><FileText className="w-3 h-3" />{it.tipo}</span>
                <Badge variant="outline" className="text-[10px]">{it.origen === 'externo' ? 'Externo' : 'Propio'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{fmt(it.fecha)} · {it.archivo_nombre}</p>
              {it.notas && <p className="text-xs mt-1">{it.notas}</p>}
            </button>
            {canManage && (
              <div className="flex gap-3 pt-1">
                <button className="text-xs text-primary underline" onClick={() => { setReassigning(reassigning === it.id ? null : it.id); setReassignQuery(''); }}>Reasignar a otro paciente</button>
                <button className="text-xs text-destructive underline" onClick={() => handleDelete(it)}>Eliminar</button>
              </div>
            )}
            {canManage && reassigning === it.id && (
              <div className="space-y-1 pt-1">
                <Input value={reassignQuery} onChange={(e) => setReassignQuery(e.target.value)} placeholder="DNI o apellido y nombre del paciente correcto" />
                {reassignQuery.trim().length >= 2 && searchPatients(reassignQuery).slice(0, 8).map((p) => (
                  <button key={p.id} onClick={() => handleReassign(it, p.id)} className="w-full text-left text-xs bg-card border border-border rounded px-2 py-1.5 hover:bg-muted/50">
                    {p.name}{p.dni ? ` · DNI ${p.dni}` : ''}{p.id === it.patient_id ? ' (actual)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default PreviousStudiesSection;
