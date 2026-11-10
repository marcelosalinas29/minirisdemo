import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';

export interface AvailableDoctor { id: string; name: string }

interface Props {
  open: boolean;
  /** 'normal' = turno común (no se puede, se ofrece otro médico). 'sobreturno' = se puede, con confirmación explícita. */
  kind: 'normal' | 'sobreturno';
  doctorName: string;
  /** Texto corto del momento, ej. "martes 2 de marzo, 13:00". */
  when: string;
  available: AvailableDoctor[];
  onPickDoctor: (doctorId: string) => void;
  onConfirmSobreturno?: (acordadoCon: string) => void;
  onClose: () => void;
}

/**
 * Aviso cuando el médico no atiende en ese día u horario.
 * No "rebota" el turno: dice qué médico está disponible y deja darlo con él.
 * El sobreturno fuera de horario se puede, pero con dos confirmaciones y dejando con quién se acordó.
 */
const OutOfHoursDialog = ({ open, kind, doctorName, when, available, onPickDoctor, onConfirmSobreturno, onClose }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [checked, setChecked] = useState(false);
  const [who, setWho] = useState('');

  useEffect(() => { if (open) { setStep(1); setChecked(false); setWho(''); } }, [open]);

  const availText = available.length > 0 ? available.map((d) => d.name).join(' o ') : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {kind === 'normal' ? 'El médico no tiene disponibilidad' : 'Sobreturno fuera del horario del médico'}
          </DialogTitle>
          <DialogDescription>
            {doctorName} no atiende {when}.{' '}
            {availText ? <>A esa hora atiende: <b>{availText}</b>.</> : <>A esa hora no atiende ningún médico.</>}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-2">
            {available.map((d) => (
              <Button key={d.id} className="w-full" onClick={() => onPickDoctor(d.id)}>
                Darlo con {d.name}
              </Button>
            ))}
            {kind === 'normal' && (
              <p className="text-xs text-muted-foreground">
                Para darlo igual con {doctorName} fuera de su horario hay que usar “Sobreturno” y confirmar con el médico.
              </p>
            )}
            {kind === 'sobreturno' && (
              <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
                Mantenerlo con {doctorName} (ya lo hablamos)
              </Button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm">
              Es un sobreturno con <b>{doctorName}</b> {when}, fuera de su horario. Tiene que estar acordado con el médico.
            </p>
            <div className="space-y-1">
              <Label>¿Con quién se acordó? *</Label>
              <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Ej: lo hablé con la Dra. en persona" />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={checked} onCheckedChange={(c) => setChecked(!!c)} className="mt-0.5" />
              <span>Confirmo que {doctorName} va a venir y atender a este paciente en ese horario.</span>
            </label>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {step === 2 && (
            <Button disabled={!checked || !who.trim()} onClick={() => onConfirmSobreturno?.(who.trim())}>
              Confirmar sobreturno
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutOfHoursDialog;
