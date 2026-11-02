import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';

interface Row { id: string; created_at: string; user_id: string | null; action: string; entity: string; entity_id: string | null; patient_id: string | null; details: any }

const ACTION: Record<string, string> = { insert: 'Creó', update: 'Modificó', delete: 'Eliminó', view: 'Vio' };
const ENTITY: Record<string, string> = { appointments: 'un turno', patients: 'un paciente', estudios_previos: 'un estudio previo' };
const FIELD: Record<string, string> = { status: 'estado', date: 'fecha', time: 'hora', doctor_id: 'médico', study_type: 'estudio', observations: 'observaciones', report: 'informe', reported_by: 'firmante', asistio: 'asistencia', arrival_state: 'llegada' };

const AuditPage = () => {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [patients, setPatients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300);
      const list = (data || []) as Row[];
      setRows(list);
      const uids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
      if (uids.length) {
        const { data: ps } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uids);
        setNames(Object.fromEntries((ps || []).map((p: any) => [p.user_id, p.full_name])));
      }
      const pids = Array.from(new Set(list.map((r) => r.patient_id).filter(Boolean))) as string[];
      if (pids.length) {
        const { data: pts } = await supabase.from('patients').select('id, name').in('id', pids.slice(0, 200));
        setPatients(Object.fromEntries((pts || []).map((p: any) => [p.id, p.name])));
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  const view = useMemo(() => rows.map((r) => {
    const who = r.user_id ? names[r.user_id] || 'Usuario' : 'Sistema';
    const patient = r.patient_id ? patients[r.patient_id] || '' : '';
    const d = r.details || {};
    const fields = Array.isArray(d.campos) ? d.campos.map((c: string) => FIELD[c] || c).join(', ') : '';
    const change = d.antes && d.despues ? Object.keys(d.antes).map((k) => `${FIELD[k] || k}: ${d.antes[k]} → ${d.despues[k]}`).join('; ') : '';
    return { r, who, patient, text: `${ACTION[r.action] || r.action} ${ENTITY[r.entity] || r.entity}`, detail: change || (fields ? `Campos: ${fields}` : '') };
  }), [rows, names, patients]);

  const shown = view.filter((v) => !text || `${v.who} ${v.patient} ${v.text} ${v.detail}`.toLowerCase().includes(text.toLowerCase()));

  if (!isAdmin) return <AppLayout title="Auditoría"><p className="p-4 text-sm">Solo el administrador puede ver este registro.</p></AppLayout>;

  return (
    <AppLayout title="Registro de actividad">
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">Últimos 300 movimientos. Los cambios de texto del informe se ven en "Versiones" de cada estudio.</p>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filtrar por usuario, paciente o acción" />
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : shown.map(({ r, who, patient, text: t, detail }) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-2 text-xs space-y-0.5">
            <div className="flex justify-between gap-2"><span className="font-semibold">{who}</span><span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('es-AR')}</span></div>
            <div>{t}{patient ? ` de ${patient}` : ''}</div>
            {detail && <div className="text-muted-foreground">{detail}</div>}
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default AuditPage;
