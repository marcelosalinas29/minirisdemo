import { useState, useEffect, useMemo } from 'react';
import { format, addDays, subDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Wifi, Ban, ShieldOff } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useClinicStore } from '@/store/useClinicStore';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getPatientHistoryKey, normalizeDni } from '@/types/medical';
import DailyView from '@/components/DailyView';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const today = new Date();
  const { role, isViewer } = useAuth();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [testingConnection, setTestingConnection] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const allAppointments = useClinicStore((s) => s.appointments);
  const fetchAppointments = useClinicStore((s) => s.fetchAppointments);
  const fetchPatients = useClinicStore((s) => s.fetchPatients);
  const loading = useClinicStore((s) => s.loading);
  const { doctors, fetchDoctors, fetchAllSchedules, generateAvailableSlots, blockedDates, fetchBlockedDates, addBlockedDate, removeBlockedDate, isDateBlocked } = useScheduleStore();

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const dayAppointments = useMemo(
    () => allAppointments.filter(a => a.date === dateStr),
    [allAppointments, dateStr]
  );
  // Set completo de pacientes con historial por DNI normalizado (incluye estudios fuera de la ventana del store).
  const [historicalPatientKeys, setHistoricalPatientKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('patient_id, patients(id, dni)');
      if (cancelled || error || !data) return;
      const counts = new Map<string, number>();
      for (const row of data as { patient_id: string; patients: { id: string; dni: string | null } | null }[]) {
        const dniKey = normalizeDni(row.patients?.dni);
        const key = dniKey ? `dni:${dniKey}` : `patient:${row.patient_id}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      setHistoricalPatientKeys(new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([key]) => key)));
    })();
    return () => { cancelled = true; };
  }, [allAppointments.length]);

  const patientsWithHistory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of allAppointments) {
      const key = getPatientHistoryKey(a.patient);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const result = new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([id]) => id));
    historicalPatientKeys.forEach((key) => result.add(key));
    return result;
  }, [allAppointments, historicalPatientKeys]);

  // ROLLBACK REF: versión previa hacía 5 fetch sin manejo de error; loading podía quedar colgado si fallaba la red.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        fetchPatients(),
        fetchAppointments(),
        fetchDoctors(),
        fetchAllSchedules(),
        fetchBlockedDates(),
      ]);
      if (cancelled) return;
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('Fallos al cargar datos iniciales:', failed);
        toast.error('Algunos datos no se pudieron cargar. Revisá tu conexión.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime is now handled globally by useRealtimeSync hook in App.tsx

  const dayOfWeek = getDay(selectedDate);
  const doctorSlots = selectedDoctorId !== 'all'
    ? generateAvailableSlots(selectedDoctorId, dayOfWeek)
    : null;

  const currentDateBlocked = isDateBlocked(dateStr);
  const currentBlockedDate = blockedDates.find(b => b.date === dateStr);

  const handleBlockDate = async () => {
    try {
      await addBlockedDate(dateStr, blockReason || 'Sin motivo especificado');
      toast.success(`Día ${format(selectedDate, "d 'de' MMMM", { locale: es })} bloqueado`);
      setBlockDialogOpen(false);
      setBlockReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Error al bloquear fecha');
    }
  };

  const handleUnblockDate = async () => {
    const blocked = blockedDates.find(b => b.date === dateStr);
    if (!blocked) return;
    try {
      await removeBlockedDate(blocked.id);
      toast.success(`Día ${format(selectedDate, "d 'de' MMMM", { locale: es })} desbloqueado`);
    } catch {
      toast.error('Error al desbloquear fecha');
    }
  };

  // Highlight blocked dates in calendar
  const blockedDateObjects = blockedDates.map(b => new Date(b.date + 'T12:00:00'));

  // Test de conexión de solo lectura: no escribe ni modifica datos en la base.
  const handleConnectionTest = async () => {
    setTestingConnection(true);
    try {
      const { error } = await supabase
        .from('patients')
        .select('id')
        .limit(1);

      if (error) throw new Error(error.message);

      toast.success('Conexión OK');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falló el test de conexión';
      console.error('Connection test failed:', error);
      toast.error(message);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <AppLayout title="Agenda">
      <div className="p-4 space-y-4">
        {/* Top bar: date nav + doctor filter */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  <span className="capitalize">
                    {format(selectedDate, "EEE d MMM yyyy", { locale: es })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                  modifiers={{ blocked: blockedDateObjects }}
                  modifiersClassNames={{ blocked: 'bg-destructive/20 text-destructive line-through' }}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(d => addDays(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Todos los médicos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los médicos</SelectItem>
                {doctors.map(doc => (
                  <SelectItem key={doc.userId} value={doc.userId}>
                    {doc.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isViewer && (
              currentDateBlocked ? (
                <Button variant="outline" size="sm" onClick={handleUnblockDate} className="text-destructive border-destructive/50 hover:bg-destructive/10">
                  <ShieldOff className="w-4 h-4 mr-1" />
                  Desbloquear día
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setBlockDialogOpen(true)}>
                  <Ban className="w-4 h-4 mr-1" />
                  Bloquear día
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(today)}>
              Hoy
            </Button>
          </div>
        </div>

        {currentDateBlocked && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
            <Ban className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Día bloqueado — No se atiende</p>
              <p className="text-sm text-destructive/80">
                Motivo: {currentBlockedDate?.reason || 'Sin motivo'}
              </p>
            </div>
          </div>
        )}

        {doctors.length > 1 && selectedDoctorId === 'all' && !currentDateBlocked && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
            <Ban className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Estás viendo todos los médicos.</span> Los horarios mostrados son genéricos y pueden no coincidir con la disponibilidad real de cada médico. Para asignar nuevos turnos, primero filtrá por médico arriba.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <p className="text-base font-medium">Cargando citas...</p>
          </div>
        ) : (
          <DailyView
            appointments={dayAppointments}
            selectedDate={selectedDate}
            doctorSlots={doctorSlots}
            patientsWithHistory={patientsWithHistory}
            selectedDoctorId={selectedDoctorId}
          />
        )}
      </div>

      {/* Block date dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear día</DialogTitle>
            <DialogDescription>
              Bloqueá el {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })} para que no se agenden turnos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ej: Feriado, vacaciones, congreso..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBlockDate}>
              <Ban className="w-4 h-4 mr-1" />
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test de conexión: discreto, esquina inferior derecha */}
      <button
        type="button"
        onClick={handleConnectionTest}
        disabled={testingConnection}
        title={testingConnection ? 'Probando conexión...' : 'Test de conexión'}
        aria-label="Test de conexión"
        className="fixed bottom-20 right-3 z-40 h-7 w-7 rounded-full bg-background/70 hover:bg-background border border-border text-muted-foreground hover:text-foreground shadow-sm flex items-center justify-center transition-opacity opacity-50 hover:opacity-100 disabled:opacity-30"
      >
        <Wifi className={cn("w-3.5 h-3.5", testingConnection && "animate-pulse")} />
      </button>
    </AppLayout>
  );
};

export default Index;
