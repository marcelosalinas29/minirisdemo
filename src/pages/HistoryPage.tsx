import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { useClinicStore } from '@/store/useClinicStore';
import { STATUS_LABELS, identityDni, type Appointment } from '@/types/medical';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Búsqueda en toda la historia: por período y/o por paciente. Pide a la base solo lo que se busca. */
const HistoryPage = () => {
  const navigate = useNavigate();
  const { searchPatients, patients, fetchAppointmentsRange } = useClinicStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!from && !to && !query.trim()) {
      toast.info('Elegí un período o escribí un paciente.');
      return;
    }
    setLoading(true);
    try {
      let patientIds: string[] | undefined;
      if (query.trim()) {
        const found = searchPatients(query);
        // Incluye las demás fichas con el mismo DNI, para ver todo el historial de la persona
        const dnis = new Set(found.map((p) => identityDni(p)).filter(Boolean));
        const ids = new Set(found.map((p) => p.id));
        patients.forEach((p) => { if (dnis.has(identityDni(p))) ids.add(p.id); });
        if (ids.size === 0) {
          setResults([]);
          return;
        }
        patientIds = Array.from(ids);
      }
      const rows = await fetchAppointmentsRange({ from: from || undefined, to: to || undefined, patientIds });
      setResults(rows);
    } catch (e: any) {
      console.error(e);
      toast.error(`No se pudo buscar: ${e?.message || 'error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return format(new Date(y, m - 1, day), 'd MMM yyyy', { locale: es }); };

  return (
    <AppLayout title="Historial">
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Paciente: DNI, apellido y nombre (opcional)" className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Desde<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Hasta<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <Button onClick={handleSearch} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Buscar en el historial
          </Button>
        </div>

        {results && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{results.length} estudio(s) encontrado(s)</p>
            {results.map((apt) => (
              <button
                key={apt.id}
                onClick={() => navigate(`/appointment/${apt.id}`)}
                className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2 text-sm text-left hover:bg-secondary transition-colors"
              >
                <div>
                  <p className="font-semibold">{apt.patient.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{fmtDate(apt.date)} {apt.time} · {apt.studyType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[apt.status]}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
