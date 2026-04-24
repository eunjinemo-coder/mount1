import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { Database } from './types.generated';

export function createServerSupabase(cookies: CookieMethodsServer) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return createServerClient<Database>(url, key, { cookies });
}
