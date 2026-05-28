'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Pobieramy URL, z którego korzysta kod, do diagnostyki
  const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL

  console.log('=== [DIAGNOSTYKA] START LOGOWANIA ===')
  console.log('1. Próba logowania na email:', email)
  console.log('2. Kod łączy się z projektem o adresie:', currentUrl)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.log('3. [BŁĄD] Supabase zwrócił błąd:')
    console.error(error)
    console.log('=====================================')
    
    // Przekierowujemy i pokazujemy na ekranie dokładny komunikat błędu z bazy
    return redirect(`/login?error=${encodeURIComponent(`${error.message} (status: ${error.status})`)}`)
  }

  console.log('3. [SUKCES] Zalogowano pomyślnie! ID Użytkownika:', data.user?.id)
  console.log('=====================================')

  revalidatePath('/', 'layout')
  return redirect('/')
}