'use client';
import { createBrowserClient } from '@supabase/ssr';
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error('Sign-in is not available yet. Please try again after setup is complete.');
  return createBrowserClient(url, key);
}
