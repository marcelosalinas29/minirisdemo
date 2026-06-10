import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, StudyStatus } from '@/types/medical';
import { calcularEdad, STATUS_LABELS, formatStudyType, normalizeDni } from '@/types/medical';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Calendar, Loader2 } from 'lucide-react';

interface PatientHistoryModalProps {
  patientId: string;
  patientDni?: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusClass: Record<string, string> = {
  'pending': 'status-badge-pending',
  'in-study': 'status-badge-in-study',
  'reported': 'status-badge-reported',
  'sent': 'status-badge-sent',
};

const PatientHistoryModal = ({ patientId, patientDni, patientName, open, onOpenChange }: PatientHistoryModalProps) => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const normalizedDni = normalizeDni(patientDni);
      let patientIds = [patientId];

      if (normalizedDni) {
        const { data: patients } = await supabase
          .from('patients')
          .select('id, dni');
        patientIds = Array.from(new Set([
          patientId,
          ...((patients || []) as { id: string; dni: string | null }[])
            .filter((p) => normalizeDni(p.dni) === normalizedDni)
            .map((p) => p.id),
        ]));
      }

      const { data } = await supabase
        .from('appointments')
        .select('id, patient_id, study_type, status, date, time, observations, reported_by, asistio, created_at, patients(*)')
        .in('patient_id', patientIds)
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      if (cancelled) return;
      setAppointments(
        (data || []).map((a: any) => ({
          id: a.id,
          patientId: a.patient_id,
          patient: {
            id: a.patients.id,
            dni: a.patients.dni || '',
            name: a.patients.name,
            age: a.patients.fecha_nacimiento ? calcularEdad(a.patients.fecha_nacimiento) : a.patients.age,
            phone: a.patients.phone,
            fechaNacimiento: a.patients.fecha_nacimiento || undefined,
            obraSocial: a.patients.obra_social || '',
          },
          studyType: a.study_type,
          status: a.status as StudyStatus,
          date: a.date,
          time: a.time,
          report: '',
          images: [],
          imageUrls: [],
          observations: a.observations || '',
          reportedBy: a.reported_by || null,
          asistio: a.asistio ?? false,
          createdAt: a.created_at,
        }))
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, patientId, patientDni]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" />
            Historial de {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin estudios previos
          </p>
        ) : (
          <div className="space-y-2">
            {appointments.map(apt => (
              <button
                key={apt.id}
                onClick={() => { onOpenChange(false); navigate(`/appointment/${apt.id}`); }}
                className="w-full text-left bg-muted/30 hover:bg-muted/60 rounded-lg p-3 transition-colors border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase">{formatStudyType(apt.studyType)}</span>
                  <Badge variant="outline" className={`text-[10px] ${statusClass[apt.status] || ''}`}>
                    {STATUS_LABELS[apt.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {(() => { const [y, m, d] = apt.date.split('-').map(Number); return format(new Date(y, m - 1, d), "d 'de' MMMM yyyy", { locale: es }); })()}
                  <span>— {apt.time}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PatientHistoryModal;
