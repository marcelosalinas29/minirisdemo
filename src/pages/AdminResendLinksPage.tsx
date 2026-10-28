import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageCircle, Check, Search } from 'lucide-react';

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

const PAGE_SIZE = 1000;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;
const SIGN_BATCH = 100;

const AdminResendLinksPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cutoff, setCutoff] = useState('2026-09-16');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      // 1) Traer TODOS los turnos paginando en bloques de 1000 (la API corta en 1000 por defecto)
      const all: any[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, patient_id, study_type, date, created_at, patients(name, phone, dni)')
          .eq('status', 'sent')
          .lt('created_at', cutoff)
          .order('created_at')
          .order('id')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // 2) Firmar los PDFs en lotes de 100 paths con createSignedUrls
      const paths = all.map((a) => `informe_${a.id}.pdf`);
      const urlMap = new Map<string, string | null>();
      for (let i = 0; i < paths.length; i += SIGN_BATCH) {
        const chunk = paths.slice(i, i + SIGN_BATCH);
        try {
          const { data: signed, error: sErr } = await supabase.storage
            .from('reports')
            .createSignedUrls(chunk, SIGNED_URL_TTL);
          if (sErr) {
            chunk.forEach((p) => urlMap.set(p, null));
          } else {
            chunk.forEach((p, idx) => {
              const item = signed?.[idx];
              urlMap.set(p, item && !item.error && item.signedUrl ? item.signedUrl : null);
            });
          }
        } catch {
          chunk.forEach((p) => urlMap.set(p, null));
        }
      }

      const result: Row[] = all.map((a) => {
        const link = urlMap.get(`informe_${a.id}.pdf`) ?? null;
        return {
          id: a.id,
          patient_id: a.patient_id,
          patient_name: a.patients?.name ?? '—',
          phone: a.patients?.phone ?? '',
          study_type: a.study_type,
          date: a.date,
          link,
          error: !link,
        };
      });
      const persistedSent: Record<string, boolean> = {};
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('resend_log')
          .select('appointment_id')
          .order('appointment_id')
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        (data || []).forEach((entry) => { persistedSent[entry.appointment_id] = true; });
        if (!data || data.length < PAGE_SIZE) break;
      }
      setSent(persistedSent);
      setRows(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) { navigate('/'); return; }
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      if (!map.has(r.patient_id)) map.set(r.patient_id, []);
      map.get(r.patient_id)!.push(r);
    });
    return Array.from(map.values());
  }, [rows]);

  const isPhoneValid = (raw: string) => {
    if (!raw || !raw.trim()) return false;
    return normalizePhone(raw).length >= 12;
  };

  const pdfExceptions = useMemo(() => rows.filter((r) => r.error).length, [rows]);
  const sentCount = useMemo(() => rows.filter((r) => sent[r.id]).length, [rows, sent]);
  const phoneExceptions = useMemo(
    () => groups.filter((g) => !isPhoneValid(g[0].phone)).length,
    [groups]
  );

  const openWhatsApp = (group: Row[]) => {
    const withLinks = group.filter((r) => r.link);
    if (withLinks.length === 0) { toast.error('Este paciente no tiene links válidos.'); return; }
    if (!isPhoneValid(group[0].phone)) { toast.error('Este paciente no tiene un teléfono válido.'); return; }
    const lines = withLinks.map(
      (r) => `Estudio: ${r.study_type} - Fecha: ${formatDate(r.date)}\n${r.link}`
    );
    const text = encodeURIComponent(`${MSG}\n\n${lines.join('\n\n')}`);
    window.open(`https://wa.me/${normalizePhone(group[0].phone)}?text=${text}`, '_blank');
  };

  const toggleSent = async (appointmentId: string) => {
    if (loading || saving[appointmentId]) return;
    const wasSent = Boolean(sent[appointmentId]);
    setSaving((current) => ({ ...current, [appointmentId]: true }));
    try {
      const { error } = wasSent
        ? await supabase.from('resend_log').delete().eq('appointment_id', appointmentId)
        : await supabase.from('resend_log').insert({ appointment_id: appointmentId });
      if (error) throw error;
      setSent((current) => ({ ...current, [appointmentId]: !wasSent }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la marca de enviado.');
    } finally {
      setSaving((current) => ({ ...current, [appointmentId]: false }));
    }
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
          <Button onClick={load} disabled={loading || Object.values(saving).some(Boolean)}>
            <Search className="w-4 h-4 mr-1" />Buscar
          </Button>
          <p className="text-sm font-medium">
            {loading
              ? 'Cargando...'
              : `${rows.length} turnos, ${groups.length} pacientes encontrados — Enviados: ${sentCount} de ${rows.length} — Excepciones: ${pdfExceptions} PDF no encontrado, ${phoneExceptions} teléfono inválido`}
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
              {groups.map((group) => {
                const phoneOk = isPhoneValid(group[0].phone);
                return group.map((r, i) => (
                  <tr key={r.id} className={`border-t ${sent[r.id] ? 'bg-muted/40' : ''}`}>
                    <td className="p-2 font-medium">{i === 0 ? r.patient_name : ''}</td>
                    <td className="p-2">
                      {i === 0 && (
                        phoneOk
                          ? r.phone
                          : <span className="text-destructive">Excepción: teléfono inválido</span>
                      )}
                    </td>
                    <td className="p-2">{r.study_type}</td>
                    <td className="p-2">{formatDate(r.date)}</td>
                    <td className="p-2">
                      {r.error
                        ? <span className="text-destructive">Excepción: PDF no encontrado</span>
                        : <span className="text-primary">Link generado</span>}
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant={sent[r.id] ? 'default' : 'outline'} disabled={loading || saving[r.id]} onClick={() => toggleSent(r.id)}>
                        <Check className="w-3.5 h-3.5 mr-1" />{sent[r.id] ? 'Enviado' : 'Marcar como enviado'}
                      </Button>
                    </td>
                    <td className="p-2">
                      {i === 0 && (
                        <Button size="sm" onClick={() => openWhatsApp(group)} disabled={!phoneOk || !group.some((g) => g.link)}>
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />Abrir WhatsApp
                        </Button>
                      )}
                    </td>
                  </tr>
                ));
              })}
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
