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

export async function registerWithSupabaseAuth(username, name, password) {
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
      user_metadata: { name, username },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.msg || data.error_description || 'Supabase registration failed');
  }

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

  return { supabaseUserId: data.user.id };
}
