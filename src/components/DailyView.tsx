import React, { useState, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, StudyStatus } from '@/types/medical';
import { isInactiveStatus } from '@/types/medical';
import { checkPlacement, slotsNeeded as slotsNeededFor, type SlottedAppointment } from '@/lib/agendaRules';
import { firstUncoveredSlot, doctorsAtSlot } from '@/lib/doctorHours';
import OutOfHoursDialog from '@/components/OutOfHoursDialog';
import { verifyPlacement } from '@/lib/agendaCheck';
import { STATUS_LABELS, ARRIVAL_LABELS, resolveArrival, type ArrivalState, formatStudyType, calcularEdad, calcularEdadDetallada, getStudyDuration } from '@/types/medical';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClinicStore } from '@/store/useClinicStore';
import { useScheduleStore } from '@/store/useScheduleStore';
import { toast } from 'sonner';
import { Save, Edit2, X, ClipboardList, Plus, Trash2, CalendarDays, UserCheck, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import PatientHistoryModal from '@/components/PatientHistoryModal';
import InlineAppointmentForm from '@/components/InlineAppointmentForm';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getPatientHistoryKey } from '@/types/medical';

const statusClass: Record<StudyStatus, string> = {
  'pending': 'status-badge-pending',
  'in-study': 'status-badge-in-study',
  'reported': 'status-badge-reported',
  'sent': 'status-badge-sent',
  'cancelled': 'bg-muted text-muted-foreground line-through',
  'no-show': 'bg-muted text-muted-foreground',
};

function generateDefaultTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 13; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  for (let h = 15; h < 21; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

const DEFAULT_TIME_SLOTS = generateDefaultTimeSlots();

function generateAllTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h < 22; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}
const ALL_TIME_SLOTS = generateAllTimeSlots();

interface DailyViewProps {
  appointments: Appointment[];
  selectedDate: Date;
  doctorSlots?: string[] | null;
  patientsWithHistory?: Set<string>;
  onPreviousStudiesChanged?: () => void;
  selectedDoctorId?: string;
}

