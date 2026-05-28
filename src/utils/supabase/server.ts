import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Sprawdzamy obie najpopularniejsze wersje nazw zmiennych środowiskowych
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  // Jeśli ich nie ma, wyrzucamy własny, czytelny błąd diagnostyczny
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Brak zmiennych środowiskowych Supabase w pliku .env.local!\n` +
      `Wykryto URL: ${supabaseUrl ? 'Działa' : 'BRAK'}\n` +
      `Wykryto KEY: ${supabaseAnonKey ? 'Działa' : 'BRAK'}`
    )
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorujemy błędy setAll podczas odświeżania w middleware
          }
        },
      },
    }
  )
}