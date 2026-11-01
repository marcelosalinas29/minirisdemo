import { useEffect, useRef, useState } from 'react';
import { Loader2, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { STUDY_TYPES, formatStudyType } from '@/types/medical';
import { safeName } from '@/lib/backup/backupHelpers';

interface Result { appointment_id: string; patient_id: string; patient_name: string; dni: string | null; study_date: string; study_type: string; status: string }
const PAGE = 30;
const fmt = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

/** Pantalla del médico consultor: solo busca estudios ya informados y ve/descarga el PDF. */
const ConsultorPage = () => {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [study, setStudy] = useState('');
  const [rows, setRows] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<{ r: Result; url: string } | null>(null);
  const [opening, setOpening] = useState('');
  const seq = useRef(0);

  const search = async (offset: number) => {
    const my = ++seq.current;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('consultor_search', { p_query: q, p_study: study, p_limit: PAGE, p_offset: offset });
    if (my !== seq.current) return;
    setLoading(false);
    if (error) { toast.error('No se pudo buscar'); return; }
    const list = (data || []) as Result[];
    setRows((prev) => (offset === 0 ? list : [...prev, ...list]));
    setMore(list.length === PAGE);
  };

  useEffect(() => {
    if (q.trim().length < 2 && !study) { setRows([]); setMore(false); return; }
    const t = setTimeout(() => search(0), 350);
    return () => clearTimeout(t);
  }, [q, study]);

  const openPdf = async (r: Result) => {
    setOpening(r.appointment_id);
    const { data, error } = await supabase.storage.from('reports').createSignedUrl(`informe_${r.appointment_id}.pdf`, 600);
    setOpening('');
    if (error || !data) { toast.error('Este estudio todavía no tiene el PDF generado.'); return; }
    setOpen({ r, url: data.signedUrl });
    if (user) (supabase as any).from('audit_log').insert({ user_id: user.id, action: 'view', entity: 'appointments', entity_id: r.appointment_id, patient_id: r.patient_id, details: { origen: 'consultor' } }).then(() => {});
  };

  const download = async () => {
    if (!open) return;
    try {
      const blob = await (await fetch(open.url)).blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${safeName(open.r.patient_name)}_${open.r.study_date}_${safeName(open.r.study_type, 40)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error('No se pudo descargar'); }
  };

  return (
    <AppLayout title="Buscar estudios">
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="DNI, apellido y nombre" autoFocus />
        <select value={study} onChange={(e) => setStudy(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos los estudios</option>
          {STUDY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && rows.length === 0 && (q.trim().length >= 2 || study) && <p className="text-sm text-muted-foreground">No se encontraron estudios informados.</p>}
        {rows.map((r) => (
          <button key={r.appointment_id} onClick={() => openPdf(r)} className="w-full text-left bg-card border border-border rounded-lg p-3 text-sm hover:bg-muted/40 flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0 text-primary" />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{r.patient_name}</span>
              <span className="block text-xs text-muted-foreground truncate">{fmt(r.study_date)} · {formatStudyType(r.study_type)}{r.dni ? ` · DNI ${r.dni}` : ''}</span>
            </span>
            {opening === r.appointment_id && <Loader2 className="w-4 h-4 animate-spin" />}
          </button>
        ))}
        {more && <Button variant="outline" className="w-full" onClick={() => search(rows.length)}>Ver más</Button>}

        {open && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col p-2">
            <div className="bg-card rounded-t-lg p-2 flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold truncate">{open.r.patient_name} · {fmt(open.r.study_date)}</span>
              <Button size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />Descargar</Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(null)}>Cerrar</Button>
            </div>
            <iframe title="Informe" src={open.url} className="flex-1 bg-white rounded-b-lg" />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ConsultorPage;
