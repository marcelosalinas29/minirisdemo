import { useState } from 'react';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rangeFor, type Preset } from '@/lib/export/exportHelpers';
import { runExport, type ExportResult } from '@/lib/export/exportRange';
import type { BackupProgress } from '@/lib/backup/runBackup';

const PRESETS: [Preset, string][] = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes_pasado', 'Mes pasado']];

const ExportPage = () => {
  const { isAdmin } = useAuth();
  const init = rangeFor('mes');
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const valid = !!from && !!to && from <= to;

  const start = async () => {
    setError(''); setResult(null);
    try {
      const root: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setRunning(true);
      setResult(await runExport(root, from, to, setProgress));
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'No se pudo exportar');
    } finally { setRunning(false); }
  };

  if (!isAdmin) return <AppLayout title="Exportar"><p className="p-4 text-sm">Solo el administrador puede exportar.</p></AppLayout>;

  return (
    <AppLayout title="Exportar a Excel">
      <div className="p-4 space-y-4 max-w-xl">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-sm">
          <p>Elegí el período. Baja un <b>Excel con un turno por fila</b> (paciente, obra social, estudio, médico, estado…) y una hoja de <b>resumen</b>, más una carpeta con los <b>PDF de los informes</b>. Cada fila tiene un enlace que abre su PDF.</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([k, label]) => (
              <Button key={k} type="button" variant="outline" size="sm" onClick={() => { const r = rangeFor(k); setFrom(r.from); setTo(r.to); }}>{label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Desde</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Hasta</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          {!valid && <p className="text-xs text-destructive">La fecha "Desde" tiene que ser anterior o igual a "Hasta".</p>}
          <p className="text-muted-foreground">Guardá el Excel y la carpeta <b>juntos</b>: si los separás, los enlaces a los PDF dejan de abrir.</p>
          {!supported && <p className="text-destructive">Este navegador no permite guardar en carpetas. Usá Chrome o Edge en una computadora.</p>}
          <Button onClick={start} disabled={!supported || running || !valid} className="w-full">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Elegir carpeta y exportar
          </Button>
          {running && <p className="text-xs text-muted-foreground">No cierres esta pestaña hasta que termine.</p>}
        </div>
        {progress && running && <div className="text-sm"><p>{progress.phase}</p><p className="text-muted-foreground">{progress.done} de {progress.total}</p></div>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold">Exportación terminada</p>
            <p>Turnos en el Excel: {result.turnos} · PDF copiados: {result.pdfsCopiados} · turnos sin PDF: {result.sinPdf}</p>
            <p className="text-muted-foreground">Archivo: {result.excel}</p>
            {result.errores.length > 0
              ? <p className="text-destructive">{result.errores.length} PDF con error: {result.errores.slice(0, 3).join(' · ')}. Repetí la exportación.</p>
              : <p className="text-green-700">Sin errores.</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ExportPage;
