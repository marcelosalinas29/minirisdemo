import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MyTemplatesDialog from '@/components/MyTemplatesDialog';
import { studyForTemplate } from '@/data/studyTemplateMap';
import { EMPTY_SETTINGS, fetchMySettings } from '@/lib/doctorSettings';
import { applyParagraphStyle } from '@/lib/reportStyle';
import { fetchMyTemplates, deleteMyTemplate, type DoctorTemplate } from '@/lib/doctorTemplates';
import { REPORT_TEMPLATES } from '@/data/reportTemplates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Plus } from 'lucide-react';

/** Convert plain text template to proper HTML with <p> tags per line */
export function textToHtml(text: string, opts: { sectionBold?: boolean; labelBold?: boolean } = {}): string {
  const sectionBold = opts.sectionBold ?? true;
  const labelBold = opts.labelBold ?? true;
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed === '---') return '';
      // Detect lines that look like section headers (ALL CAPS or ending with colon at start)
      const isHeader = /^[A-ZÁÉÍÓÚÑÜ\s\-()\/]+:?$/.test(trimmed) && trimmed.length < 60;
      if (isHeader) {
        return sectionBold ? `<p><strong>${trimmed}</strong></p>` : `<p>${trimmed}</p>`;
      }
      // Detect label: value pattern (e.g. "Hígado: texto...")
      const labelMatch = trimmed.match(/^([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s\-()\/]+:)\s*(.*)/);
      if (labelMatch) {
        return labelBold ? `<p><strong>${labelMatch[1]}</strong> ${labelMatch[2]}</p>` : `<p>${labelMatch[1]} ${labelMatch[2]}</p>`;
      }
      return `<p>${trimmed}</p>`;
    })
    .filter(Boolean)
    .join('');
}

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (content: string) => void;
  currentReport: string;
}

const TemplateSelector = ({ open, onOpenChange, onApply, currentReport }: TemplateSelectorProps) => {
  const { isSecretary, isViewer } = useAuth();
  const canOwn = !isSecretary && !isViewer;
  const [selected, setSelected] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [mine, setMine] = useState<DoctorTemplate[]>([]);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [showMine, setShowMine] = useState(false);
  const [prefill, setPrefill] = useState<{ id?: string; name: string; html: string; studyType: string } | null>(null);

  const loadMine = () => { if (canOwn) fetchMyTemplates().then(setMine).catch(() => setMine([])); };
  useEffect(() => {
    if (!open) return;
    loadMine();
    if (canOwn) fetchMySettings().then(setSettings).catch(() => setSettings(EMPTY_SETTINGS));
  }, [open, canOwn]);

  // Lista única: primero las propias, después las de la app.
  const all = [
    ...mine.map((m) => ({ key: `m${m.id}`, id: m.id, raw: m.content, studyType: m.studyType || '', name: m.name, own: true, html: applyParagraphStyle(m.content, settings.style) })),
    ...REPORT_TEMPLATES.filter((t) => !mine.some((m) => m.name === t.name)).map((t, i) => ({ key: `b${t.name}`, name: t.name, own: false, html: applyParagraphStyle(textToHtml(t.content, { sectionBold: settings.style.sectionBold, labelBold: settings.style.labelBold }), settings.style) })),
  ];

  const toggleTemplate = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleApply = () => {
    const htmlParts: string[] = [];

    if (customTitle.trim()) {
      htmlParts.push(`<p><strong>${customTitle.trim().toUpperCase()}</strong></p>`);
    }

    const sortedSelected = all.filter((t) => selected.includes(t.key));
    sortedSelected.forEach((template, i) => {
      htmlParts.push(template.html);
      if (i < sortedSelected.length - 1) {
        htmlParts.push('<p>---</p>');
      }
    });

    if (htmlParts.length === 0) return;

    const combined = htmlParts.join('');
    const newReport = currentReport.trim()
      ? currentReport.trim() + '<p>---</p>' + combined
      : combined;

    onApply(newReport);
    setSelected([]);
    setCustomTitle('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Seleccionar Plantillas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Título personalizado (opcional)
            </label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ej: ECOGRAFÍA ABDOMINAL Y RENAL"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Plantillas disponibles
            </label>
            <div className="space-y-1 border border-border rounded-lg overflow-hidden">
              {all.map((t) => (
                <label
                  key={t.key}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer border-b border-border last:border-0"
                >
                  <Checkbox
                    checked={selected.includes(t.key)}
                    onCheckedChange={() => toggleTemplate(t.key)}
                  />
                  <span className="text-sm font-medium flex-1">{t.name}{t.own && <span className="ml-2 text-xs text-primary">(mía)</span>}</span>
                  {canOwn && !t.own && (
                    <Button
                      type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={(e) => { e.preventDefault(); setPrefill({ name: t.name, html: t.html, studyType: studyForTemplate(t.name) }); setShowMine(true); }}
                    >Editar</Button>
                  )}
                  {canOwn && t.own && 'id' in t && (
                    <>
                      <Button
                        type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                        onClick={(e) => { e.preventDefault(); setPrefill({ id: (t as any).id, name: t.name, html: (t as any).raw, studyType: (t as any).studyType }); setShowMine(true); }}
                      >Editar</Button>
                      {REPORT_TEMPLATES.some((b) => b.name === t.name) && (
                        <Button
                          type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                          title="Descarta tus cambios y vuelve a usar la plantilla original de la app"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!window.confirm(`¿Volver a la plantilla original de la app para "${t.name}"? Se pierden tus cambios en esa plantilla.`)) return;
                            try { await deleteMyTemplate((t as any).id); setSelected((prev) => prev.filter((k) => k !== t.key)); loadMine(); toast.success('Se restauró la plantilla de la app'); }
                            catch { toast.error('No se pudo restaurar la plantilla'); }
                          }}
                        >Volver a la de la app</Button>
                      )}
                    </>
                  )}
                </label>
              ))}
            </div>
          </div>

          {selected.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Se combinarán {selected.length} plantillas en un solo informe.
            </p>
          )}
        </div>

        {canOwn && (
          <Button variant="outline" className="w-full" onClick={() => { setPrefill(null); setShowMine(true); }}>Mis plantillas (agregar / editar / borrar)</Button>
        )}
        <MyTemplatesDialog open={showMine} onOpenChange={setShowMine} currentReport={currentReport} onChanged={loadMine} prefill={prefill} />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={selected.length === 0 && !customTitle.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            Aplicar ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSelector;
