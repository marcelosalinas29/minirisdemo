import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, StudyStatus } from '@/types/medical';
import { STATUS_LABELS } from '@/types/medical';
import { Badge } from '@/components/ui/badge';

const statusClass: Record<StudyStatus, string> = {
  'pending': 'status-badge-pending',
  'in-study': 'status-badge-in-study',
  'reported': 'status-badge-reported',
  'sent': 'status-badge-sent',
};

// Generate 10-minute time slots
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  // Morning: 8:00 - 12:50
  for (let h = 8; h < 13; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  // Afternoon: 15:00 - 20:50
  for (let h = 15; h < 21; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

interface WeeklyGridProps {
  appointments: Appointment[];
  weekStart: Date;
}

const TIME_SLOTS = generateTimeSlots();

const WeeklyGrid = ({ appointments, weekStart }: WeeklyGridProps) => {
  const navigate = useNavigate();

  const weekDays = useMemo(() => {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  }, [weekStart]);

  // Map appointments by date+time
  const appointmentMap = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments) {
      const key = `${apt.date}_${apt.time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  }, [appointments]);

  // Check which slots have appointments (to show only relevant rows)
  const activeSlots = useMemo(() => {
    const active = new Set<string>();
    for (const apt of appointments) {
      for (const day of weekDays) {
        if (apt.date === format(day, 'yyyy-MM-dd')) {
          active.add(apt.time);
        }
      }
    }
    return active;
  }, [appointments, weekDays]);

  // Show all slots but visually distinguish empty ones
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[700px]">
        <thead>
          <tr>
            <th className="p-2 border border-border bg-muted/50 text-muted-foreground w-16 sticky left-0 z-10">
              Hora
            </th>
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              return (
                <th
                  key={day.toISOString()}
                  className={`p-2 border border-border text-center ${isToday ? 'bg-primary/10 text-primary font-bold' : 'bg-muted/50 text-muted-foreground'}`}
                >
                  <div className="font-semibold capitalize">
                    {format(day, 'EEE', { locale: es })}
                  </div>
                  <div className="text-[10px]">{format(day, 'd/MM')}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot) => {
            const hasAny = activeSlots.has(slot);
            // Show separator between morning and afternoon
            const isAfternoonStart = slot === '15:00';

            return (
              <>
                {isAfternoonStart && (
                  <tr key="separator">
                    <td colSpan={6} className="p-1 bg-muted/30 text-center text-[10px] text-muted-foreground font-semibold border border-border">
                      — TARDE —
                    </td>
                  </tr>
                )}
                {slot === '08:00' && (
                  <tr key="morning-separator">
                    <td colSpan={6} className="p-1 bg-muted/30 text-center text-[10px] text-muted-foreground font-semibold border border-border">
                      — MAÑANA —
                    </td>
                  </tr>
                )}
                <tr key={slot} className={hasAny ? '' : 'opacity-40'}>
                  <td className="p-1 border border-border bg-muted/20 text-center font-mono text-muted-foreground sticky left-0 z-10">
                    {slot}
                  </td>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const key = `${dateStr}_${slot}`;
                    const apts = appointmentMap.get(key) || [];
                    const isOccupied = apts.length > 0;

                    return (
                      <td
                        key={key}
                        className={`p-0.5 border border-border align-top min-h-[28px] ${isOccupied ? 'bg-card' : ''}`}
                      >
                        {apts.map((apt) => (
                          <button
                            key={apt.id}
                            onClick={() => navigate(`/appointment/${apt.id}`)}
                            className="w-full text-left p-1 rounded hover:bg-secondary/60 transition-colors block mb-0.5"
                            title={`${apt.patient.name} - ${apt.studyType}`}
                          >
                            <div className="font-semibold text-foreground truncate text-[11px]">
                              {apt.patient.name}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${statusClass[apt.status]}`}>
                                {STATUS_LABELS[apt.status]}
                              </Badge>
                            </div>
                          </button>
                        ))}
                        {isOccupied && apts.length > 1 && (
                          <div className="text-[9px] text-destructive font-semibold text-center">
                            ⚠ Superposición
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyGrid;
