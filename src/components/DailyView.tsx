import React, { useState, useMemo, memo } from 'react';
import { getDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, StudyStatus } from '@/types/medical';
import { STATUS_LABELS, formatStudyType, calcularEdad, calcularEdadDetallada, getStudyDuration } from '@/types/medical';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClinicStore } from '@/store/useClinicStore';
import { useScheduleStore } from '@/store/useScheduleStore';
import { toast } from 'sonner';
import { Save, Edit2, X, ClipboardList, Trash2, CalendarDays, UserCheck, Lock } from 'lucide-react';
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
  selectedDoctorId?: string;
}

const DailyView = ({ appointments, selectedDate, doctorSlots, patientsWithHistory, selectedDoctorId }: DailyViewProps) => {
  const navigate = useNavigate();
  const updateAppointmentTime = useClinicStore((s) => s.updateAppointmentTime);
  const updateAppointmentStudyType = useClinicStore((s) => s.updateAppointmentStudyType);
  const updateAppointmentStatus = useClinicStore((s) => s.updateAppointmentStatus);
  const updateAppointmentObservations = useClinicStore((s) => s.updateAppointmentObservations);
  const updatePatient = useClinicStore((s) => s.updatePatient);
  const updateAppointmentAsistio = useClinicStore((s) => s.updateAppointmentAsistio);
  const deleteAppointment = useClinicStore((s) => s.deleteAppointment);
  const rescheduleAppointment = useClinicStore((s) => s.rescheduleAppointment);
  // fetchAppointments removed — realtime sync handles updates automatically
  const getAppointmentsByDate = useClinicStore((s) => s.getAppointmentsByDate);
  const { generateAvailableSlots, schedules, doctors } = useScheduleStore();
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
  }>({ time: '', studyType: '', status: 'pending', observations: '', patientName: '', patientDni: '', patientPhone: '', patientObraSocial: '', patientFechaNacimiento: '' });

  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);
  const [historyPatientDni, setHistoryPatientDni] = useState('');
  const [historyPatientName, setHistoryPatientName] = useState('');
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
    const dayOfWeek = getDay(rescheduleDate);
    // Use the currently filtered doctor; fallback to the only doctor if there is just one
    const doctorId = selectedDoctorId && selectedDoctorId !== 'all'
      ? selectedDoctorId
      : (doctors.length === 1 ? doctors[0].userId : null);
    let slots: string[] = [];
    if (doctorId) {
      slots = generateAvailableSlots(doctorId, dayOfWeek);
    }
    if (slots.length === 0 && doctorSlots && doctorSlots.length > 0) {
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
    return slots.filter(s => !occupiedSet.has(s));
  }, [rescheduleTarget, rescheduleDate, doctors, schedules, doctorSlots, selectedDoctorId, getAppointmentsByDate]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const appointmentMap = useMemo(() => {
    const map = new Map<string, Appointment>();
    for (const a of appointments) {
      map.set(a.time, a);
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

  const occupiedCount = appointmentMap.size;


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
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (apt: Appointment) => {
    try {
      if (editData.time !== apt.time) await updateAppointmentTime(apt.id, editData.time);
      if (editData.studyType !== apt.studyType) await updateAppointmentStudyType(apt.id, editData.studyType);
      if (editData.status !== apt.status) await updateAppointmentStatus(apt.id, editData.status);
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
    } catch {
      toast.error('Error al actualizar');
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
      await rescheduleAppointment(rescheduleTarget.id, newDate, rescheduleTime);
      toast.success(`Cita trasladada al ${format(rescheduleDate, "d 'de' MMMM", { locale: es })} a las ${rescheduleTime}`);
    } catch {
      toast.error('Error al trasladar la cita');
    } finally {
      setRescheduleTarget(null);
      setRescheduleTime('');
    }
  };

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
      <h2 className="text-sm font-semibold text-muted-foreground">
        {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })} — {occupiedCount} cita(s)
      </h2>

      <div>
        <table className="w-full text-xs border-collapse table-auto">
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
            {timeSlots.map((slot, idx) => {
              const apt = appointmentMap.get(slot);
              const isOccupied = !!apt;
              const isEditing = apt && editingId === apt.id;
              const hasHistory = apt && patientsWithHistory?.has(getPatientHistoryKey(apt.patient));
              const overbook = isOverbook(slot);

              const prevSlot = idx > 0 ? timeSlots[idx - 1] : null;
              const slotHour = parseInt(slot.split(':')[0]);
              const prevHour = prevSlot ? parseInt(prevSlot.split(':')[0]) : null;
              const showMorningSep = slot === '08:00' || (idx === 0 && slotHour < 13);
              const showAfternoonSep = prevHour !== null && prevHour < 13 && slotHour >= 13;

              return (
                <React.Fragment key={`slot-${slot}`}>
                  {showMorningSep && (
                    <tr key="morning-sep">
                      <td colSpan={10} className="py-1.5 px-2 bg-primary/10 text-center text-[11px] text-primary font-bold border border-border border-t-2 border-t-primary/40 tracking-widest">
                        ☀ MAÑANA
                      </td>
                    </tr>
                  )}
                  {showAfternoonSep && (
                    <tr key="afternoon-sep">
                      <td colSpan={10} className="py-1.5 px-2 bg-amber-500/10 text-center text-[11px] text-amber-700 dark:text-amber-400 font-bold border border-border border-t-2 border-t-amber-500/40 tracking-widest">
                        🌅 TARDE
                      </td>
                    </tr>
                  )}
                  <tr
                    key={slot}
                    className={`transition-colors ${apt?.asistio ? 'bg-green-100 dark:bg-green-900/30' : overbook ? 'bg-accent/30 border-l-2 border-l-accent' : isOccupied ? 'bg-card hover:bg-muted/30' : 'opacity-50 hover:opacity-80 hover:bg-muted/20'}`}
                  >
                    <td className="p-1.5 border border-border font-mono text-center text-muted-foreground font-semibold">
                      {slot}
                      {overbook && <span className="ml-1 text-[9px] text-accent-foreground font-bold">ST</span>}
                    </td>

                    {isOccupied && apt ? (
                      <>
                        <td className="p-1.5 border border-border whitespace-nowrap">
                          {isEditing ? (
                            <Input value={editData.patientName} onChange={(e) => setEditData(d => ({ ...d, patientName: e.target.value.toUpperCase() }))} className="h-7 text-xs uppercase" placeholder="Nombre" />
                          ) : (
                            <span className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/appointment/${apt.id}`)}>
                              {apt.patient.name}
                            </span>
                          )}
                        </td>
                        <td className="p-1.5 border border-border">
                          {isEditing ? (
                            <Input value={editData.studyType} onChange={(e) => setEditData(d => ({ ...d, studyType: e.target.value }))} className="h-7 text-xs" />
                          ) : (
                            <span className="uppercase font-bold">{formatStudyType(apt.studyType)}</span>
                          )}
                        </td>
                        <td className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <Input value={editData.patientDni} onChange={(e) => setEditData(d => ({ ...d, patientDni: e.target.value }))} className="h-7 text-xs" placeholder="DNI" />
                          ) : (
                            <span className="flex items-center gap-1">
                              {apt.patient.dni || '-'}
                              {hasHistory && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHistoryPatientId(apt.patientId);
                                     setHistoryPatientDni(apt.patient.dni || '');
                                    setHistoryPatientName(apt.patient.name);
                                  }}
                                  className="text-primary hover:text-primary/80 transition-colors"
                                  title="Ver historial de estudios"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="p-1.5 border border-border text-muted-foreground">
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
                        <td className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <Input value={editData.patientPhone} onChange={(e) => setEditData(d => ({ ...d, patientPhone: e.target.value }))} className="h-7 text-xs" placeholder="Teléfono" />
                          ) : (
                            apt.patient.phone?.replace(/^\+54\s?/, '') || '-'
                          )}
                        </td>
                        <td className="p-1.5 border border-border text-muted-foreground">
                          {isEditing ? (
                            <Input value={editData.patientObraSocial} onChange={(e) => setEditData(d => ({ ...d, patientObraSocial: e.target.value.toUpperCase() }))} className="h-7 text-xs uppercase" placeholder="Obra Social" />
                          ) : (
                            apt.patient.obraSocial || '-'
                          )}
                        </td>
                        <td className="p-1.5 border border-border">
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
                        <td className="p-1.5 border border-border">
                          {isEditing ? (
                            <Input value={editData.observations} onChange={(e) => setEditData(d => ({ ...d, observations: e.target.value.toUpperCase() }))} className="h-7 text-xs uppercase" placeholder="Observaciones..." />
                          ) : (
                            <span className="text-muted-foreground">{apt.observations || '-'}</span>
                          )}
                        </td>
                        <td className="p-1.5 border border-border text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => saveEdit(apt)}>
                                <Save className="w-3 h-3 text-primary" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={cancelEdit}>
                                <X className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              {!apt.asistio && (
                                <Button
                                  variant="ghost" size="sm" className="h-6 w-6 p-0"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    updateAppointmentAsistio(apt.id, true);
                                    toast.success(`${apt.patient.name} confirmado/a en sala`);
                                  }}
                                  title="Confirmar recepción"
                                >
                                  <UserCheck className="w-3 h-3 text-green-600" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(apt)} title="Editar">
                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                              {apt.status === 'sent' ? (
                                <>
                                  <Button
                                    variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-40 cursor-not-allowed"
                                    disabled
                                    title="Bloqueado: estudio enviado"
                                    onClick={(e) => { e.stopPropagation(); toast.info('Estudio enviado: traslado bloqueado por seguridad'); }}
                                  >
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-40 cursor-not-allowed"
                                    disabled
                                    title="Bloqueado: estudio enviado"
                                    onClick={(e) => { e.stopPropagation(); toast.info('Estudio enviado: eliminación bloqueada por seguridad'); }}
                                  >
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openReschedule(apt)} title="Trasladar">
                                    <CalendarDays className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDeleteTarget(apt)} title="Eliminar">
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
                        onCancel={() => setPreAppointmentSlot(null)}
                        onSaved={() => {
                          setPreAppointmentSlot(null);
                        }}
                      />
                    ) : blockedBySpecial.has(slot) ? (
                      <td
                        colSpan={9}
                        className="p-1.5 border border-border text-center text-amber-700 dark:text-amber-400 italic bg-amber-500/5 text-[11px]"
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
          onOpenChange={(open) => { if (!open) { setHistoryPatientId(null); setHistoryPatientDni(''); } }}
        />
      )}

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
