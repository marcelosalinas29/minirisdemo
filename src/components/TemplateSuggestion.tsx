import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { suggestTemplates } from '@/data/studyTemplateMap';
import { textToHtml } from '@/components/TemplateSelector';
import { studyTitle } from '@/types/medical';
import type { DoctorTemplate } from '@/lib/doctorTemplates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyType: string;
  own?: DoctorTemplate[]; // plantillas propias del médico que corresponden a este turno
  onApply: (html: string) => void;
  onChooseOther: () => void;
}

/** Al abrir un estudio sin informe: propone la plantilla del tipo de estudio, pidiendo confirmación. */
/** Varios estudios en un turno: cada uno con su título en negrita y mayúscula, separados por una línea en blanco. */
export function buildMultiStudyHtml(studyType: string, own: DoctorTemplate[] = []): string {
  const blocks: string[] = [];
  for (const part of studyType.split(' + ').map((x) => x.trim()).filter(Boolean)) {
    const mine = own.find((o) => o.studyType === part);
    const t = suggestTemplates(part)[0];
    const body = mine ? mine.content : t ? textToHtml(t.content) : '';
    if (!body) continue;
    blocks.push(`<p><strong>${studyTitle(part)}</strong></p>${body}`);
  }
  return blocks.join('<p></p>');
}

const TemplateSuggestion = ({ open, onOpenChange, studyType, own = [], onApply, onChooseOther }: Props) => {
  const options = suggestTemplates(studyType).filter((t) => !own.some((o) => o.name === t.name && o.studyType));
  const withoutTemplate = studyType.split(' + ').map((s) => s.trim()).filter((s) => s && suggestTemplates(s).length === 0 && !own.some((o) => o.studyType === s));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Usar una plantilla?</DialogTitle>
          <DialogDescription>Estudio: {studyType}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {withoutTemplate.length > 0 && (
            <p className="text-xs text-amber-700">Sin plantilla (se escribe a mano): {withoutTemplate.join(', ')}</p>
          )}
          {options.length + own.length > 1 && (
            <Button className="w-full justify-start" onClick={() => { onApply(studyType.includes(' + ') ? buildMultiStudyHtml(studyType, own) : [...own.map((o) => o.content), ...options.map((t) => textToHtml(t.content))].join('<p></p>')); onOpenChange(false); }}>
              {studyType.includes(' + ') ? `Usar todos los estudios (${studyType.split(' + ').length})` : `Usar todas (${options.length + own.length})`}
            </Button>
          )}
          {own.map((o) => (
            <Button key={o.id} className="w-full justify-start" onClick={() => { onApply(o.content); onOpenChange(false); }}>
              {o.name} (mía)
            </Button>
          ))}
          {options.map((t) => (
            <Button key={t.name} className="w-full justify-start" onClick={() => { onApply(textToHtml(t.content)); onOpenChange(false); }}>
              {t.name}
            </Button>
          ))}
          <Button variant="outline" className="w-full" onClick={() => { onOpenChange(false); onChooseOther(); }}>Elegir otra plantilla</Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Empezar en blanco</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSuggestion;
