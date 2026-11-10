import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScheduleStore } from '@/store/useScheduleStore';
import { useClinicStore } from '@/store/useClinicStore';
import { isInactiveStatus } from '@/types/medical';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const fmt = (d: string) => format(new Date(d + 'T12:00:00'), "EEE d 'de' MMM", { locale: es });

/**
 * Excepciones temporarias de agenda: cerrar una mañana, una tarde, un día, una semana o varias (vacaciones),
 * o abrir un horario extra, sin tocar el horario semanal fijo. Pueden crearlas médicos y secretarias.
 */
const ScheduleExceptions = ({ defaultDoctorId }: { defaultDoctorId?: string }) => {
  const { doctors, exceptions, fetchExceptions, addException, removeException, worksAt } = useScheduleStore();
  const [doctorId, setDoctorId] = useState(defaultDoctorId || '');
  const [kind, setKind] = useState<'block' | 'open'>('block');
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [scope, setScope] = useState<'day' | 'morning' | 'afternoon' | 'hours'>('day');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchExceptions(true); }, []);
  useEffect(() => { if (!doctorId && (defaultDoctorId || doctors[0])) setDoctorId(defaultDoctorId || doctors[0].userId); }, [defaultDoctorId, doctors]);
  useEffect(() => { if (kind === 'open' && scope !== 'hours') setScope('hours'); }, [kind]);

  const name = (id: string) => doctors.find((d) => d.userId === id)?.fullName ?? 'Médico';
  const upcoming = useMemo(
    () => exceptions.filter((e) => e.dateTo >= todayStr()).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
    [exceptions],
  );

  const handleAdd = async () => {
    if (!doctorId) { toast.error('Elegí el médico'); return; }
    if (to < from) { toast.error('La fecha "hasta" no puede ser anterior a "desde"'); return; }
    let startTime: string | null = null;
    let endTime: string | null = null;
    if (scope === 'morning') { startTime = '00:00'; endTime = '13:00'; }
    else if (scope === 'afternoon') { startTime = '13:00'; endTime = '23:59'; }
    else if (scope === 'hours') {
      if (!start || !end || end <= start) { toast.error('Revisá el horario: "hasta" tiene que ser posterior a "desde"'); return; }
      startTime = start; endTime = end;
    }
    setSaving(true);
    try {
      await addException({ doctorId, kind, dateFrom: from, dateTo: to, startTime, endTime, reason: reason.trim() || null });
      toast.success(kind === 'block' ? 'Cierre guardado' : 'Horario extra guardado');
      setReason('');
      // Turnos que ya estaban dados y quedan fuera del horario: solo se avisan (la secretaria los mueve)
      if (kind === 'block') {
        const affected = useClinicStore.getState().appointments.filter(
          (a) => a.doctorId === doctorId && !a.esSobreturno && !isInactiveStatus(a.status) && a.status === 'pending'
            && a.date >= from && a.date <= to && !worksAt(doctorId, a.date, a.time),
        );
        if (affected.length > 0) toast.warning(`Hay ${affected.length} turno(s) de ${name(doctorId)} que quedaron fuera de horario. Aparecen marcados con ⚠ para moverlos.`);
      }
    } catch (e: any) {
      toast.error(e?.message ? `No se pudo guardar: ${e.message}` : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
      <h2 className="font-semibold flex items-center gap-2 text-sm">
        <CalendarOff className="w-4 h-4 text-primary" />
        Excepciones y vacaciones
      </h2>
      <p className="text-xs text-muted-foreground">
        Cerrá una mañana, una tarde, un día o varias semanas, o abrí un horario extra solo para una fecha, sin cambiar el horario fijo de la semana.
        Ejemplo: “este jueves atiendo solo a la mañana” = cerrar la tarde de ese jueves.
      </p>

      <div className="space-y-1">
        <Label className="text-xs">Médico</Label>
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
          <SelectContent>{doctors.map((d) => <SelectItem key={d.userId} value={d.userId}>{d.fullName}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Qué hacer</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as 'block' | 'open')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="block">Cerrar (no atiende)</SelectItem>
              <SelectItem value="open">Abrir horario extra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alcance</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)} disabled={kind === 'open'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Todo el día</SelectItem>
              <SelectItem value="morning">Solo la mañana</SelectItem>
              <SelectItem value="afternoon">Solo la tarde</SelectItem>
              <SelectItem value="hours">Horas específicas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta (inclusive)</Label>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {scope === 'hours' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Hora desde</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} step="600" /></div>
          <div className="space-y-1"><Label className="text-xs">Hora hasta</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} step="600" /></div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Motivo (opcional)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, congreso, etc." />
      </div>

      <Button onClick={handleAdd} className="w-full" size="sm" disabled={saving || !doctorId}>
        <Plus className="w-4 h-4 mr-1" /> Guardar
      </Button>

      {upcoming.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground">Próximas excepciones</h3>
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="leading-tight">
                <div className="font-medium">
                  {name(e.doctorId)} · {e.kind === 'block' ? 'Cerrado' : 'Abre'}{' '}
                  {e.startTime && e.endTime ? (e.startTime === '00:00' && e.endTime === '13:00' ? 'mañana' : e.startTime === '13:00' && e.endTime === '23:59' ? 'tarde' : `${e.startTime}-${e.endTime}`) : 'todo el día'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {e.dateFrom === e.dateTo ? fmt(e.dateFrom) : `${fmt(e.dateFrom)} → ${fmt(e.dateTo)}`}{e.reason ? ` · ${e.reason}` : ''}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={async () => { try { await removeException(e.id); toast.success('Excepción eliminada'); } catch { toast.error('No se pudo eliminar'); } }}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduleExceptions;
