// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrlRaw || !supabaseServiceKeyRaw) {
  throw new Error('Brak zdefiniowanych zmiennych środowiskowych dla Supabase w pliku .env.local.');
}

// BARDZO BEZPIECZNE CZYSZCZENIE URL:
// 1. Usuwamy spacje i cudzysłowy (")
// 2. Usuwamy ewentualny dopisek /rest/v1 lub /rest/v1/ na końcu
// 3. Usuwamy ukośnik na samym końcu adresu URL (/)
const supabaseUrl = supabaseUrlRaw
  .trim()
  .replace(/"/g, '')
  .replace(/\/rest\/v1\/?$/, '') // <--- BEZPIECZNIK: usuwa /rest/v1 na końcu adresu
  .replace(/\/$/, '');

const supabaseServiceKey = supabaseServiceKeyRaw.trim().replace(/"/g, '');

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});