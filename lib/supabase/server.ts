import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function supabaseServer() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Authentication is not configured.');
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });
}
export async function getAuthenticatedUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return null;
  const client = await supabaseServer();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return {
    userId: data.user.id,
    email: data.user.email || '',
    fullName:
      typeof data.user.user_metadata?.full_name === 'string'
        ? data.user.user_metadata.full_name
        : null,
  };
}
