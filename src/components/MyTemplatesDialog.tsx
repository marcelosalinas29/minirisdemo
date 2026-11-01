import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Trash2, Upload } from 'lucide-react';
import { STUDY_TYPES, studyTitle } from '@/types/medical';
import { textToHtml } from '@/components/TemplateSelector';
import { deleteMyTemplate, fetchMyTemplates, saveMyTemplate, textFromFile, type DoctorTemplate } from '@/lib/doctorTemplates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentReport: string; // HTML del informe abierto (para "guardar este informe como plantilla")
  onChanged: () => void;
}

const isEmptyHtml = (h: string) => h.replace(/<[^>]*>/g, '').trim() === '';

/** Plantillas propias del médico: subir un archivo, pegar texto o guardar el informe abierto. */
const MyTemplatesDialog = ({ open, onOpenChange, currentReport, onChanged }: Props) => {
  const [list, setList] = useState<DoctorTemplate[]>([]);
  const [name, setName] = useState('');
  const [studyType, setStudyType] = useState('');
  const [text, setText] = useState('');
  const [html, setHtml] = useState(''); // si viene del informe abierto
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetchMyTemplates().then(setList).catch(() => toast.error('No se pudieron cargar tus plantillas'));
  useEffect(() => { if (open) load(); }, [open]);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setText(await textFromFile(file));
      setHtml('');
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const canSave = name.trim() && (html || text.trim());
  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await saveMyTemplate({ name, studyType: studyType || null, content: html || textToHtml(text) });
      toast.success('Plantilla guardada');
      setName(''); setStudyType(''); setText(''); setHtml('');
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
          <Textarea
            rows={5}
            placeholder="…o pegá el texto de la plantilla"
            value={html ? '(se usará el informe abierto con su formato)' : text}
            disabled={!!html}
            onChange={(e) => setText(e.target.value)}
          />
          {!isEmptyHtml(currentReport) && !html && (
            <Button variant="ghost" className="w-full" onClick={() => { setHtml(currentReport); setText(''); }}>
              Usar el informe abierto como plantilla
            </Button>
          )}
          {html && <Button variant="ghost" className="w-full" onClick={() => setHtml('')}>Quitar el informe abierto</Button>}
          <Button className="w-full" disabled={!canSave || busy} onClick={save}>Guardar plantilla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyTemplatesDialog;
