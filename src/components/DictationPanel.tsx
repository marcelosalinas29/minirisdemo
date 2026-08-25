import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { applyUnitUpdates, buildUnitsPayload, diffUnits, type UnitUpdate } from '@/lib/subsections';
import { htmlToPlainText, plainTextToHtml } from '@/lib/reportUnits';

interface DictationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** HTML actual del informe */
  currentReport: string;
  /** Recibe el nuevo HTML del informe */
  onApply: (html: string) => void;
  /** Arranca escuchando al abrir */
  autoStart?: boolean;
}

const DictationPanel = ({ open, onOpenChange, currentReport, onApply, autoStart }: DictationPanelProps) => {
  const {
    isListening, transcript, interimTranscript, error,
    startListening, stopListening, clearTranscript, setTranscript, isSupported,
  } = useSpeechRecognition();

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null); // texto plano propuesto
  const [changed, setChanged] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPreview(null);
      setChanged([]);
      clearTranscript();
      if (autoStart && isSupported) startListening();
    } else {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAI = async () => {
    const text = transcript.trim();
    if (!text) {
      toast.error('No hay texto dictado');
      return;
    }
    stopListening();
    setLoading(true);
    try {
      const base = htmlToPlainText(currentReport);
      const section = { title: 'Informe', content: base };
      const { data, error: fnError } = await supabase.functions.invoke('process-voice', {
        body: {
          mode: 'findings_v2',
          transcript: text,
          unitSections: buildUnitsPayload([section]),
        },
      });

      if (fnError) {
        const msg = (data as any)?.error || fnError.message || 'Error al procesar el dictado';
        toast.error(msg);
        return;
      }
      if ((data as any)?.error) {
        toast.error((data as any).error);
        return;
      }

      const updates: UnitUpdate[] = Array.isArray((data as any)?.unitUpdates) ? (data as any).unitUpdates : [];
      if (updates.length === 0) {
        toast.error('La IA no propuso cambios. Probá dictando con más detalle.');
        return;
      }

      const result = applyUnitUpdates(section, updates);
      setPreview(result);
      setChanged(diffUnits(base, result).changed);
    } catch (e) {
      console.error('process-voice invoke error:', e);
      toast.error('No se pudo conectar con el asistente de IA');
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!preview) return;
    onApply(plainTextToHtml(preview));
    toast.success('Informe actualizado. Revisalo y guardá.');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Dictado con asistencia de IA
          </DialogTitle>
        </DialogHeader>

        {!isSupported && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/60 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Este navegador no soporta dictado por voz. Usá Google Chrome, o escribí el texto abajo
              y aplicá la asistencia de IA igual.
            </span>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              onClick={() => (isListening ? stopListening() : startListening())}
              disabled={!isSupported || loading}
              className="flex-1"
            >
              {isListening ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
              {isListening ? 'Detener dictado' : 'Dictar'}
            </Button>
            <Button type="button" variant="outline" onClick={clearTranscript} disabled={loading}>
              Limpiar
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Texto dictado (editable)</label>
            <Textarea
              value={transcript + (interimTranscript ? ` ${interimTranscript}` : '')}
              onChange={(e) => setTranscript(e.target.value)}
              rows={5}
              placeholder='Ej: "Hígado con esteatosis moderada. Vesícula con litiasis de 8 milímetros."'
            />
            {isListening && (
              <p className="text-xs text-primary mt-1 animate-pulse">Escuchando…</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Comandos: "punto", "coma", "punto y aparte", "nueva línea", "abrir/cerrar paréntesis".
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAI}
            disabled={loading || !transcript.trim()}
            className="w-full btn-action-primary"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {loading ? 'Procesando…' : 'Aplicar con IA'}
          </Button>

          {preview !== null && (
            <div className="space-y-2">
              <label className="text-sm font-medium block">Vista previa del informe</label>
              <div className="border border-border rounded-lg p-3 bg-muted/40 text-sm space-y-1 max-h-64 overflow-y-auto">
                {preview.split('\n').map((line, i) =>
                  line.trim() === '' ? null : (
                    <p
                      key={i}
                      className={changed.includes(line.trim()) ? 'bg-primary/10 rounded px-1' : ''}
                    >
                      {line}
                    </p>
                  ),
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Resaltado = modificado por la IA. Nada se guarda hasta que presiones "Guardar Informe".
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleInsert} disabled={!preview}>Insertar en el informe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DictationPanel;
