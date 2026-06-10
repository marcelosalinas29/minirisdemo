import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import clinicLogo from '@/assets/clinic-logo.png';
import { Stethoscope, ClipboardList, Eye, Sparkles, Lock } from 'lucide-react';

// 🔒 Contraseña del evento — cambiala antes de cada presentación
const EVENT_PASSWORD = 'RECONQUISTA2026';
const EVENT_UNLOCK_KEY = 'demo_event_unlocked';

const DEMO_ACCOUNTS = [
  { email: 'secretaria@demo.com', password: 'demo1234', label: 'Secretaria', icon: ClipboardList, desc: 'Gestiona citas y pacientes' },
  { email: 'doctor@demo.com', password: 'demo1234', label: 'Médico ejecutor', icon: Stethoscope, desc: 'Realiza e informa estudios' },
  { email: 'visor@demo.com', password: 'demo1234', label: 'Médico visualizador', icon: Eye, desc: 'Solo lectura de informes' },
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3">
          <img src={clinicLogo} alt="Logo" className="w-20 h-20 object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">DEMO — Sistema RIS</h1>
            <p className="text-sm text-muted-foreground">Ecografía y Doppler</p>
          </div>
        </div>

        {/* Quick access demo buttons */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            Acceso rápido demo
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map(({ email: e, password: p, label, icon: Icon, desc }) => (
              <button
                key={e}
                onClick={() => signIn(e, p)}
                disabled={submitting}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
              >
                <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Contraseña común: <code className="font-mono">demo1234</code>
          </p>
        </div>

        {/* Standard login */}
        <form onSubmit={handleLogin} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
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
        </form>

        {/* Seed/reset demo */}
        <div className="text-center">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="text-xs text-muted-foreground hover:text-primary underline disabled:opacity-50"
          >
            {seeding ? 'Generando datos...' : 'Regenerar datos de demostración'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
