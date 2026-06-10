import { useState } from 'react';
import { STUDY_TYPES } from '@/types/medical';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Plus } from 'lucide-react';

interface StudyTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (studyType: string) => void;
  currentValue?: string;
}

const StudyTypeSelector = ({ open, onOpenChange, onApply, currentValue }: StudyTypeSelectorProps) => {
  const [selected, setSelected] = useState<string[]>(() => {
    if (!currentValue) return [];
    return currentValue.split(' + ').filter(s => STUDY_TYPES.includes(s));
  });
  const [customText, setCustomText] = useState(() => {
    if (!currentValue) return '';
    const parts = currentValue.split(' + ');
    const custom = parts.filter(s => !STUDY_TYPES.includes(s));
    return custom.join(', ');
  });

  const toggleType = (type: string) => {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleApply = () => {
    const parts: string[] = [...selected];
    if (customText.trim()) {
      parts.push(customText.trim());
    }
    if (parts.length === 0) return;
    onApply(parts.join(' + '));
    onOpenChange(false);
  };

  const handleReset = () => {
    if (currentValue) {
      const parts = currentValue.split(' + ');
      setSelected(parts.filter(s => STUDY_TYPES.includes(s)));
      setCustomText(parts.filter(s => !STUDY_TYPES.includes(s)).join(', '));
    } else {
      setSelected([]);
      setCustomText('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Seleccionar Estudios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Estudio personalizado (opcional)
            </label>
            <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Ej: Ecografía de cadera"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Estudios disponibles
            </label>
            <div className="space-y-1 border border-border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
              {STUDY_TYPES.map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer border-b border-border last:border-0"
                >
                  <Checkbox
                    checked={selected.includes(t)}
                    onCheckedChange={() => toggleType(t)}
                  />
                  <span className="text-sm">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {(selected.length > 0 || customText.trim()) && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Vista previa:</p>
              <p className="text-sm font-medium">
                {[...selected, ...(customText.trim() ? [customText.trim()] : [])].join(' + ')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={selected.length === 0 && !customText.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudyTypeSelector;
