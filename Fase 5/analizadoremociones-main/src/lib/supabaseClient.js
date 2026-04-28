import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

const isPlaceholder =
  SUPABASE_URL.includes('YOUR_PROJECT') ||
  SUPABASE_KEY.includes('YOUR_ANON_KEY');

const isConfigured =
  SUPABASE_URL.length > 0 &&
  SUPABASE_KEY.length > 0 &&
  !isPlaceholder;

if (typeof window !== 'undefined') {
  if (isConfigured) {
    console.log('[Supabase] ✅ Conectado a:', SUPABASE_URL);
  } else {
    console.warn(
      '[Supabase] ⚠️ No configurado — mostrando datos mock.\n' +
      `URL: "${SUPABASE_URL}" | Key length: ${SUPABASE_KEY.length}`
    );
  }
}

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export const isSupabaseReady = () => supabase !== null;
