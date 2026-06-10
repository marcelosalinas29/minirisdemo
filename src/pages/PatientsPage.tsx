import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppLayout from '@/components/AppLayout';
import { useClinicStore } from '@/store/useClinicStore';
import { STATUS_LABELS, calcularEdadDetallada } from '@/types/medical';
import { Input } from '@/components/ui/input';

const PatientsPage = () => {
  const [query, setQuery] = useState('');
  const { searchPatients, patients, getPatientAppointments, fetchPatients, fetchAppointments } = useClinicStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
  }, []);

  const results = query.length >= 1 ? searchPatients(query) : patients;

  return (
    <AppLayout title="Pacientes">
      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="pl-9"
          />
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>{query ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((patient) => {
              const appointments = getPatientAppointments(patient.id);
              const displayPhone = patient.phone?.replace(/^\+?549?\s?/, '') || '';
              const edad = patient.fechaNacimiento
                ? calcularEdadDetallada(patient.fechaNacimiento)
                : { value: patient.age, unit: 'años' as const };
              return (
                <div key={patient.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-foreground">{patient.name}</p>
                      <p className="text-sm font-light text-muted-foreground flex items-center gap-0 flex-wrap">
                        {patient.dni && (
                          <>
                            <span className="text-foreground/70">DNI: {patient.dni}</span>
                            <span className="mx-2 text-border">|</span>
                          </>
                        )}
                        <span><span className="font-bold text-foreground">{edad.value}</span> {edad.unit}</span>
                        <span className="mx-2 text-border">|</span>
                        <span className="text-primary">{displayPhone}</span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{appointments.length} estudio(s)</span>
                  </div>
                  {appointments.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {appointments.slice(0, 3).map((apt) => (
                        <button
                          key={apt.id}
                          onClick={() => navigate(`/appointment/${apt.id}`)}
                          className="w-full flex items-center justify-between bg-muted rounded-full px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>{(() => { const [y, m, d] = apt.date.split('-').map(Number); return format(new Date(y, m - 1, d), "d MMM yyyy", { locale: es }); })()}</span>
                            <span className="text-muted-foreground">{apt.studyType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{STATUS_LABELS[apt.status]}</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                      {appointments.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">+{appointments.length - 3} más</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PatientsPage;
