import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente "admin" con permisos totales -- SOLO vive acá en el
    // servidor, nunca se expone al navegador.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verificamos quién llama, usando su propio token (no el de admin).
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: corsHeaders });
    }

    // Chequeo central de seguridad: ¿esta cuenta es administrador?
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', caller.id)
      .single();
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Esta cuenta no tiene permiso de administrador.' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list') {
      const { data: profiles, error: profilesErr } = await admin
        .from('profiles')
        .select('user_id, full_name, is_admin');
      if (profilesErr) throw profilesErr;
      const { data: roles, error: rolesErr } = await admin.from('user_roles').select('user_id, role');
      if (rolesErr) throw rolesErr;
      const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers();
      if (authErr) throw authErr;

      const users = (profiles || []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        is_admin: p.is_admin,
        email: authUsers.users.find((u) => u.id === p.user_id)?.email ?? '',
        roles: (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role),
      }));
      return new Response(JSON.stringify({ users }), { headers: corsHeaders });
    }

    if (action === 'create') {
      const { email, password, full_name, role } = body;
      if (!email || !password || !full_name || !role) {
        return new Response(JSON.stringify({ error: 'Faltan datos (email, contraseña, nombre o rol).' }), { status: 400, headers: corsHeaders });
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;
      const newUserId = created.user.id;

      const { error: roleErr } = await admin.from('user_roles').insert({ user_id: newUserId, role });
      if (roleErr) throw roleErr;

      return new Response(JSON.stringify({ ok: true, user_id: newUserId }), { headers: corsHeaders });
    }

    if (action === 'updateRole') {
      const { user_id, role } = body;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: 'Faltan datos (usuario o rol).' }), { status: 400, headers: corsHeaders });
      }
      const { error: delErr } = await admin.from('user_roles').delete().eq('user_id', user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await admin.from('user_roles').insert({ user_id, role });
      if (insErr) throw insErr;
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'Falta el usuario a borrar.' }), { status: 400, headers: corsHeaders });
      }
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: 'No podés borrar tu propia cuenta desde acá.' }), { status: 400, headers: corsHeaders });
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) throw delErr;
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Acción desconocida.' }), { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error('admin-manage-users error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Error inesperado.' }), { status: 500, headers: corsHeaders });
  }
});
