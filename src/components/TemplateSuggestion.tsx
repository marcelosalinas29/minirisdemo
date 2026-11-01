import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { suggestTemplates } from '@/data/studyTemplateMap';
import { textToHtml } from '@/components/TemplateSelector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyType: string;
  onApply: (html: string) => void;
  onChooseOther: () => void;
}

/** Al abrir un estudio sin informe: propone la plantilla del tipo de estudio, pidiendo confirmación. */
const TemplateSuggestion = ({ open, onOpenChange, studyType, onApply, onChooseOther }: Props) => {
  const options = suggestTemplates(studyType);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Usar una plantilla?</DialogTitle>
          <DialogDescription>Estudio: {studyType}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.length > 1 && (
            <Button className="w-full justify-start" onClick={() => { onApply(options.map((t) => textToHtml(t.content)).join('<p></p>')); onOpenChange(false); }}>
              Usar todas ({options.length})
            </Button>
          )}
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
