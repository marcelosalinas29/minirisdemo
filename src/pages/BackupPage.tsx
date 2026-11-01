import { useState } from 'react';
import { Loader2, HardDriveDownload } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { runBackup, type BackupProgress, type BackupResult } from '@/lib/backup/runBackup';

const BackupPage = () => {
  const { isAdmin } = useAuth();
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const start = async () => {
    setError(''); setResult(null);
    try {
      const root: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setRunning(true);
      setResult(await runBackup(root, setProgress));
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'No se pudo hacer el respaldo');
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin) return <AppLayout title="Respaldo"><p className="p-4 text-sm">Solo el administrador puede hacer el respaldo.</p></AppLayout>;

  return (
    <AppLayout title="Respaldo">
      <div className="p-4 space-y-4 max-w-xl">
        <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-sm">
          <p>Copia <b>todos los datos, informes en PDF e imágenes</b> a una carpeta de esta computadora (por ejemplo un disco externo).</p>
          <p className="text-muted-foreground">Es solo una copia de seguridad: no saca ni borra nada del sistema. Si repetís el respaldo en la misma carpeta, solo copia lo nuevo. Guardá la carpeta en <b>dos lugares distintos</b> (disco externo y Drive).</p>
          {!supported && <p className="text-destructive">Este navegador no permite guardar en carpetas. Usá Chrome o Edge en una computadora.</p>}
          <Button onClick={start} disabled={!supported || running} className="w-full">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HardDriveDownload className="w-4 h-4 mr-2" />}
            Elegir carpeta y empezar
          </Button>
          {running && <p className="text-xs text-muted-foreground">No cierres esta pestaña hasta que termine. Puede tardar varios minutos.</p>}
        </div>

        {progress && running && (
          <div className="text-sm"><p>{progress.phase}</p><p className="text-muted-foreground">{progress.done} de {progress.total}</p></div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold">Respaldo terminado</p>
            <p>Archivos nuevos copiados: {result.copied} · ya estaban: {result.skipped}</p>
            <p className="text-muted-foreground">{Object.entries(result.tables).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
            {result.errors.length > 0
              ? <p className="text-destructive">Hubo {result.errors.length} archivo(s) con error (ver errores_… en la carpeta). Repetí el respaldo para reintentar.</p>
              : <p className="text-green-700">Sin errores.</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BackupPage;
