import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatStudyType } from '@/types/medical';
import type { DoctorTemplate } from '@/lib/doctorTemplates';
import { EMPTY_SETTINGS, type DoctorSettings } from '@/lib/doctorSettings';
import { buildReportHtml, optionHtml, optionsForStudy } from '@/lib/templateResolve';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyType: string;
  own?: DoctorTemplate[]; // todas las plantillas propias del médico
  settings?: DoctorSettings;
  onApply: (html: string) => void;
  onChooseOther: () => void;
}

/** Plantilla propuesta para el estudio del turno, pidiendo confirmación (cuando no hay una por defecto elegida). */
const TemplateSuggestion = ({ open, onOpenChange, studyType, own = [], settings = EMPTY_SETTINGS, onApply, onChooseOther }: Props) => {
  const parts = studyType.split(' + ').map((s) => s.trim()).filter(Boolean);
  const withTemplates = parts.filter((p) => optionsForStudy(p, own).length > 0);
  const withoutTemplate = parts.filter((p) => optionsForStudy(p, own).length === 0);
  const style = settings.style;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Usar una plantilla?</DialogTitle>
          <DialogDescription>Estudio: {formatStudyType(studyType)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {withoutTemplate.length > 0 && (
            <p className="text-xs text-amber-700">Sin plantilla (se escribe a mano): {withoutTemplate.map((p) => formatStudyType(p)).join(', ')}</p>
          )}
          {parts.length > 1 && withTemplates.length > 0 && (
            <Button className="w-full justify-start" onClick={() => { onApply(buildReportHtml(studyType, own, settings)); onOpenChange(false); }}>
              Usar todos los estudios ({withTemplates.length})
            </Button>
          )}
          {withTemplates.map((p) => (
            <div key={p} className="space-y-1.5">
              {parts.length > 1 && <p className="text-xs font-semibold uppercase pt-1">{formatStudyType(p)}</p>}
              {optionsForStudy(p, own).map((o) => (
                <Button key={o.ref} className="w-full justify-start" onClick={() => { onApply(optionHtml(o, style)); onOpenChange(false); }}>
                  {o.name}{o.own ? ' (mía)' : ''}
                </Button>
              ))}
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => { onOpenChange(false); onChooseOther(); }}>Elegir otra plantilla</Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Empezar en blanco</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSuggestion;
