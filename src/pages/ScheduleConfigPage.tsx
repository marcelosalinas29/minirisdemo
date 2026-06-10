import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useScheduleStore, ScheduleBlock } from '@/store/useScheduleStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Clock, Timer } from 'lucide-react';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const INTERVAL_OPTIONS = [5, 10, 15, 20, 30];

const ScheduleConfigPage = () => {
  const navigate = useNavigate();
  const { user, isDoctor, isSecretary, refreshProfile } = useAuth();
  const { schedules, doctors, fetchSchedules, fetchAllSchedules, fetchDoctors, addBlock, updateBlock, deleteBlock } = useScheduleStore();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [newDay, setNewDay] = useState('1');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('12:00');
  const [currentInterval, setCurrentInterval] = useState<number>(10);
  const [savingInterval, setSavingInterval] = useState(false);

  useEffect(() => {
    if (isSecretary) {
      fetchDoctors();
      fetchAllSchedules();
    } else if (user && isDoctor) {
      setSelectedDoctorId(user.id);
      fetchSchedules(user.id);
    }
  }, [user, isDoctor, isSecretary]);

  // When secretary selects a doctor, filter schedules and load interval
  const handleDoctorChange = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    fetchSchedules(doctorId);
    const doc = doctors.find(d => d.userId === doctorId);
    setCurrentInterval(doc?.slotInterval ?? 10);
  };

  // Auto-select first doctor for secretary
  useEffect(() => {
    if (isSecretary && doctors.length > 0 && !selectedDoctorId) {
      setSelectedDoctorId(doctors[0].userId);
      fetchSchedules(doctors[0].userId);
      setCurrentInterval(doctors[0].slotInterval ?? 10);
    }
  }, [doctors, isSecretary, selectedDoctorId]);

  // Load interval for doctor role
  useEffect(() => {
    if (isDoctor && user) {
      const doc = doctors.find(d => d.userId === user.id);
      if (doc) setCurrentInterval(doc.slotInterval ?? 10);
    }
  }, [doctors, isDoctor, user]);

  const handleIntervalChange = async (value: string) => {
    const interval = parseInt(value);
    setCurrentInterval(interval);
    setSavingInterval(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ slot_interval: interval } as any)
        .eq('user_id', selectedDoctorId);
      if (error) throw error;
      await fetchDoctors();
      if (isDoctor) await refreshProfile();
      toast.success(`Intervalo actualizado a ${interval} minutos`);
    } catch {
      toast.error('Error al guardar el intervalo');
    } finally {
      setSavingInterval(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedDoctorId) {
      toast.error('Seleccioná un médico primero');
      return;
    }
    try {
      await addBlock({
        doctorId: selectedDoctorId,
        dayOfWeek: parseInt(newDay),
        startTime: newStart,
        endTime: newEnd,
        active: true,
      });
      toast.success('Bloque horario agregado');
    } catch {
      toast.error('Error al agregar bloque');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBlock(id);
    toast.success('Bloque eliminado');
  };

  const handleToggle = async (id: string, active: boolean) => {
    await updateBlock(id, { active });
    toast.success(active ? 'Bloque activado' : 'Bloque desactivado');
  };

  const filteredSchedules = schedules.filter(b => b.doctorId === selectedDoctorId);

  const byDay = DAYS.map((dayName, dayIdx) => ({
    dayName,
    dayIdx,
    blocks: filteredSchedules.filter(b => b.dayOfWeek === dayIdx),
  })).filter(d => d.blocks.length > 0);

  const selectedDoctorName = doctors.find(d => d.userId === selectedDoctorId)?.fullName;

  return (
    <AppLayout title="Configurar Horarios">
      <div className="p-4 max-w-lg mx-auto space-y-5">
        {/* Doctor selector for secretaries */}
        {isSecretary && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Médico</Label>
            <Select value={selectedDoctorId} onValueChange={handleDoctorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar médico" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map(doc => (
                  <SelectItem key={doc.userId} value={doc.userId}>
                    {doc.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Interval selector */}
        {selectedDoctorId && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4 text-primary" />
              Intervalo Base de Turnos
              {isSecretary && selectedDoctorName && (
                <span className="text-muted-foreground font-normal">— {selectedDoctorName}</span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Define cada cuántos minutos se genera un slot en la grilla. Los estudios especiales (Doppler, TN, etc.) ajustan automáticamente a 20 min.
            </p>
            <Select value={String(currentInterval)} onValueChange={handleIntervalChange} disabled={savingInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt} minutos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Add new block */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary" />
            Agregar Bloque Horario
            {isSecretary && selectedDoctorName && (
              <span className="text-muted-foreground font-normal">— {selectedDoctorName}</span>
            )}
          </h2>
          <div className="space-y-2">
            <Label className="text-xs">Día</Label>
            <Select value={newDay} onValueChange={setNewDay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} step="600" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} step="600" />
            </div>
          </div>
          <Button onClick={handleAdd} className="w-full" size="sm" disabled={!selectedDoctorId}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>

        {/* Existing blocks */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Bloques Configurados</h2>
          {byDay.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay bloques configurados. Agregá horarios de atención.
            </p>
          )}
          {byDay.map(({ dayName, blocks }) => (
            <div key={dayName} className="bg-card border border-border rounded-xl p-3 shadow-sm">
              <h3 className="text-sm font-semibold mb-2">{dayName}</h3>
              <div className="space-y-2">
                {blocks.map(block => (
                  <div key={block.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={`font-mono ${!block.active ? 'line-through text-muted-foreground' : ''}`}>
                      {block.startTime} - {block.endTime}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={block.active}
                        onCheckedChange={(v) => handleToggle(block.id, v)}
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(block.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>
    </AppLayout>
  );
};

export default ScheduleConfigPage;
