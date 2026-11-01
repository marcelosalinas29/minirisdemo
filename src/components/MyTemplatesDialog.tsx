import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RichTextEditor from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { Trash2, Upload } from 'lucide-react';
import { STUDY_TYPES, studyTitle } from '@/types/medical';
import { deleteMyTemplate, fetchMyTemplates, saveMyTemplate, htmlFromFile, type DoctorTemplate } from '@/lib/doctorTemplates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentReport: string; // HTML del informe abierto (para "guardar este informe como plantilla")
  onChanged: () => void;
  prefill?: { name: string; html: string; studyType: string } | null; // para editar una plantilla de la app y guardar tu versión
}

const isEmptyHtml = (h: string) => h.replace(/<[^>]*>/g, '').trim() === '';

/** Plantillas propias del médico: subir un archivo, pegar texto o guardar el informe abierto. */
const MyTemplatesDialog = ({ open, onOpenChange, currentReport, onChanged, prefill }: Props) => {
  const [list, setList] = useState<DoctorTemplate[]>([]);
  const [name, setName] = useState('');
  const [studyType, setStudyType] = useState('');
  const [html, setHtml] = useState(''); // contenido de la plantilla, con su formato
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetchMyTemplates().then(setList).catch(() => toast.error('No se pudieron cargar tus plantillas'));
  useEffect(() => {
    if (!open) return;
    load();
    if (prefill) { setName(prefill.name); setStudyType(prefill.studyType); setHtml(prefill.html); }
  }, [open, prefill]);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setHtml(await htmlFromFile(file));
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const canSave = name.trim() && !isEmptyHtml(html);
  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await saveMyTemplate({ name, studyType: studyType || null, content: html });
      toast.success('Plantilla guardada');
      setName(''); setStudyType(''); setHtml('');
      await load();
      onChanged();
    } catch {
      toast.error('No se pudo guardar la plantilla');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: DoctorTemplate) => {
    if (!window.confirm(`¿Borrar tu plantilla "${t.name}"?`)) return;
    try { await deleteMyTemplate(t.id); await load(); onChanged(); } catch { toast.error('No se pudo borrar'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mis plantillas</DialogTitle>
          <DialogDescription>Solo las ves vos. Se suman a las de la app.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">Todavía no cargaste ninguna.</p>}
          {list.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.studyType ? studyTitle(t.studyType) : 'Sin estudio asignado'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(t)} aria-label="Borrar"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-sm font-semibold">Agregar plantilla</p>
          <Input placeholder="Nombre de la plantilla" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={studyType}
            onChange={(e) => setStudyType(e.target.value)}
          >
            <option value="">¿Para qué estudio? (opcional)</option>
            {STUDY_TYPES.map((s) => <option key={s} value={s}>{studyTitle(s)}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Si elegís un estudio, se te ofrece sola al abrir ese turno.</p>

          <input ref={fileRef} type="file" accept=".docx,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Subir archivo Word (.docx) o texto
          </Button>
          <p className="text-xs text-muted-foreground">Desde Drive: descargalo como Word y subilo desde acá.</p>
          <p className="text-xs text-muted-foreground">Escribí, pegá o ajustá el texto y el formato (negritas, etc.). Queda guardado tal cual.</p>
          <div className="border border-border rounded-lg">
            <RichTextEditor content={html} onChange={setHtml} placeholder="Texto de la plantilla…" />
          </div>
          {!isEmptyHtml(currentReport) && (
            <Button variant="ghost" className="w-full" onClick={() => setHtml(currentReport)}>
              Traer el informe abierto
            </Button>
          )}
          <Button className="w-full" disabled={!canSave || busy} onClick={save}>Guardar plantilla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyTemplatesDialog;
