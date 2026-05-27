// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Sprawdzamy, czy zmienne istnieją i nie są tekstowym "undefined" lub "null"
const isUrlDefined = supabaseUrlRaw && supabaseUrlRaw !== 'undefined' && supabaseUrlRaw !== 'null';
const isKeyDefined = supabaseServiceKeyRaw && supabaseServiceKeyRaw !== 'undefined' && supabaseServiceKeyRaw !== 'null';

// Oczyszczamy wartości
const supabaseUrl = isUrlDefined 
  ? supabaseUrlRaw.trim().replace(/"/g, '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  : '';

const supabaseServiceKey = isKeyDefined 
  ? supabaseServiceKeyRaw.trim().replace(/"/g, '')
  : '';

// Sprawdzamy, czy adres URL jest poprawnym adresem HTTP/HTTPS
const isUrlValid = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

export let supabase: any = null;

if (isUrlValid && isKeyDefined) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });
  } catch (e) {
    console.warn('Błąd inicjalizacji Supabase:', e);
  }
} else {
  console.warn('OSTRZEŻENIE: Brak aktywnego adresu URL lub klucza Supabase. Uruchamiam tryb bezpieczny dla budowania.');
}