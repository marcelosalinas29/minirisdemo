import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useClinicStore } from '@/store/useClinicStore';
import { toast } from 'sonner';
import { Check, X, Search, FileText } from 'lucide-react';
import StudyTypeSelector from '@/components/StudyTypeSelector';
import { calcularEdadDetallada, getStudyDuration } from '@/types/medical';

interface Props {
  slot: string;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
}

const InlineAppointmentForm = ({ slot, date, onCancel, onSaved }: Props) => {
  const store = useClinicStore();
  const [dni, setDni] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [obraSocial, setObraSocial] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [studyType, setStudyType] = useState('');
  const [observations, setObservations] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showStudySelector, setShowStudySelector] = useState(false);

  const lookupDni = async () => {
    if (!dni.trim()) return;
    const p = await store.findPatientByDni(dni.trim());
    if (p) {
      setPatientId(p.id);
      setName(p.name);
      setPhone(p.phone);
      setObraSocial(p.obraSocial || '');
      setFechaNacimiento(p.fechaNacimiento || '');
      toast.success('Paciente encontrado');
    } else {
      setPatientId(null);
      toast.info('Paciente no registrado, complete los datos');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Ingrese el nombre del paciente');
      return;
    }
    // B: if it's a special study (Doppler / TN / Morfológica / Scan Fetal),
    // verify the next 10-min slot on the same date isn't already taken.
    const effectiveStudy = studyType || 'ECOGRAFIA';
    const duration = getStudyDuration(effectiveStudy, 10);
    if (duration > 10) {
      const [hh, mm] = slot.split(':').map(Number);
      const total = hh * 60 + mm + 10;
      const nextSlot = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      const sameDay = store.getAppointmentsByDate(date);
      const occupied = new Set(sameDay.map(a => a.time));
      if (occupied.has(nextSlot)) {
        // Suggest the first pair of consecutive free slots in the standard day ranges (08-13 and 15-21).
        const candidates: string[] = [];
        for (const [from, to] of [[8, 13], [15, 21]] as const) {
          for (let h = from; h < to; h++) for (let m = 0; m < 60; m += 10) {
            candidates.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          }
        }
        let suggestion = '';
        for (let i = 0; i < candidates.length - 1; i++) {
          if (!occupied.has(candidates[i]) && !occupied.has(candidates[i + 1])) {
            suggestion = candidates[i];
            break;
          }
        }
        toast.error(
          suggestion
            ? `Este estudio requiere 20 min y ${nextSlot} ya está ocupado. Probá a las ${suggestion}.`
            : `Este estudio requiere 20 min y ${nextSlot} ya está ocupado. No hay huecos consecutivos hoy.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      let pid = patientId;
      if (!pid) {
        const p = await store.addPatient({
          dni,
          name: name.trim(),
          phone,
          obraSocial,
          fechaNacimiento: fechaNacimiento || undefined,
        });
        pid = p.id;
      }
      await store.addAppointment({
        patientId: pid,
        studyType: studyType || 'ECOGRAFIA',
        date,
        time: slot,
      });
      toast.success('Turno confirmado');
      onSaved();
    } catch (error) {
      console.error('Error saving inline appointment:', error);
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Error al guardar el turno';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <>
      <td className="p-1 border border-border">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          placeholder="Nombre"
          className="h-6 text-xs uppercase"
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </td>
      <td className="p-1 border border-border">
        <div className="flex items-center gap-0.5">
          <span className="text-xs truncate max-w-[80px]" title={studyType || 'Estudio'}>
            {studyType || <span className="text-muted-foreground">Estudio</span>}
          </span>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => setShowStudySelector(true)} title="Seleccionar estudio">
            <FileText className="w-3 h-3" />
          </Button>
        </div>
        <StudyTypeSelector
          open={showStudySelector}
          onOpenChange={setShowStudySelector}
          onApply={(v) => setStudyType(v)}
          currentValue={studyType}
        />
      </td>
      <td className="p-1 border border-border">
        <div className="flex items-center gap-0.5">
          <Input
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            onBlur={lookupDni}
            placeholder="DNI"
            className="h-6 text-xs w-20"
            onKeyDown={handleKeyDown}
          />
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={lookupDni} title="Buscar por DNI">
            <Search className="w-3 h-3" />
          </Button>
        </div>
      </td>
      <td className="p-1 border border-border">
        <div className="flex flex-col gap-0.5">
          <Input
            type="date"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
            className="h-6 text-xs"
            onKeyDown={handleKeyDown}
          />
          {fechaNacimiento && (() => {
            const e = calcularEdadDetallada(fechaNacimiento);
            return <span className="text-[10px] text-muted-foreground"><span className="font-bold">{e.value}</span> {e.unit}</span>;
          })()}
        </div>
      </td>
      <td className="p-1 border border-border">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Tel"
          className="h-6 text-xs"
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="p-1 border border-border">
        <Input
          value={obraSocial}
          onChange={(e) => setObraSocial(e.target.value.toUpperCase())}
          placeholder="O.S."
          className="h-6 text-xs uppercase"
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="p-1 border border-border text-center">
        <span className="text-[10px] text-amber-600 font-semibold">Nuevo</span>
      </td>
      <td className="p-1 border border-border">
        <Input
          value={observations}
          onChange={(e) => setObservations(e.target.value.toUpperCase())}
          placeholder="Obs."
          className="h-6 text-xs uppercase"
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="p-1 border border-border text-center">
        <div className="flex items-center justify-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSave} disabled={saving} title="Confirmar turno">
            <Check className="w-3.5 h-3.5 text-green-600" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel} title="Cancelar">
            <X className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </>
  );
};

export default InlineAppointmentForm;
