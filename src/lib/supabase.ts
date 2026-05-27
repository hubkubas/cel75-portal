// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrlRaw || !supabaseServiceKeyRaw) {
  throw new Error('Brak zdefiniowanych zmiennych środowiskowych dla Supabase w pliku .env.local.');
}

const supabaseUrl = supabaseUrlRaw
  .trim()
  .replace(/"/g, '')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');

const supabaseServiceKey = supabaseServiceKeyRaw.trim().replace(/"/g, '');

// DIAGNOSTYKA VERCEL: Wypisze początek wklejonej wartości, jeśli nie jest adresem http/https
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  console.error(`BŁĄD FORMATA URL W VERCEL: Wklejona wartość zaczyna się od: "${supabaseUrl.substring(0, 25)}..."`);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});