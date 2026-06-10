import { useState } from 'react';
import { REPORT_TEMPLATES } from '@/data/reportTemplates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Plus } from 'lucide-react';

/** Convert plain text template to proper HTML with <p> tags per line */
function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed === '---') return '';
      // Detect lines that look like section headers (ALL CAPS or ending with colon at start)
      const isHeader = /^[A-ZÁÉÍÓÚÑÜ\s\-()\/]+:?$/.test(trimmed) && trimmed.length < 60;
      if (isHeader) {
        return `<p><strong>${trimmed}</strong></p>`;
      }
      // Detect label: value pattern (e.g. "Hígado: texto...")
      const labelMatch = trimmed.match(/^([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s\-()\/]+:)\s*(.*)/);
      if (labelMatch) {
        return `<p><strong>${labelMatch[1]}</strong> ${labelMatch[2]}</p>`;
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
  const [selected, setSelected] = useState<number[]>([]);
  const [customTitle, setCustomTitle] = useState('');

  const toggleTemplate = (index: number) => {
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleApply = () => {
    const htmlParts: string[] = [];

    if (customTitle.trim()) {
      htmlParts.push(`<p><strong>${customTitle.trim().toUpperCase()}</strong></p>`);
    }

    const sortedSelected = [...selected].sort((a, b) => a - b);
    sortedSelected.forEach((idx, i) => {
      const template = REPORT_TEMPLATES[idx];
      htmlParts.push(textToHtml(template.content));
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
              {REPORT_TEMPLATES.map((t, idx) => (
                <label
                  key={t.name}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer border-b border-border last:border-0"
                >
                  <Checkbox
                    checked={selected.includes(idx)}
                    onCheckedChange={() => toggleTemplate(idx)}
                  />
                  <span className="text-sm font-medium">{t.name}</span>
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
