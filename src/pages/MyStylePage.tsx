import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { STUDY_TYPES, studyTitle } from '@/types/medical';
import { fetchMyTemplates, type DoctorTemplate } from '@/lib/doctorTemplates';
import { EMPTY_SETTINGS, fetchMySettings, saveMySettings, type DoctorSettings } from '@/lib/doctorSettings';
import { STYLE_PRESETS, type ReportStyle } from '@/lib/reportStyle';
import { buildReportHtml, optionsForStudy } from '@/lib/templateResolve';

const SELECT = 'w-full h-10 rounded-md border border-input bg-background px-3 text-sm';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-sm">{label}</span>
    <div className="shrink-0">{children}</div>
  </div>
);

/** Estilo de informe y plantilla por defecto de cada estudio, para cada médico. */
const MyStylePage = () => {
  const { isSecretary, isViewer } = useAuth();
  const [settings, setSettings] = useState<DoctorSettings>(EMPTY_SETTINGS);
  const [own, setOwn] = useState<DoctorTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchMySettings().catch(() => EMPTY_SETTINGS), fetchMyTemplates().catch(() => [])])
      .then(([s, o]) => { setSettings(s); setOwn(o); setLoaded(true); });
  }, []);

  const setStyle = (patch: Partial<ReportStyle>) => setSettings((s) => ({ ...s, style: { ...s.style, ...patch } }));
  const setDefault = (study: string, ref: string) =>
    setSettings((s) => {
      const defaults = { ...s.defaults };
      if (ref) defaults[study] = ref; else delete defaults[study];
      return { ...s, defaults };
    });

  const save = async () => {
    setSaving(true);
    try { await saveMySettings(settings); toast.success('Guardado'); } catch { toast.error('No se pudo guardar'); }
    setSaving(false);
  };

  const studiesWithOptions = useMemo(() => STUDY_TYPES.filter((t) => optionsForStudy(t, own).length > 0), [own]);
  const previewOne = useMemo(() => buildReportHtml('Ecografía Renal', own, settings), [own, settings]);
  const previewMany = useMemo(() => buildReportHtml('Ecografía Mamaria + Ecografía Transvaginal', own, settings), [own, settings]);

  if (isSecretary || isViewer) return <AppLayout title="Mi estilo"><p className="p-4 text-sm">Solo para médicos.</p></AppLayout>;
  if (!loaded) return <AppLayout title="Mi estilo"><p className="p-4 text-sm">Cargando…</p></AppLayout>;

  const st = settings.style;
  return (
    <AppLayout title="Mi estilo de informe">
      <div className="p-4 space-y-6 max-w-xl mx-auto">
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Estilos sugeridos</h2>
          <p className="text-xs text-muted-foreground">Tocá uno para empezar y después ajustalo a tu gusto.</p>
          <div className="grid gap-2">
            {STYLE_PRESETS.map((p) => (
              <Button key={p.name} variant="outline" className="h-auto justify-start py-2 text-left" onClick={() => setSettings((s) => ({ ...s, style: { ...p.style } }))}>
                <span><span className="font-semibold block">{p.name}</span><span className="text-xs text-muted-foreground font-normal">{p.description}</span></span>
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-1 border-t border-border pt-4">
          <h2 className="text-base font-semibold">Ajustes</h2>
          <Row label="Interlineado">
            <select className={SELECT} value={st.lineHeight} onChange={(e) => setStyle({ lineHeight: Number(e.target.value) })}>
              <option value={1}>Muy junto (1)</option>
              <option value={1.15}>Compacto (1,15)</option>
              <option value={1.3}>Normal (1,3)</option>
              <option value={1.6}>Clásico (1,6)</option>
              <option value={2}>Aireado (2)</option>
            </select>
          </Row>
          <Row label="Alineación del texto">
            <select className={SELECT} value={st.align} onChange={(e) => setStyle({ align: e.target.value as ReportStyle['align'] })}>
              <option value="left">Izquierda</option>
              <option value="justify">Justificado</option>
              <option value="center">Centrado</option>
            </select>
          </Row>
          <Row label="Título del estudio en negrita"><Switch checked={st.titleBold} onCheckedChange={(v) => setStyle({ titleBold: v })} /></Row>
          <Row label="Título del estudio en mayúscula"><Switch checked={st.titleUpper} onCheckedChange={(v) => setStyle({ titleUpper: v })} /></Row>
          <Row label="Secciones (MAYÚSCULA) en negrita"><Switch checked={st.sectionBold} onCheckedChange={(v) => setStyle({ sectionBold: v })} /></Row>
          <Row label='Etiquetas ("Hígado:") en negrita'><Switch checked={st.labelBold} onCheckedChange={(v) => setStyle({ labelBold: v })} /></Row>
          <Row label="Con un solo estudio, arriba pone">
            <select className={SELECT} value={st.singleHeading} onChange={(e) => setStyle({ singleHeading: e.target.value as ReportStyle['singleHeading'] })}>
              <option value="none">Nada</option>
              <option value="informe">INFORME:</option>
              <option value="estudio">El título del estudio</option>
            </select>
          </Row>
          <Row label="Espacio entre estudios (renglones)">
            <select className={SELECT} value={st.gapBetweenStudies} onChange={(e) => setStyle({ gapBetweenStudies: Number(e.target.value) })}>
              <option value={0}>Ninguno</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </Row>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-base font-semibold">Vista previa</h2>
          <p className="text-xs text-muted-foreground">Un estudio, y dos estudios en el mismo turno.</p>
          {[previewOne, previewMany].map((h, i) => (
            <div key={i} className="border border-border rounded-lg p-3 text-sm bg-background [&_p]:min-h-[1em] [&_p]:my-0" dangerouslySetInnerHTML={{ __html: h }} />
          ))}
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-base font-semibold">Plantilla por defecto de cada estudio</h2>
          <p className="text-xs text-muted-foreground">Si elegís una, se carga sola al abrir ese estudio (con aviso para cambiarla). "Preguntarme" muestra la lista de siempre.</p>
          {studiesWithOptions.map((study) => {
            const opts = optionsForStudy(study, own);
            return (
              <div key={study} className="space-y-1">
                <p className="text-xs font-semibold uppercase">{studyTitle(study)}</p>
                <select className={SELECT} value={settings.defaults[study] || ''} onChange={(e) => setDefault(study, e.target.value)}>
                  <option value="">Preguntarme</option>
                  {opts.map((o) => <option key={o.ref} value={o.ref}>{o.name}{o.own ? ' (mía)' : ''}</option>)}
                </select>
              </div>
            );
          })}
        </section>

        <Button className="w-full sticky bottom-3" disabled={saving} onClick={save}>Guardar</Button>
      </div>
    </AppLayout>
  );
};

export default MyStylePage;
