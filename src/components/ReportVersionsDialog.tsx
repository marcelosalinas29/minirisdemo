import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Version { id: string; report: string; saved_by: string | null; created_at: string }

interface Props {
  appointmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
  onRestore: (html: string) => void;
}

/** Versiones anteriores del informe (las guarda la base automáticamente al cambiar el texto). */
const ReportVersionsDialog = ({ appointmentId, open, onOpenChange, canRestore, onRestore }: Props) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Version | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSelected(null);
      const { data } = await supabase
        .from('report_versions')
        .select('id, report, saved_by, created_at')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
        .limit(100);
      const rows = (data || []) as Version[];
      const ids = Array.from(new Set(rows.map((r) => r.saved_by).filter(Boolean))) as string[];
      const map: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      }
      if (cancelled) return;
      setVersions(rows);
      setNames(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, appointmentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Versiones anteriores del informe</DialogTitle>
          <DialogDescription>Cada vez que el texto cambia, se guarda la versión previa.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : selected ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: es })}
              {selected.saved_by && names[selected.saved_by] ? ` · ${names[selected.saved_by]}` : ''}
            </p>
            <div className="bg-muted/50 rounded-lg p-3 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selected.report }} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Volver a la lista</Button>
              {canRestore && (
                <Button className="flex-1" onClick={() => { onRestore(selected.report); onOpenChange(false); }}>
                  Restaurar esta versión
                </Button>
              )}
            </div>
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Este informe todavía no tiene versiones anteriores.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <button key={v.id} onClick={() => setSelected(v)} className="w-full text-left bg-card border border-border rounded-lg px-3 py-2 text-sm hover:bg-secondary">
                <span className="font-medium">{format(new Date(v.created_at), "d MMM yyyy HH:mm", { locale: es })}</span>
                {v.saved_by && names[v.saved_by] && <span className="text-muted-foreground"> · {names[v.saved_by]}</span>}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReportVersionsDialog;