const DailyView = ({ appointments, selectedDate, doctorSlots, patientsWithHistory, selectedDoctorId, onPreviousStudiesChanged }: DailyViewProps) => {
  const navigate = useNavigate();
  const updateAppointmentTime = useClinicStore((s) => s.updateAppointmentTime);
  const updateAppointmentStudyType = useClinicStore((s) => s.updateAppointmentStudyType);
  const updateAppointmentStatus = useClinicStore((s) => s.updateAppointmentStatus);
  const updateAppointmentObservations = useClinicStore((s) => s.updateAppointmentObservations);
  const updatePatient = useClinicStore((s) => s.updatePatient);
  const setArrivalState = useClinicStore((s) => s.setArrivalState);
  const arrivalOf = (a?: { arrivalState?: ArrivalState; asistio?: boolean } | null): ArrivalState => (a ? resolveArrival(a) : null);
  const deleteAppointment = useClinicStore((s) => s.deleteAppointment);
  const rescheduleAppointment = useClinicStore((s) => s.rescheduleAppointment);
  const updateAppointmentSchedule = useClinicStore((s) => s.updateAppointmentSchedule);
  // fetchAppointments removed — realtime sync handles updates automatically
  const getAppointmentsByDate = useClinicStore((s) => s.getAppointmentsByDate);
  const { slotsOnDate, worksAt, hoursContext, schedules, exceptions, blockedDates, doctors } = useScheduleStore();
  const doctorName = (id?: string | null) => (id ? doctors.find((d) => d.userId === id)?.fullName ?? '' : '');
  const [hoursDlg, setHoursDlg] = useState<null | { kind: 'normal' | 'sobreturno'; slot: string; apt: Appointment; date: string; who: 'edit' | 'move'; newDoctorId: string }>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    time: string;
    studyType: string;
    status: StudyStatus;
    observations: string;
    patientName: string;
    patientDni: string;
    patientPhone: string;
    patientObraSocial: string;
    patientFechaNacimiento: string;
    doctorId: string;
  }>({ time: '', studyType: '', status: 'pending', observations: '', patientName: '', patientDni: '', patientPhone: '', patientObraSocial: '', patientFechaNacimiento: '', doctorId: '' });

  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);
  const [historyPatientDni, setHistoryPatientDni] = useState('');
  const [historyPatientName, setHistoryPatientName] = useState('');
  const [historyAdding, setHistoryAdding] = useState(false);
  const { isViewer, role } = useAuth();
  const canUpload = !!role && !isViewer;
  const [preAppointmentSlot, setPreAppointmentSlot] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  // Reschedule state
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Available slots for reschedule target date
  const rescheduleAvailableSlots = useMemo(() => {
    if (!rescheduleTarget) return [];
    const rescheduleDateStr0 = format(rescheduleDate, 'yyyy-MM-dd');
    // Horarios reales del médico del turno ese día (con excepciones y vacaciones); si no atiende, los de todos los médicos
    const doctorId = rescheduleTarget.doctorId
      || (selectedDoctorId && selectedDoctorId !== 'all' ? selectedDoctorId : (doctors.length === 1 ? doctors[0].userId : null));
    let slots: string[] = doctorId ? slotsOnDate(doctorId, rescheduleDateStr0) : [];
    if (slots.length === 0) {
      slots = [...new Set(doctors.flatMap((d) => slotsOnDate(d.userId, rescheduleDateStr0)))].sort();
    }
    if (slots.length === 0 && doctorSlots && doctorSlots.length > 0 && rescheduleDateStr0 === dateStr) {
      slots = [...doctorSlots];
    }
    if (slots.length === 0) {
      slots = generateDefaultTimeSlots();
    }
    // Filter out occupied slots on the target date
    const rescheduleDateStr = format(rescheduleDate, 'yyyy-MM-dd');
    const occupied = getAppointmentsByDate(rescheduleDateStr)
      .filter(a => a.id !== rescheduleTarget.id)
      .map(a => a.time);
    const occupiedSet = new Set(occupied);
    // Regla de 2 turnos: solo se ofrecen horarios donde el estudio entra (el segundo turno de un estudio doble no se ofrece)
    const dayList = getAppointmentsByDate(rescheduleDateStr) as SlottedAppointment[];
    return slots.filter(s => !occupiedSet.has(s) && checkPlacement(dayList, {
      id: rescheduleTarget.id, time: s, studyType: rescheduleTarget.studyType, doctorId: rescheduleTarget.doctorId, validSlots: slots,
    }).ok);
  }, [rescheduleTarget, rescheduleDate, doctors, schedules, exceptions, blockedDates, doctorSlots, selectedDoctorId, getAppointmentsByDate]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const appointmentMap = useMemo(() => {
    const map = new Map<string, Appointment>();
    for (const a of appointments) {
      if (isInactiveStatus(a.status)) continue;
      map.set(a.time, a);
    }
    return map;
  }, [appointments]);

  // Todos los turnos de cada hora (si hay más de uno, el segundo en adelante es sobreturno y también se muestra)
  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const list = map.get(a.time);
      if (list) list.push(a); else map.set(a.time, [a]);
    }
    return map;
  }, [appointments]);

  const timeSlots = useMemo(() => {
    const baseSlots = doctorSlots && doctorSlots.length > 0 ? doctorSlots : DEFAULT_TIME_SLOTS;
    const slotSet = new Set(baseSlots);
    for (const time of appointmentMap.keys()) {
      slotSet.add(time);
    }
    return [...slotSet].sort();
  }, [doctorSlots, appointmentMap]);

  // A: slots that are visually blocked because the previous appointment is a special
  // study (Doppler / TN / Morfológica / etc.) and consumes more than one 10-min slot.
  const blockedBySpecial = useMemo(() => {
    const blocked = new Map<string, Appointment>(); // slot -> parent appointment
    const baseInterval = 10;
    for (const apt of appointments) {
      const duration = getStudyDuration(apt.studyType, baseInterval);
      const slotsNeeded = Math.max(1, Math.ceil(duration / baseInterval));
      if (slotsNeeded <= 1) continue;
      const idx = timeSlots.indexOf(apt.time);
      if (idx < 0) continue;
      for (let i = 1; i < slotsNeeded; i++) {
        const target = timeSlots[idx + i];
        if (target && !appointmentMap.has(target)) blocked.set(target, apt);
      }
    }
    return blocked;
  }, [appointments, timeSlots, appointmentMap]);

  const occupiedCount = appointments.filter((a) => !isInactiveStatus(a.status)).length;


  const startEdit = (apt: Appointment) => {
    setEditingId(apt.id);
    setEditData({
      time: apt.time,
      studyType: apt.studyType,
      status: apt.status,
      observations: apt.observations || '',
      patientName: apt.patient.name,
      patientDni: apt.patient.dni || '',
      patientPhone: apt.patient.phone,
      patientObraSocial: apt.patient.obraSocial || '',
      patientFechaNacimiento: apt.patient.fechaNacimiento || '',
      doctorId: apt.doctorId || '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (apt: Appointment, acordadoCon?: string) => {
    try {
      const timeChanged = editData.time !== apt.time;
      const studyChanged = editData.studyType !== apt.studyType;
      const statusChanged = editData.status !== apt.status;
      const reactivated = statusChanged && isInactiveStatus(apt.status) && !isInactiveStatus(editData.status);
      // Regla de 2 turnos: si cambia la hora, el estudio (por ejemplo "ecografía" pasa a "Doppler") o se reactiva un turno cancelado,
      // el resultado final tiene que entrar en la agenda. Se verifica antes de tocar nada.
      const newDoc = editData.doctorId || apt.doctorId || '';
      const doctorChanged = !!editData.doctorId && editData.doctorId !== (apt.doctorId || '');
      // Horario del médico: al mover el turno o cambiarle el médico tiene que atender a esa hora.
      // No se rebota: se avisa quién está disponible y se ofrece darlo con él (el sobreturno pide confirmación explícita).
      if ((timeChanged || doctorChanged || reactivated) && !isInactiveStatus(editData.status) && newDoc) {
        const n = apt.esSobreturno ? 1 : slotsNeededFor(editData.studyType);
        const bad = firstUncoveredSlot(newDoc, apt.date, editData.time, n, hoursContext());
        if (bad && !(apt.esSobreturno && acordadoCon)) {
          setHoursDlg({ kind: apt.esSobreturno ? 'sobreturno' : 'normal', slot: bad, apt, date: apt.date, who: 'edit', newDoctorId: newDoc });
          return;
        }
      }
      if ((timeChanged || studyChanged || reactivated || doctorChanged) && !isInactiveStatus(editData.status) && !apt.esSobreturno) {
        const fit = await verifyPlacement({ id: apt.id, date: apt.date, time: editData.time, studyType: editData.studyType, doctorId: newDoc });
        if (!fit.ok) {
          toast.error(fit.message);
          return;
        }
      }
      await updateAppointmentSchedule(apt.id, {
        ...(timeChanged ? { time: editData.time } : {}),
        ...(studyChanged ? { studyType: editData.studyType } : {}),
        ...(statusChanged ? { status: editData.status } : {}),
        ...(doctorChanged ? { doctorId: editData.doctorId } : {}),
        ...(acordadoCon ? { sobreturnoAcordadoCon: acordadoCon } : {}),
      });
      if (editData.observations !== (apt.observations || '')) await updateAppointmentObservations(apt.id, editData.observations);
      const patientChanges: any = {};
      if (editData.patientName !== apt.patient.name) patientChanges.name = editData.patientName;
      if (editData.patientDni !== (apt.patient.dni || '')) patientChanges.dni = editData.patientDni;
      if (editData.patientPhone !== apt.patient.phone) patientChanges.phone = editData.patientPhone;
      if (editData.patientObraSocial !== (apt.patient.obraSocial || '')) patientChanges.obraSocial = editData.patientObraSocial;
      if (editData.patientFechaNacimiento !== (apt.patient.fechaNacimiento || '')) patientChanges.fechaNacimiento = editData.patientFechaNacimiento;
      if (Object.keys(patientChanges).length > 0) await updatePatient(apt.patientId, patientChanges);
      setEditingId(null);
      toast.success('Cita actualizada');
    } catch (err: any) {
      toast.error(err?.message ? `No se pudo actualizar: ${err.message}` : 'Error al actualizar');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAppointment(deleteTarget.id);
      toast.success('Cita eliminada correctamente');
    } catch {
      toast.error('Error al eliminar la cita');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleTime) return;
    try {
      const newDate = format(rescheduleDate, 'yyyy-MM-dd');
      // El médico tiene que atender en el nuevo día y horario; si no, se pasa al que atiende a esa hora.
      const ids = doctors.map((d) => d.userId);
      const ctx = hoursContext();
      const needed = rescheduleTarget.esSobreturno ? 1 : slotsNeededFor(rescheduleTarget.studyType);
      let newDoctorId = rescheduleTarget.doctorId || '';
      const covered = (id: string) => !!id && firstUncoveredSlot(id, newDate, rescheduleTime, needed, ctx) === null;
      if (!covered(newDoctorId)) {
        const alt = doctorsAtSlot(ids, newDate, rescheduleTime, ctx).find((id) => covered(id));
        if (alt) newDoctorId = alt;
        else if (!rescheduleTarget.esSobreturno) {
          toast.error('A ese día y horario no atiende ningún médico. Elegí otro horario.');
          return;
        }
      }
      // Regla de 2 turnos también al pasar el turno a otro día u hora
      if (!rescheduleTarget.esSobreturno) {
        const fit = await verifyPlacement({ id: rescheduleTarget.id, date: newDate, time: rescheduleTime, studyType: rescheduleTarget.studyType, doctorId: newDoctorId });
        if (!fit.ok) {
          toast.error(fit.message);
          return;
        }
      }
      await rescheduleAppointment(rescheduleTarget.id, newDate, rescheduleTime, newDoctorId && newDoctorId !== rescheduleTarget.doctorId ? newDoctorId : undefined);
      toast.success(`Cita trasladada al ${format(rescheduleDate, "d 'de' MMMM", { locale: es })} a las ${rescheduleTime}`);
      setRescheduleTarget(null);
      setRescheduleTime('');
    } catch (err: any) {
      // Si no entra o falla, la ventana queda abierta para elegir otro horario
      toast.error(err?.message ? `No se pudo trasladar: ${err.message}` : 'Error al trasladar la cita');
    }
  };

  const timeRows = useMemo(() => {
    const rows: { slot: string; apt: Appointment | undefined; extra: boolean }[] = [];
    for (const slot of timeSlots) {
      const list = appointmentsBySlot.get(slot) || [];
      let activeSeen = 0;
      for (const a of list) {
        const inactive = isInactiveStatus(a.status);
        rows.push({ slot, apt: a, extra: !inactive && activeSeen > 0 });
        if (!inactive) activeSeen++;
      }
      // Si no queda ningún turno activo en esa hora, el horario vuelve a estar libre
      if (activeSeen === 0) rows.push({ slot, apt: undefined, extra: false });
    }
    return rows;
  }, [timeSlots, appointmentsBySlot]);

  const openReschedule = (apt: Appointment) => {
    setRescheduleTarget(apt);
    setRescheduleDate(selectedDate);
    setRescheduleTime(apt.time);
  };

  const isOverbook = (slot: string) => {
    if (!doctorSlots || doctorSlots.length === 0) return false;
    return !doctorSlots.includes(slot) && appointmentMap.has(slot);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 border-b border-border pb-4 mb-4">
        <span className="text-3xl font-semibold tabular-nums text-status-pending">{occupiedCount}</span>
        <h2 className="text-sm text-muted-foreground">Turnos del día</h2>
      </div>

      <div>
        <table className="agenda-table w-full text-xs table-auto">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">Hora</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">Paciente</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap min-w-[140px]">Estudio</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap w-[70px]">DNI</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">F.Nac. / Edad</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">Teléfono</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">Obra Social</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">Estado</th>
              <th className="p-2 border border-border text-left font-semibold text-muted-foreground whitespace-nowrap">Observaciones</th>
              <th className="p-2 border border-border text-center font-semibold text-muted-foreground whitespace-nowrap">Acc.</th>
            </tr>
          </thead>
          <tbody>
            {timeRows.map(({ slot, apt, extra }, idx) => {
              const isOccupied = !!apt;
              const isEditing = apt && editingId === apt.id;
              const hasHistory = apt && patientsWithHistory?.has(getPatientHistoryKey(apt.patient));
              const overbook = isOverbook(slot);

              const prevSlot = idx > 0 ? timeRows[idx - 1].slot : null;
              const slotHour = parseInt(slot.split(':')[0]);
              const prevHour = prevSlot ? parseInt(prevSlot.split(':')[0]) : null;
              const firstOfSlot = idx === 0 || timeRows[idx - 1].slot !== slot;
              const showMorningSep = firstOfSlot && (slot === '08:00' || (idx === 0 && slotHour < 13));
              const showAfternoonSep = prevHour !== null && prevHour < 13 && slotHour >= 13;

              return (
                <React.Fragment key={`slot-${slot}-${apt?.id ?? 'libre'}`}>
                  {showMorningSep && (
                    <tr key="morning-sep">
                      <td colSpan={10} className="py-1.5 px-2 bg-primary/10 text-center text-[11px] text-primary font-bold border border-border border-t-2 border-t-primary/40 tracking-normal">
                        ☀ MAÑANA
                      </td>
                    </tr>
                  )}
                  {showAfternoonSep && (
                    <tr key="afternoon-sep">
                      <td colSpan={10} className="py-1.5 px-2 bg-status-late/10 text-center text-[11px] text-status-late font-bold border border-border border-t-2 border-t-status-late/40 tracking-normal">
                        🌅 TARDE
                      </td>
                    </tr>
                  )}
                  <tr
                    key={`row-${slot}-${apt?.id ?? 'libre'}`}
                    data-occupied={isOccupied} data-editing={!!isEditing} className={`agenda-row transition-colors ${apt && isInactiveStatus(apt.status) ? 'bg-muted/40 opacity-60' : arrivalOf(apt) === 'arrived' ? 'agenda-arrived' : arrivalOf(apt) === 'late' ? 'agenda-late' : arrivalOf(apt) === 'missed' ? 'agenda-missed' : extra ? 'bg-status-late/5 border-l-[3px] border-l-status-late' : overbook ? 'bg-accent/5 border-l-[3px] border-l-accent' : isOccupied ? 'agenda-pending bg-card hover:bg-muted/30' : 'opacity-50 hover:opacity-80 hover:bg-muted/20'}`}
                  >
                    <td data-label="Hora" className="p-1.5 border border-border tabular-nums text-center text-muted-foreground font-semibold">
                      {slot}
                      {overbook && <span className="ml-1 text-[9px] text-accent font-bold">ST</span>}
                      {(extra || apt?.esSobreturno) && (
                        <span
                          className="ml-1 text-[9px] text-status-late font-bold"
                          title={`Sobreturno${apt?.doctorId ? ' de ' + doctorName(apt.doctorId) : ''}${apt?.sobreturnoAcordadoCon ? ' · acordado con: ' + apt.sobreturnoAcordadoCon : ''}`}
                        >
                          SOB{apt?.doctorId && apt.doctorId !== selectedDoctorId ? ` · ${doctorName(apt.doctorId).split(' ').slice(0, 2).join(' ')}` : ''}
                        </span>
                      )}
                      {apt && !apt.esSobreturno && !extra && apt.doctorId && apt.status === 'pending' && !worksAt(apt.doctorId, apt.date, apt.time) && (
                        <span className="ml-1 text-[9px] text-status-missed font-bold" title={`${doctorName(apt.doctorId)} ya no atiende a esta hora. Hay que mover el turno.`}>⚠ FUERA DE HORARIO</span>
                      )}
                    </td>

                    {isOccupied && apt ? (
                      <>
                        <td data-label="Paciente" className="p-1.5 border border-border whitespace-nowrap">
                          {isEditing ? (
                            <Input value={editData.patientName} onChange={(e) => setEditData(d => ({ ...d, patientName: e.target.value.toUpperCase() }))} className="h-7 text-xs uppercase" placeholder="Nombre" />
                          ) : (
                            <span className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/appointment/${apt.id}`)}>
                              {apt.patient.name}
                            </span>
                          )}
                        </td>
                        <td data-label="Estudio" className="p-1.5 border border-border">
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input value={editData.studyType} onChange={(e) => setEditData(d => ({ ...d, studyType: e.target.value }))} className="h-7 text-xs" />
                              {doctors.length > 1 && (apt.status === 'pending' || isInactiveStatus(apt.status)) && (
                                <Select value={editData.doctorId} onValueChange={(v) => setEditData(d => ({ ...d, doctorId: v }))}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Médico" /></SelectTrigger>
                                  <SelectContent>
                                    {doctors.map((d) => <SelectItem key={d.userId} value={d.userId}>{d.fullName}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          ) : (
                            <div><span className="uppercase font-semibold">{formatStudyType(apt.studyType)}</span>{apt.doctorId && <p className="mt-1 text-[11px] text-muted-foreground">{doctorName(apt.doctorId)}</p>}</div>
                          )}
                        </td>
                        <td data-label="DNI" className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <Input value={editData.patientDni} onChange={(e) => setEditData(d => ({ ...d, patientDni: e.target.value }))} className="h-7 text-xs" placeholder="DNI" />
                          ) : (
                            <span className="flex items-center gap-1">
                              {apt.patient.dni || '-'}
                              {hasHistory ? (
                                <Button variant="ghost" size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHistoryAdding(false);
                                    setHistoryPatientId(apt.patientId);
                                     setHistoryPatientDni(apt.patient.dni || '');
                                    setHistoryPatientName(apt.patient.name);
                                  }}
                                  className="h-7 w-7 text-primary hover:text-primary/80 transition-colors"
                                  title="Ver historial de estudios"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                </Button>
                              ) : canUpload ? (
                                <Button variant="ghost" size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHistoryAdding(true);
                                    setHistoryPatientId(apt.patientId);
                                     setHistoryPatientDni(apt.patient.dni || '');
                                    setHistoryPatientName(apt.patient.name);
                                  }}
                                  className="h-7 w-7 text-primary hover:text-primary/80 transition-colors"
                                  title="Cargar estudio previo"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              ) : null}
                            </span>
                          )}
                        </td>
                        <td data-label="F.Nac. / Edad" className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <div className="flex flex-col gap-0.5">
                              <Input type="date" value={editData.patientFechaNacimiento} onChange={(e) => setEditData(d => ({ ...d, patientFechaNacimiento: e.target.value }))} className="h-7 text-xs" />
                              {editData.patientFechaNacimiento && (
                                <span className="text-[10px] text-muted-foreground">{calcularEdad(editData.patientFechaNacimiento)} años</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col leading-tight">
                              {apt.patient.fechaNacimiento ? (() => {
                                const e = calcularEdadDetallada(apt.patient.fechaNacimiento);
                                return (
                                  <>
                                    <span className="text-xs text-foreground"><span className="font-bold">{e.value}</span> {e.unit}</span>
                                    <span className="text-[10px] text-muted-foreground">{apt.patient.fechaNacimiento}</span>
                                  </>
                                );
                              })() : (
                                apt.patient.age ? <span className="text-xs text-foreground"><span className="font-bold">{apt.patient.age}</span> años</span> : <span className="text-xs">-</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td data-label="Teléfono" className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <Input value={editData.patientPhone} onChange={(e) => setEditData(d => ({ ...d, patientPhone: e.target.value }))} className="h-7 text-xs" placeholder="Teléfono" />
                          ) : (
                            apt.patient.phone?.replace(/^\+54\s?/, '') || '-'
                          )}
                        </td>
                        <td data-label="Obra Social" className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <Input value={editData.patientObraSocial} onChange={(e) => setEditData(d => ({ ...d, patientObraSocial: e.target.value.toUpperCase() }))} className="h-7 text-xs uppercase" placeholder="Obra Social" />
                          ) : (
                            apt.patient.obraSocial || '-'
                          )}
                        </td>
                        <td data-label="Estado" className="p-1.5 border border-border">
                          {isEditing ? (
                            <Select value={editData.status} onValueChange={(v) => setEditData(d => ({ ...d, status: v as StudyStatus }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {apt.status === 'sent' ? (
                                  <SelectItem value="sent">Enviado</SelectItem>
                                ) : (
                                  <>
                                    <SelectItem value="pending">Pendiente</SelectItem>
                                    <SelectItem value="in-study">En estudio</SelectItem>
                                    <SelectItem value="reported">Reportado</SelectItem>
                                    <SelectItem value="sent">Enviado</SelectItem>
                                    {(apt.status === 'pending' || apt.status === 'in-study' || isInactiveStatus(apt.status)) && (
                                      <>
                                        <SelectItem value="cancelled">Cancelado</SelectItem>
                                        <SelectItem value="no-show">Ausente</SelectItem>
                                      </>
                                    )}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] ${statusClass[apt.status]}`}>
                              {STATUS_LABELS[apt.status]}
                            </Badge>
                          )}
                        </td>
                        <td data-label="Observaciones" className="p-1.5 border border-border">
                          {isEditing ? (
                            <Input value={editData.observations} onChange={(e) => setEditData(d => ({ ...d, observations: e.target.value.toUpperCase() }))} className="h-7 text-xs uppercase" placeholder="Observaciones..." />
                          ) : (
                            <span className="text-muted-foreground">{apt.observations || '-'}</span>
                          )}
                        </td>
                        <td data-label="Acciones" className="p-1.5 border border-border text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => saveEdit(apt)}>
                                <Save className="w-3 h-3 text-primary" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={cancelEdit}>
                                <X className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost" size="sm" className="h-8 w-8 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                    title={arrivalOf(apt) ? ARRIVAL_LABELS[arrivalOf(apt) as 'arrived' | 'late' | 'missed'] : 'Marcar llegada'}
                                  >
                                    <UserCheck className={`w-3 h-3 ${arrivalOf(apt) === 'arrived' ? 'text-status-arrived' : arrivalOf(apt) === 'late' ? 'text-status-late' : arrivalOf(apt) === 'missed' ? 'text-status-missed' : 'text-muted-foreground'}`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-1" align="end" onClick={(e) => e.stopPropagation()}>
                                  {([
                                    ['arrived', 'bg-status-arrived'],
                                    ['late', 'bg-status-late'],
                                    ['missed', 'bg-status-missed'],
                                  ] as const).map(([st, dot]) => (
                                    <button
                                      key={st}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                                      onClick={async () => {
                                        try {
                                          await setArrivalState(apt.id, st);
                                          toast.success(`${apt.patient.name}: ${ARRIVAL_LABELS[st].toLowerCase()}`);
                                        } catch { toast.error('No se pudo guardar'); }
                                      }}
                                    >
                                      <span className={`w-3 h-3 rounded-full ${dot}`} />
                                      {ARRIVAL_LABELS[st]}{arrivalOf(apt) === st ? ' ✓' : ''}
                                    </button>
                                  ))}
                                  {arrivalOf(apt) && (
                                    <button
                                      className="w-full px-2 py-1.5 text-sm rounded hover:bg-muted text-left text-muted-foreground border-t border-border mt-1"
                                      onClick={async () => {
                                        try { await setArrivalState(apt.id, null); toast.success('Llegada sin marcar'); } catch { toast.error('No se pudo guardar'); }
                                      }}
                                    >Sin marcar</button>
                                  )}
                                </PopoverContent>
                              </Popover>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(apt)} title="Editar">
                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                              {apt.status === 'sent' ? (
                                <>
                                  <Button
                                    variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-40 cursor-not-allowed"
                                    disabled
                                    title="Bloqueado: estudio enviado"
                                    onClick={(e) => { e.stopPropagation(); toast.info('Estudio enviado: traslado bloqueado por seguridad'); }}
                                  >
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-40 cursor-not-allowed"
                                    disabled
                                    title="Bloqueado: estudio enviado"
                                    onClick={(e) => { e.stopPropagation(); toast.info('Estudio enviado: eliminación bloqueada por seguridad'); }}
                                  >
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openReschedule(apt)} title="Trasladar">
                                    <CalendarDays className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteTarget(apt)} title="Eliminar">
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </>
                    ) : preAppointmentSlot === slot ? (
                      <InlineAppointmentForm
                        slot={slot}
                        date={dateStr}
                        doctorId={selectedDoctorId && selectedDoctorId !== 'all' ? selectedDoctorId : undefined}
                        onCancel={() => setPreAppointmentSlot(null)}
                        onSaved={() => {
                          setPreAppointmentSlot(null);
                        }}
                      />
                    ) : blockedBySpecial.has(slot) ? (
                      <td
                        colSpan={9}
                        className="p-1.5 border border-border text-center text-status-late italic bg-status-late/5 text-[11px]"
                        title={`Ocupado por estudio especial previo (${formatStudyType(blockedBySpecial.get(slot)!.studyType)} - ${blockedBySpecial.get(slot)!.time})`}
                      >
                        ⏳ Continuación de {blockedBySpecial.get(slot)!.time} ({formatStudyType(blockedBySpecial.get(slot)!.studyType)})
                      </td>
                    ) : (
                      <td
                        colSpan={9}
                        className="p-1.5 border border-border text-center text-muted-foreground/60 italic cursor-pointer hover:bg-primary/5 hover:text-primary transition-colors"
                        onClick={() => setPreAppointmentSlot(slot)}
                      >
                        + Nuevo turno
                      </td>
                    )}

                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {historyPatientId && (
        <PatientHistoryModal
          patientId={historyPatientId}
          patientDni={historyPatientDni}
          patientName={historyPatientName}
          open={!!historyPatientId}
          initiallyAdding={historyAdding}
          onChanged={onPreviousStudiesChanged}
          onOpenChange={(open) => { if (!open) { setHistoryPatientId(null); setHistoryPatientDni(''); setHistoryAdding(false); } }}
        />
      )}

      <OutOfHoursDialog
        open={!!hoursDlg}
        kind={hoursDlg?.kind ?? 'normal'}
        doctorName={doctorName(hoursDlg?.newDoctorId) || 'El médico'}
        when={hoursDlg ? `el ${hoursDlg.date.split('-').reverse().join('/')} a las ${hoursDlg.slot}` : ''}
        available={hoursDlg ? doctorsAtSlot(doctors.map((d) => d.userId), hoursDlg.date, hoursDlg.slot, hoursContext()).filter((id) => id !== hoursDlg.newDoctorId).map((id) => ({ id, name: doctorName(id) })) : []}
        onPickDoctor={(id) => { setEditData((d) => ({ ...d, doctorId: id })); setHoursDlg(null); toast.info('Cambié el médico. Revisá y guardá.'); }}
        onConfirmSobreturno={(who) => { const t = hoursDlg?.apt; setHoursDlg(null); if (t) saveEdit(t, who); }}
        onClose={() => setHoursDlg(null)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>Se eliminará la cita de <strong>{deleteTarget.patient.name}</strong> del {format(selectedDate, "d 'de' MMMM yyyy", { locale: es })} a las {deleteTarget.time}. Esta acción no se puede deshacer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => { if (!open) { setRescheduleTarget(null); setRescheduleTime(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trasladar cita</DialogTitle>
            <DialogDescription>
              {rescheduleTarget && (
                <>Trasladar la cita de <strong>{rescheduleTarget.patient.name}</strong> a una nueva fecha y horario.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nueva fecha</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {format(rescheduleDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rescheduleDate}
                    onSelect={(d) => { if (d) { setRescheduleDate(d); setRescheduleTime(''); } }}
                    locale={es}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nuevo horario</label>
              <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar horario" />
                </SelectTrigger>
                <SelectContent>
                  {rescheduleAvailableSlots.length > 0 ? (
                    rescheduleAvailableSlots.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No hay horarios disponibles</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRescheduleTarget(null); setRescheduleTime(''); }}>Cancelar</Button>
            <Button onClick={handleReschedule} disabled={!rescheduleTime}>Trasladar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(DailyView);
