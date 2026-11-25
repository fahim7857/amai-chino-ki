const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const AUTH_ALIAS_DOMAIN = (process.env.AUTH_ALIAS_DOMAIN || '').trim() || 'users.whoknowsmebetter.local';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Deterministic internal email alias derived from normalized username.
 * Kept strictly server-side and never exposed to the frontend.
 */
export function buildInternalAlias(username) {
  const normalized = username.trim().toLowerCase();
  return `${normalized}@${AUTH_ALIAS_DOMAIN}`;
}

export async function registerWithSupabaseAuth(username, name, password, avatarUrl = null) {
  const email = buildInternalAlias(username);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username, avatar_url: avatarUrl },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.msg || data.error_description || 'Supabase registration failed');
  }

  // Insert or update public.profiles table in Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: data.id,
      name,
      username,
      avatar_url: avatarUrl || null,
    }),
  }).catch(() => {});

  return { supabaseUserId: data.id };
}

export async function loginWithSupabaseAuth(username, password) {
  const email = buildInternalAlias(username);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  if (!data.user || !data.user.id) {
    return null;
  }

  return { supabaseUserId: data.user.id, user: data.user };
}

export async function getSupabaseProfile(supabaseUserId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${supabaseUserId}&select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function getSupabaseProfileByUsername(username) {
  if (!isSupabaseConfigured()) return null;
  try {
    const normalized = username.trim().toLowerCase();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(normalized)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function updateSupabaseProfile(supabaseUserId, updates) {
  if (!isSupabaseConfigured()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${supabaseUserId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        ...updates,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch {
    return null;
  }
}
