import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';

type Role = 'doctor' | 'secretary' | 'viewer';

interface AdminUser {
  user_id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  roles: Role[];
}

const ROLE_LABELS: Record<Role, string> = {
  doctor: 'Médico',
  secretary: 'Secretaria',
  viewer: 'Médico visualizador',
};

const AdminUsersPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('secretary');

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-manage-users', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await call({ action: 'list' });
      setUsers(data.users || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
      return;
    }
    if (isAdmin) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) {
      toast.error('Completá email, contraseña y nombre.');
      return;
    }
    setCreating(true);
    try {
      await call({ action: 'create', email: newEmail, password: newPassword, full_name: newName, role: newRole });
      toast.success('Usuario creado.');
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('secretary');
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (user_id: string, role: Role) => {
    try {
      await call({ action: 'updateRole', user_id, role });
      toast.success('Rol actualizado.');
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el rol.');
    }
  };

  const handleDelete = async (user_id: string, full_name: string) => {
    if (!window.confirm(`¿Seguro que querés borrar a ${full_name}? Esta acción no se puede deshacer.`)) return;
    try {
      await call({ action: 'delete', user_id });
      toast.success('Usuario borrado.');
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo borrar el usuario.');
    }
  };

  if (authLoading || !isAdmin) return null;

  return (
    <AppLayout title="Administrar usuarios" showBack>
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Crear nuevo usuario
          </h2>
          <div>
            <Label htmlFor="new-name">Nombre completo</Label>
            <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Dra. Ejemplo" />
          </div>
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nombre@ejemplo.com" />
          </div>
          <div>
            <Label htmlFor="new-password">Contraseña inicial</Label>
            <Input id="new-password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Se la das vos, la puede cambiar después" />
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">Médico</SelectItem>
                <SelectItem value="secretary">Secretaria</SelectItem>
                <SelectItem value="viewer">Médico visualizador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={creating}>
            {creating ? 'Creando...' : 'Crear usuario'}
          </Button>
        </form>

        <div className="space-y-2">
          <h2 className="font-semibold">Usuarios actuales</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay usuarios cargados.</p>
          ) : (
            users.map((u) => (
              <div key={u.user_id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate flex items-center gap-1">
                    {u.full_name}
                    {u.is_admin && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={u.roles[0] || ''}
                    onValueChange={(v) => handleRoleChange(u.user_id, v as Role)}
                    disabled={u.is_admin}
                  >
                    <SelectTrigger className="w-[170px]"><SelectValue placeholder="Sin rol" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Médico</SelectItem>
                      <SelectItem value="secretary">Secretaria</SelectItem>
                      <SelectItem value="viewer">Médico visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                  {!u.is_admin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.user_id, u.full_name)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;
