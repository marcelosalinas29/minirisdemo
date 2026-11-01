import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Pantalla a la que llega el link del correo para elegir una contraseña nueva. */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (pw !== pw2) { toast.error('Las dos contraseñas no coinciden.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { toast.error(error.message || 'No se pudo cambiar la contraseña.'); return; }
    toast.success('Contraseña cambiada. Ya podés usar el sistema.');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={save} className="w-full max-w-sm bg-card border border-border rounded-xl p-5 space-y-3">
        <h1 className="text-lg font-semibold">Elegir contraseña nueva</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Abrí el link que te llegó por correo. Si venció, pedí otro desde "Olvidé mi contraseña".</p>
        ) : (
          <>
            <div className="space-y-1"><Label htmlFor="pw">Contraseña nueva</Label><Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
            <div className="space-y-1"><Label htmlFor="pw2">Repetirla</Label><Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Guardando…' : 'Guardar contraseña'}</Button>
          </>
        )}
        <button type="button" className="w-full text-xs text-primary underline" onClick={() => navigate('/login')}>Volver al ingreso</button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
