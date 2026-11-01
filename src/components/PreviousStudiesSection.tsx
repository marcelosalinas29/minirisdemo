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

async function shrinkIfPhoto(file: File): Promise<{ blob: Blob; name: string; type: string }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return { blob: file, name: file.name, type: file.type };
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('No se pudo leer la foto.'));
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Formato de foto no soportado (por ejemplo HEIC).'));
    i.src = dataUrl;
  });
  const ratio = Math.min(1600 / img.width, 1);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo comprimir la foto.'))), 'image/jpeg', 0.8));
  return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
}

interface Props { patientIds: string[]; primaryPatientId: string; canEdit: boolean }

/** Estudios previos del paciente (Word, PDF, fotos de papel): se guardan tal cual y se abren desde acá. */
const PreviousStudiesSection = ({ patientIds, primaryPatientId, canEdit }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<PreviousStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState('');
  const [origen, setOrigen] = useState<'propio' | 'externo'>('propio');
  const [notas, setNotas] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
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
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Elegí el archivo del estudio'); return; }
    if (!fecha || !tipo.trim()) { toast.error('Completá la fecha y el tipo de estudio'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`El archivo pesa más de ${MAX_MB} MB`); return; }
    setSaving(true);
    try {
      const prepared = await shrinkIfPhoto(file);
      const safeName = prepared.name.replace(/[^\w.\-]+/g, '_');
      const path = `${primaryPatientId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('estudios_previos').upload(path, prepared.blob, { contentType: prepared.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await db.from('estudios_previos').insert({
        patient_id: primaryPatientId, fecha, tipo: tipo.trim(), origen, archivo_path: path, archivo_nombre: prepared.name, mime: prepared.type, notas: notas.trim() || null, created_by: user?.id,
      });
      if (insErr) {
        await supabase.storage.from('estudios_previos').remove([path]);
        throw insErr;
      }
      toast.success('Estudio previo agregado');
      setAdding(false); setFecha(''); setTipo(''); setNotas(''); setOrigen('propio');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(`No se pudo guardar: ${e?.message || 'error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (it: PreviousStudy) => {
    const { data, error } = await supabase.storage.from('estudios_previos').createSignedUrl(it.archivo_path, 60 * 10);
    if (error || !data) { toast.error('No se pudo abrir el archivo'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const fmt = (d: string | null) => { if (!d) return 'sin fecha'; const [y, m, day] = d.split('-').map(Number); return format(new Date(y, m - 1, day), "d 'de' MMMM yyyy", { locale: es }); };

  return (
    <div className="space-y-2 border-t border-border pt-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Estudios previos</p>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 bg-muted/30 border border-border rounded-lg p-3">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="text-xs w-full" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <select value={origen} onChange={(e) => setOrigen(e.target.value as 'propio' | 'externo')} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="propio">Hecho en el consultorio</option>
              <option value="externo">De otro centro</option>
            </select>
          </div>
          <Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Tipo de estudio (ej. Ecografía abdominal)" />
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nota (opcional)" />
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
          <button key={it.id} onClick={() => openFile(it)} className="w-full text-left bg-muted/30 hover:bg-muted/60 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase flex items-center gap-1"><FileText className="w-3 h-3" />{it.tipo}</span>
              <Badge variant="outline" className="text-[10px]">{it.origen === 'externo' ? 'Externo' : 'Propio'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{fmt(it.fecha)} · {it.archivo_nombre}</p>
            {it.notas && <p className="text-xs mt-1">{it.notas}</p>}
          </button>
        ))
      )}
    </div>
  );
};

export default PreviousStudiesSection;
