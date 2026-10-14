import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageCircle, Check } from 'lucide-react';

interface Row {
  id: string;
  patient_id: string;
  patient_name: string;
  phone: string;
  study_type: string;
  date: string;
  link: string | null;
  error: boolean;
}

const normalizePhone = (raw: string) => {
  let phone = (raw || '').replace(/[\s\-\(\)\.\+]/g, '');
  if (phone.startsWith('549')) {
    // ok
  } else if (phone.startsWith('54')) {
    phone = '549' + phone.substring(2);
  } else {
    if (phone.startsWith('0')) phone = phone.substring(1);
    phone = phone.replace(/^(\d{2,4})15(\d{6,})$/, '$1$2');
    phone = '549' + phone;
  }
  return phone.replace(/\D/g, '');
};

const formatDate = (d: string) => {
  const [y, m, day] = (d || '').split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
};

const MSG = 'Hola. Desde Diagnóstico Médico Reconquista te reenviamos el enlace de tu informe para facilitar el acceso al estudio. Por una actualización técnica de nuestro sistema, te recomendamos utilizar este enlace nuevo para consultar tu informe. Disculpá las molestias.';

const AdminResendLinksPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cutoff, setCutoff] = useState('2026-09-16');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, patient_id, study_type, date, created_at, patients(name, phone, dni)')
        .eq('status', 'sent')
        .lt('created_at', cutoff)
        .order('date', { ascending: false });
      if (error) throw error;
      const result = await Promise.all((data || []).map(async (a: any) => {
        let link: string | null = null;
        try {
          const { data: s, error: e } = await supabase.storage
            .from('reports')
            .createSignedUrl(`informe_${a.id}.pdf`, 60 * 60 * 24 * 365 * 10);
          if (!e && s?.signedUrl) link = s.signedUrl;
        } catch { /* excepción */ }
        return {
          id: a.id,
          patient_id: a.patient_id,
          patient_name: a.patients?.name ?? '—',
          phone: a.patients?.phone ?? '',
          study_type: a.study_type,
          date: a.date,
          link,
          error: !link,
        } as Row;
      }));
      setRows(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) { navigate('/'); return; }
    if (isAdmin && cutoff) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin, cutoff]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      if (!map.has(r.patient_id)) map.set(r.patient_id, []);
      map.get(r.patient_id)!.push(r);
    });
    return Array.from(map.values());
  }, [rows]);

  const openWhatsApp = (group: Row[]) => {
    const links = group.filter((r) => r.link).map((r) => r.link);
    if (links.length === 0) { toast.error('Este paciente no tiene links válidos.'); return; }
    const text = encodeURIComponent(`${MSG}\n\n${links.join('\n\n')}`);
    window.open(`https://wa.me/${normalizePhone(group[0].phone)}?text=${text}`, '_blank');
  };

  if (authLoading || !isAdmin) return null;

  return (
    <AppLayout title="Reenviar links de informes" showBack>
      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label htmlFor="cutoff">Turnos creados antes de</Label>
            <Input id="cutoff" type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} className="w-48" />
          </div>
          <p className="text-sm font-medium">
            {loading ? 'Cargando...' : `${rows.length} turnos, ${groups.length} pacientes encontrados`}
          </p>
        </div>

        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Paciente</th>
                <th className="p-2">Teléfono</th>
                <th className="p-2">Estudio</th>
                <th className="p-2">Fecha</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Enviado</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                group.map((r, i) => (
                  <tr key={r.id} className={`border-t ${sent[r.id] ? 'bg-muted/40' : ''}`}>
                    <td className="p-2 font-medium">{i === 0 ? r.patient_name : ''}</td>
                    <td className="p-2">{i === 0 ? r.phone : ''}</td>
                    <td className="p-2">{r.study_type}</td>
                    <td className="p-2">{formatDate(r.date)}</td>
                    <td className="p-2">
                      {r.error
                        ? <span className="text-destructive">Excepción: PDF no encontrado</span>
                        : <span className="text-primary">Link generado</span>}
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant={sent[r.id] ? 'default' : 'outline'} onClick={() => setSent((s) => ({ ...s, [r.id]: !s[r.id] }))}>
                        <Check className="w-3.5 h-3.5 mr-1" />{sent[r.id] ? 'Enviado' : 'Marcar como enviado'}
                      </Button>
                    </td>
                    <td className="p-2">
                      {i === 0 && (
                        <Button size="sm" onClick={() => openWhatsApp(group)} disabled={!group.some((g) => g.link)}>
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />Abrir WhatsApp
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No hay turnos para esa fecha.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminResendLinksPage;
