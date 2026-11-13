import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import NexoMark from '@/components/NexoMark';
import ThemeToggle from '@/components/ThemeToggle';
import { Stethoscope, ClipboardList, Eye, Sparkles, Lock } from 'lucide-react';

// 🔒 Contraseña del evento — cambiala antes de cada presentación
const EVENT_PASSWORD = 'RECONQUISTA2026';
const EVENT_UNLOCK_KEY = 'demo_event_unlocked';

const DEMO_ACCOUNTS = [
  { email: 'secretaria@demo.com', password: 'demo1234', label: 'Secretaria', icon: ClipboardList, desc: 'Gestiona citas y pacientes' },
  { email: 'doctor@demo.com', password: 'demo1234', label: 'Médico ejecutor', icon: Stethoscope, desc: 'Realiza e informa estudios' },
  { email: 'visor@demo.com', password: 'demo1234', label: 'Médico consultor', icon: Eye, desc: 'Solo busca y descarga informes' },
];

const LoginPage = () => {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [eventPw, setEventPw] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem(EVENT_UNLOCK_KEY) === '1') setUnlocked(true);
  }, []);

  if (!loading && session) return <Navigate to="/" replace />;

  const tryUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (eventPw.trim().toUpperCase() === EVENT_PASSWORD) {
      sessionStorage.setItem(EVENT_UNLOCK_KEY, '1');
      setUnlocked(true);
      toast.success('Acceso demo desbloqueado');
    } else {
      toast.error('Clave de evento incorrecta');
    }
  };

  const signIn = async (mail: string, pass: string) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
    if (error) toast.error('Credenciales incorrectas. ¿Sembraste el demo?');
    setSubmitting(false);
  };

  const handleForgot = async () => {
    if (!email.trim()) { toast.error('Escribí tu correo arriba y volvé a tocar "Olvidé mi contraseña".'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    // Mismo mensaje exista o no el correo (para no revelar qué correos están registrados)
    if (error && !/not found|invalid/i.test(error.message)) toast.error('No se pudo enviar el correo. Probá de nuevo en unos minutos.');
    else toast.success('Si el correo está registrado, te enviamos un link para elegir una contraseña nueva. Revisá también spam.');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(email, password);
  };

  const handleSeed = async () => {
    setSeeding(true);
    toast.info('Generando datos de demostración...');
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo', { body: {} });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Error desconocido');
      toast.success(`Demo listo: ${data.patients} pacientes, ${data.appointments} citas`);
    } catch (err: any) {
      toast.error('Error al generar el demo: ' + (err?.message || err));
    }
    setSeeding(false);
  };

  return (
    <div className="login-screen min-h-screen bg-background lg:grid lg:grid-cols-[55%_45%]">
      <section className="login-brand relative flex flex-col items-center justify-center overflow-hidden px-6 py-7 lg:sticky lg:top-0 lg:h-screen lg:px-10 lg:py-12" aria-label="DMR by Nexo Imagen">
        <div className="relative flex items-center gap-5 lg:flex-col lg:gap-6">
          <NexoMark variant="silver" fullLogo className="login-brand-mark h-32 w-32 shrink-0 rounded-3xl lg:h-[352px] lg:w-[352px]" />
          <div className="text-left lg:text-center">
            <h1 className="login-brand-title text-3xl font-bold lg:text-6xl">DMR</h1>
            <p className="login-brand-subtitle mt-2 text-sm lg:text-xl">by Nexo Imagen</p>
          </div>
        </div>
        <p className="login-brand-tagline relative mt-5 text-center text-xs lg:mt-12 lg:text-sm">Diagnóstico por imágenes de precisión</p>
      </section>
      <section className="relative flex min-w-0 flex-col items-center justify-center px-5 py-10 lg:min-h-screen lg:px-8 lg:py-16">
        <div className="absolute right-4 top-3 lg:right-6 lg:top-5">
          <ThemeToggle className="text-foreground hover:bg-secondary hover:text-foreground" />
        </div>
        <div className="w-full max-w-[420px]">
          <div className="mb-5 hidden justify-center lg:flex">
            <NexoMark variant="color" className="h-10 w-11 dark:hidden" />
            <NexoMark variant="silver" className="hidden h-10 w-11 dark:block" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-card sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Iniciar sesión</h2><p className="mt-1 text-xs text-muted-foreground">Ecografía y Doppler</p></div>
              <span className="rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">DEMO</span>
            </div>

        {/* Quick access demo buttons (locked behind event password) */}
        {unlocked ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              Acceso rápido demo
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(({ email: e, password: p, label, icon: Icon, desc }) => (
                <Button
                  type="button"
                  variant="outline"
                  key={e}
                  onClick={() => signIn(e, p)}
                  disabled={submitting}
                  className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-2.5 text-left hover:border-primary hover:bg-primary/5"
                >
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    <span className="block text-[11px] text-muted-foreground">{desc}</span>
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Contraseña común: <code className="font-mono">demo1234</code>
            </p>
          </div>
        ) : (
          <form onSubmit={tryUnlock} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lock className="w-4 h-4 text-primary" />
              Acceso al demo
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ingresá la clave del evento para habilitar los accesos de demostración.
            </p>
            <Input
              type="password"
              value={eventPw}
              onChange={(e) => setEventPw(e.target.value)}
              placeholder="Clave del evento"
              autoFocus
            />
            <Button type="submit" className="w-full" size="sm">Desbloquear demo</Button>
          </form>
        )}

        {/* Standard login */}
        <form onSubmit={handleLogin} className="mt-6 space-y-3 border-t border-border pt-5">
          <h2 className="font-semibold text-center text-sm text-muted-foreground">O ingresá manualmente</h2>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs">Correo electrónico</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
          <Button type="button" variant="link" onClick={handleForgot} className="h-auto w-full py-1 text-xs text-primary underline">Olvidé mi contraseña</Button>
        </form>
          </div>

        {/* Seed/reset demo */}
        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={handleSeed}
            disabled={seeding}
            className="h-auto whitespace-normal py-1 text-xs text-muted-foreground hover:text-primary underline disabled:opacity-50"
          >
            {seeding ? 'Generando datos...' : 'Regenerar datos de demostración'}
          </Button>
        </div>

        {/* Copyright notice */}
        <p className="mt-4 text-[10px] text-muted-foreground text-center leading-relaxed px-2">
          © 2026 Diagnóstico Médico Reconquista — Todos los derechos reservados.<br />
          Software propietario. Prohibida su reproducción, distribución o uso sin autorización escrita.
        </p>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;
