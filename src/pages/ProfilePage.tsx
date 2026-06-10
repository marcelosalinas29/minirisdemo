import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Save, PenLine, Camera, Clock } from 'lucide-react';

const ProfilePage = () => {
  const { profile, role, isDoctor, isSecretary, user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '');
  const [licenseNumbers, setLicenseNumbers] = useState(profile?.license_numbers ?? '');
  const [signatureText, setSignatureText] = useState(profile?.signature_text ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: avatarUrl } as any).eq('user_id', user.id);
      await refreshProfile();
      toast.success('Foto actualizada');
    } catch (err) {
      console.error(err);
      toast.error('Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        specialty: specialty || null,
        license_numbers: licenseNumbers || null,
        signature_text: signatureText || null,
      } as any)
      .eq('user_id', profile.user_id);

    if (error) {
      toast.error('Error al guardar el perfil');
    } else {
      await refreshProfile();
      toast.success('Perfil actualizado');
    }
    setSaving(false);
  };

  const initials = (profile?.full_name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <AppLayout title="Mi Perfil">
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          {/* Avatar section */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                ) : null}
                <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md hover:bg-primary/90 transition-colors"
                disabled={uploading}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="text-center">
              <p className="font-semibold">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {role === 'doctor' ? 'Médico / Doctor' : 'Secretaria'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            {isDoctor && (
              <>
                <div className="space-y-1">
                  <Label>Especialidad</Label>
                  <Input
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="ej: Médico especialista en Diagnóstico por Imágenes"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Matrícula(s)</Label>
                  <Textarea
                    value={licenseNumbers}
                    onChange={(e) => setLicenseNumbers(e.target.value)}
                    placeholder="ej: MN 134217  MP 7298  Fº54  Lº4to"
                    className="text-sm"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparecerá en el sello del PDF
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="flex items-center gap-1">
                    <PenLine className="w-4 h-4" />
                    Firma Digital (texto estilizado)
                  </Label>
                  <Input
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    placeholder="ej: Dr. Salinas A. Marcelo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Texto que aparece como firma en el PDF. Si se deja vacío, se usa el nombre completo.
                  </p>
                  {(signatureText || fullName) && (
                    <div className="bg-muted/50 rounded-lg p-4 mt-2 text-center">
                      <p className="text-xs text-muted-foreground mb-2">Vista previa de firma:</p>
                      <div className="border-t border-foreground/30 w-40 mx-auto pt-2">
                        <p className="font-serif italic text-lg">{signatureText || fullName}</p>
                        {specialty && <p className="text-xs text-muted-foreground">{specialty}</p>}
                        {licenseNumbers && <p className="text-[10px] text-muted-foreground">{licenseNumbers}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Link to schedule config */}
                <Button variant="outline" className="w-full" onClick={() => navigate('/schedule')}>
                  <Clock className="w-4 h-4 mr-2" />
                  Configurar Horarios de Atención
                </Button>
              </>
            )}

            {isSecretary && (
              <Button variant="outline" className="w-full" onClick={() => navigate('/schedule')}>
                <Clock className="w-4 h-4 mr-2" />
                Configurar Horarios de Médicos
              </Button>
            )}

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
