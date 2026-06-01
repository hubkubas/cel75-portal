'use server'

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// ==========================================
// TYPY I INTERFEJSY (SaaS)
// ==========================================

export interface Message {
  id?: number;
  created_at?: string;
  user_id?: string;
  rola: string; // 'user' | 'model'
  tresc: string;
  obrazek_base64?: string | null;
}

// ==========================================
// FUNKCJE POMOCNICZE (BEZPIECZNE FORMATOWANIE DATY)
// ==========================================

/**
 * Bezpiecznie generuje dzisiejszą datę w formacie YYYY-MM-DD (ISO)
 * ściśle dla polskiej strefy czasowej, bez słowa kluczowego "export"
 * w celu uniknięcia błędów kompilacji Next.js Server Actions.
 */
function getWarsawDateString(): string {
  const warsawString = new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" });
  const warsawDate = new Date(warsawString);
  const yyyy = warsawDate.getFullYear();
  const mm = String(warsawDate.getMonth() + 1).padStart(2, '0');
  const dd = String(warsawDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ==========================================
// I. AUTORYZACJA I PROFIL UŻYTKOWNIKA (SaaS)
// ==========================================

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  // Czyścimy cache strony głównej i odsyłamy do ekranu logowania
  revalidatePath('/', 'layout');
  redirect('/login');
}

// ==========================================
// II. POBIERANIE I ZAPISYWANIE DANYCH BIOLOGICZNYCH (DZIŚ)
// ==========================================

export async function getTodayMorningReport(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const dzis = getWarsawDateString();

  // Pobieramy raport na dziś, ale TYLKO dla zalogowanego użytkownika
  const { data, error } = await supabase
    .from('poranki')
    .select('*')
    .eq('data', dzis)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error("Błąd getTodayMorningReport:", error);
    return null;
  }
  return data;
}

export async function saveMorningReport(formData: FormData): Promise<void> {
  console.log("=== [DIAGNOSTYKA] OTRZYMANO FORMULARZ PORANNY ===");
  
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log("-> [BŁĄD] Brak zalogowanego użytkownika.");
    throw new Error("Brak autoryzacji do wykonania tej akcji.");
  }
  console.log("-> Zalogowany użytkownik ID:", user.id);

  const dzis = getWarsawDateString();
  console.log("-> Wyliczona dzisiejsza data polska:", dzis);

  // Sprawdzamy czy raport istnieje dla tego użytkownika
  const { data: existing } = await supabase
    .from('poranki')
    .select('id')
    .eq('data', dzis)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    console.log("-> [Cicha blokada] Raport na dziś już istnieje w bazie pod ID:", existing.id);
    console.log("=== [DIAGNOSTYKA] KONIEC PROCESU (BEZ ZAPISU) ===");
    return;
  }

  // Dane biologiczne
  const waga = parseFloat(formData.get('waga') as string) || 0;
  const hrv = parseInt(formData.get('hrv') as string, 10) || 0;
  const body_battery = parseInt(formData.get('body_battery') as string, 10) || 0;
  const jakosc_snu = parseInt(formData.get('jakosc_snu') as string, 10) || 0;
  const czas_na_trening = parseInt(formData.get('czas_na_trening') as string, 10) || 0;
  const notatki = (formData.get('notatki') as string) || '';

  // Pobieranie profilu użytkownika
  const { data: profile, error: profileError } = await supabase
    .from('profile')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.log("-> [BŁĄD] Nie udało się pobrać profilu z bazy:", profileError.message);
  }

  const imie = profile?.imie || 'zawodnik';
  const wiek = profile?.wiek || '';
  const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };
  const kadencja = profile?.strefy_tetna?.kadencja_target || 90;
  
  // Nowe parametry dynamiczne
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
  const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
  const poziom = profile?.poziom_zaawansowania || 'Początkujący';
  const oczekiwania = profile?.oczekiwania_od_trenera || 'Spokojne i wspierające doradztwo';
  const celeSportowe = profile?.cele_sportowe || 'Zdrowie i sprawność';

  let aiAnaliza = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Przeanalizuj dzisiejszy poranek zawodnika o imieniu ${imie}:
      Waga: ${waga} kg
      HRV: ${hrv} ms
      Body Battery: ${body_battery}
      Jakość snu: ${jakosc_snu}/100
      Czas na aktywność dzisiaj: ${czas_na_trening} minut
      Notatki użytkownika: ${notatki || 'brak'}`;

      // --- DYNAMICZNY GENERATOR OSOBOWOŚCI TRENERA (PERSONAS + ODŻYWIANIE) ---
      let dynamicSystemInstruction = "";

      if (glownaDyscyplina === 'Rower') {
        dynamicSystemInstruction = `
          Jesteś wybitnym Trenerem Kolarskim, Dyrektorem Sportowym z Wozu Technicznego oraz ekspertem w dziedzinie fizjologii sportu i żywienia dr. Iñigo San-Millána.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          Poziom zaawansowania: ${poziom}. Cel wagowy: ${celWagowy}. Cele sportowe: ${celeSportowe}. Oczekiwania: ${oczekiwania}.

          Kluczowe zalecenia kolarskie:
          - Fundamentem jest Strefa 2 (Zone 2) tętna, która dla tego zawodnika wynosi: ${zone2.min}-${zone2.max} bpm przy kadencji: ${kadencja}+ RPM.
          - Komunikuj się z pasją, kolarskim humorem, używaj dużo emotikonów (🚴‍♂️, 📻, 🚀, 🥞), stylizuj wypowiedź na odprawę przez radio z wozu technicznego.

          KATEGORYCZNY WYMÓG STRUKTURY ODPOWIEDZI (Używaj dokładnie tych nagłówków Markdown):
          
          # 🎙️ Odprawa i analiza poranna (Analiza HRV: ${hrv} ms, Body Battery i snu)
          
          # 🚴‍♂️ Plan treningowy na dziś (Zadanie na dzisiejsze ${czas_na_trening} minut)
          - Rozpisz dokładnie intensywność, zakres tętna i kadencję. Jeśli zawodnik napisał w notatkach konkretne plany (np. wyjazd do Góry Kalwarii), dostosuj to zadanie wprost do jego trasy i planu!
          
          # 🥞 PROTOKÓŁ DIETETYCZNY I ODŻYWIANIE (Przed, w trakcie i po wysiłku)
          - Musisz bezwzględnie i szczegółowo rozpisać jedzenie na dziś:
            1. CO ZJEŚĆ NA ŚNIADANIE przed tą aktywnością (węglowodany, źródła i czas przed startem).
            2. ODŻYWIANIE W TRAKCIE JAZDY: Co pić (izotonik/elektrolity) oraz co jeść (żele, banany, batony) – podaj gramaturę węglowodanów na każdą godzinę wysiłku.
            3. REGENERACJA PO JAZDZIE: Co i jak szybko zjeść po powrocie (białko, węglowodany do odbudowy glikogenu w oknie anabolicznym) oraz jak przywrócić nawodnienie.
        `;
      } 
      else if (glownaDyscyplina === 'Bieg') {
        dynamicSystemInstruction = `
          Jesteś profesjonalnym Trenerem Biegowym, fizjoterapeutą sportowym oraz ekspertem ds. biomechaniki biegu i żywienia maratońskiego.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          Poziom zaawansowania: ${poziom}. Cel wagowy: ${celWagowy}. Cele sportowe: ${celeSportowe}. Oczekiwania: ${oczekiwania}.

          Kluczowe zalecenia biegowe:
          - Unikaj przeciążeń stawów kolanowych i skokowych. Kładź nacisk na prawidłową technikę, kadencję biegową (ok. 170-180 kroków/min) i stabilizację.
          - Strefa regeneracyjna tętna w biegu dla niego to: ${zone2.min}-${zone2.max} bpm.
          - Używaj biegowych emotikonów (🏃‍♂️, 👟, ⏱️, 🍌).

          KATEGORYCZNY WYMÓG STRUKTURY ODPOWIEDZI (Używaj dokładnie tych nagłówków Markdown):
          
          # 🎙️ Odprawa i analiza biegowa (Analiza HRV: ${hrv} ms, Body Battery i snu)
          
          # 🏃‍♂️ Zadanie biegowe na dziś (Dziś biegamy przez ${czas_na_trening} minut)
          
          # 🥞 PROTOKÓŁ DIETETYCZNY I ODŻYWIANIE (Przed, w trakcie i po biegu)
          - Rozpisz dokładnie węglowodanowe śniadanie biegowe, nawodnienie i odżywianie w trakcie biegu oraz potreningowy shake białkowo-węglowodanowy na regenerację.
        `;
      } 
      else {
        // Profil Senior / Spacer
        dynamicSystemInstruction = `
          Jesteś ciepłym, opiekuńczym Mentorem Zdrowotnym, ekspertem ds. medycyny długowieczności (longevity) oraz sprawności seniorów.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat. Cel: ${celeSportowe}. Podejście: Bardzo wspierające, cierpliwe, pełne empatii i ciepła.

          Kluczowe zalecenia geriatryczne i ruchowe:
          - Główną formą aktywności są marsze rekreacyjne, spacery oraz ćwiczenia równowagi.
          - Tętno podczas marszu powinno być bezpieczne, łagodne dla serca (90-105 bpm).
          - Używaj wspierających emotikonów (🌳, 🚶‍♂️, ☀️, 🍵).

          KATEGORYCZNY WYMÓG STRUKTURY ODPOWIEDZI (Używaj dokładnie tych nagłówków Markdown):
          
          # 🎙️ Samopoczucie i kondycja (Analiza HRV: ${hrv} ms i snu)
          
          # 🌳 Dzisiejszy spacer i sprawność (Zaplanowane ${czas_na_trening} minut marszu)
          
          # 🍵 DIETA I NAWODNIENIE (Wskazówki żywieniowe dla seniora)
          - Opisz, co lekkiego i odżywczego zjeść przed wyjściem, jak zadbać o nawodnienie podczas spaceru (np. woda z cytryną) oraz jaki lekki, wysokobiałkowy posiłek regeneracyjny zjeść po powrocie.
        `;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          })
        }
      );

      if (response.ok) {
        const resData = await response.json() as any;
        aiAnaliza = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }
  } catch (err) {
    console.error("Błąd generowania analizy przez Gemini:", err);
  }

  // Zapisujemy poranek w bazie z powiązaniem user_id
  const { error: insertError } = await supabase
    .from('poranki')
    .insert([{
      user_id: user.id,
      data: dzis,
      waga,
      hrv,
      body_battery,
      jakosc_snu,
      czas_na_trening,
      notatki: notatki || null,
      ai_analiza: aiAnaliza || null
    }]);

  if (insertError) {
    console.error("Błąd zapisu poranka w Supabase:", insertError);
    return;
  }

  revalidatePath('/');
}

// ==========================================
// III. STATYSTYKI I ARCHIWUM (DZIŚ VS HISTORIA)
// ==========================================

export async function getDashboardStats(): Promise<any> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      avgWeight: 0,
      avgHrv: 0,
      avgSleep: 0,
      totalWorkouts: 0,
      totalKm: 0,
      avgHr: 0,
      avgCadence: 0
    };
  }

  const siedemDniTemu = new Date();
  siedemDniTemu.setDate(siedemDniTemu.getDate() - 7);
  const data7 = siedemDniTemu.toISOString().split('T')[0];

  // Pobieramy poranki zalogowanego użytkownika
  const { data: poranki } = await supabase
    .from('poranki')
    .select('waga, hrv, jakosc_snu')
    .eq('user_id', user.id)
    .gte('data', data7);

  let avgWeight = 0;
  let avgHrv = 0;
  let avgSleep = 0;

  if (poranki && poranki.length > 0) {
    const weights = poranki.map(p => Number(p.waga)).filter(w => w > 0);
    const hrvs = poranki.map(p => Number(p.hrv)).filter(h => h > 0);
    const sleeps = poranki.map(p => Number(p.jakosc_snu)).filter(s => s > 0);

    if (weights.length > 0) avgWeight = Number((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1));
    if (hrvs.length > 0) avgHrv = Math.round(hrvs.reduce((a, b) => a + b, 0) / hrvs.length);
    if (sleeps.length > 0) avgSleep = Math.round(sleeps.reduce((a, b) => a + b, 0) / sleeps.length);
  }

  const trzydziesciDniTemu = new Date();
  trzydziesciDniTemu.setDate(trzydziesciDniTemu.getDate() - 30);
  const data30 = trzydziesciDniTemu.toISOString().split('T')[0];

  // Pobieramy treningi zalogowanego użytkownika
  const { data: treningi } = await supabase
    .from('treningi')
    .select('dystans, tetno_srednie, kadencja_srednia')
    .eq('user_id', user.id)
    .gte('data', data30);

  let totalWorkouts = 0;
  let totalKm = 0;
  let avgHr = 0;
  let avgCadence = 0;

  if (treningi && treningi.length > 0) {
    totalWorkouts = treningi.length;
    
    const distances = treningi.map(t => Number(t.dystans)).filter(d => d > 0);
    const hrs = treningi.map(t => Number(t.tetno_srednie)).filter(h => h > 0);
    const cadences = treningi.map(t => Number(t.kadencja_srednia)).filter(c => c > 0);

    totalKm = Number(distances.reduce((a, b) => a + b, 0).toFixed(1));
    if (hrs.length > 0) avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
    if (cadences.length > 0) avgCadence = Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length);
  }

  return {
    avgWeight,
    avgHrv,
    avgSleep,
    totalWorkouts,
    totalKm,
    avgHr,
    avgCadence
  };
}

export async function getLatestAnalyses(): Promise<{ morningAnalysis: string | null, workoutAnalysis: string | null }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { morningAnalysis: null, workoutAnalysis: null };
  }

  const dzis = getWarsawDateString();

  // Pobieramy najnowszą analizę poranka z dni POPRZEDNICH (data < dzis)
  const { data: morningData } = await supabase
    .from('poranki')
    .select('ai_analiza')
    .eq('user_id', user.id)
    .lt('data', dzis)
    .not('ai_analiza', 'is', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Pobieramy najnowszą analizę treningu z dni POPRZEDNICH (data < dzis)
  const { data: workoutData } = await supabase
    .from('treningi')
    .select('ai_analiza')
    .eq('user_id', user.id)
    .lt('data', dzis)
    .not('ai_analiza', 'is', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    morningAnalysis: morningData?.ai_analiza || null,
    workoutAnalysis: workoutData?.ai_analiza || null
  };
}

export async function getUnsentWorkout(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .eq('wyslano', false)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Błąd getUnsentWorkout:", error);
    return null;
  }

  return data;
}

export async function getTodayWorkout(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // ZMIANA KLUCZOWA: Zamiast szukać treningu strictly z dzisiejszą datą,
  // pobieramy ABSOLUTNIE OSTATNI (najnowszy) trening zalogowanego użytkownika.
  // Dzięki temu wczorajsze lub starsze treningi zaimportowane ze Stravy są widoczne na środku ekranu!
  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Błąd getTodayWorkout (ostatni trening):", error);
    return null;
  }

  return data;
}

export async function getRecentWorkouts(): Promise<any[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .order('data', { ascending: false })
    .limit(3);

  if (error) {
    console.error("Błąd getRecentWorkouts:", error);
    return [];
  }

  return data || [];
}

// ==========================================
// IV. MULTIMEDIALNY CZAT Z TRENEREM AI (JEDEN MÓZG)
// ==========================================

export async function getChatHistory(): Promise<Message[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return [];

  const { data, error } = await supabase
    .from('czat_wiadomosci')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Błąd getChatHistory:", error);
    return [];
  }
  // Rzutowanie typu as Message[] w celu zapewnienia pełnej zgodności z kompilatorem TS
  return (data as Message[]) || [];
}

export async function clearChatHistory(): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return;

  await supabase
    .from('czat_wiadomosci')
    .delete()
    .eq('user_id', user.id);

  revalidatePath('/');
}

export async function sendChatMessage(content: string, imageBase64?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Brak autoryzacji do wysłania wiadomości." };
    }

    // Zapisujemy wiadomość użytkownika w bazie z jego user_id
    const { error: insertUserError } = await supabase
      .from('czat_wiadomosci')
      .insert([{
        user_id: user.id,
        rola: 'user',
        tresc: content,
        obrazek_base64: imageBase64 || null
      }]);

    if (insertUserError) {
      console.error("Błąd zapisu wiadomości użytkownika:", insertUserError);
      return { success: false, error: "Nie udało się zapisać Twojej wiadomości." };
    }

    const dzis = getWarsawDateString();

    // Pobieramy pełny żywy kontekst użytkownika z bazy danych do zasilenia czatu (JEDEN MÓZG)
    const { data: profile } = await supabase.from('profile').select('*').eq('id', user.id).maybeSingle();
    const { data: todayReport } = await supabase.from('poranki').select('*').eq('user_id', user.id).eq('data', dzis).maybeSingle();
    const { data: todayWorkout } = await supabase.from('treningi').select('*').eq('user_id', user.id).eq('data', dzis).maybeSingle();

    // Logi diagnostyczne (pomocne podczas wdrożenia na Vercel)
    console.log(`[DIAGNOSTYKA CZATU] Użytkownik: ${user.id}, Wyliczona data: ${dzis}`);
    console.log(`[DIAGNOSTYKA CZATU] Znaleziono profil: ${!!profile}`);
    console.log(`[DIAGNOSTYKA CZATU] Znaleziono dzisiejszy raport: ${!!todayReport}`);
    console.log(`[DIAGNOSTYKA CZATU] Znaleziono dzisiejszy trening: ${!!todayWorkout}`);

    const history = await getChatHistory();
    const last10Messages = history.slice(-10);

    const imie = profile?.imie || 'zawodnik';
    const wiek = profile?.wiek || '';
    const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
    const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
    const celeSportowe = profile?.cele_sportowe || 'Zdrowie';
    const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };

    // System prompt czatu łączący całą wiedzę o zawodniku
    const dynamicChatInstruction = `
      Jesteś tym samym Osobistym Trenerem AI i ekspertem metabolicznym, który analizuje codzienne raporty poranne i treningi użytkownika: ${imie}.
      Masz KATEGORYCZNY obowiązek znać jego aktualny stan zdrowotny i biologiczny na dzisiaj. Twoje odpowiedzi muszą być w pełni spójne z tym, co działo się rano i na treningu.

      === PROFIL ZAWODNIKA ===
      - Wiek: ${wiek} lat
      - Główna dyscyplina: ${glownaDyscyplina}
      - Cel sportowy: ${celeSportowe}
      - Cel wagowy: ${celWagowy}
      - Strefa 2 (Zone 2) tętna: ${zone2.min}-${zone2.max} bpm

      === AKTUALNY STAN BIOLOGICZNY NA DZIŚ (${dzis}) ===
      ${todayReport ? `
      - Waga rano: ${todayReport.waga} kg
      - HRV rano: ${todayReport.hrv} ms
      - Body Battery: ${todayReport.body_battery}/100
      - Jakość snu: ${todayReport.jakosc_snu}/100
      - Zadeklarowany czas na aktywność: ${todayReport.czas_na_trening} minut
      - ODPRAWA PORANNA KTÓRĄ MU JUŻ DZISIAJ WYGENEROWAŁEŚ (Użyj tej wiedzy!): 
        "${todayReport.ai_analiza}"
      ` : '- Zawodnik nie wysłał jeszcze dzisiejszego raportu porannego.'}

      === AKTUALNY TRENING NA DZIŚ (${dzis}) ===
      ${todayWorkout ? `
      - Typ aktywności: ${todayWorkout.rodzaj}
      - Dystans: ${todayWorkout.dystans} km
      - Czas: ${todayWorkout.czas_minuty} min
      - Średnie tętno: ${todayWorkout.tetno_srednie} bpm
      - Średnia kadencja: ${todayWorkout.kadencja_srednia} RPM
      - ANALIZA DZISIEJSZEGO TRENINGU, KTÓRĄ MU WYGENEROWAŁEŚ (Użyj tej wiedzy!):
        "${todayWorkout.ai_analiza}"
      ` : '- Brak zarejestrowanego treningu na dziś w systemie.'}

      === STYL ROZMOWY ===
      - Odpowiadaj z pasją, merytorycznie, motywująco, stosując wiedzę dr. San-Millána o mitochondrialnym zdrowiu i żywieniu.
      - Używaj kolarskich/sportowych emotikonów odpowiednich do profilu zawodnika.
      - Jeśli zawodnik pyta o odżywianie, dietę, samopoczucie lub taktykę na dzisiejszy dzień, OPRZYJ SIĘ na powyższych danych biologicznych i treningowych z dzisiaj! Zachowaj pełną ciągłość wiedzy.
    `;

    const contents = last10Messages.map((msg, index) => {
      const isLast = index === last10Messages.length - 1;
      const parts: any[] = [{ text: msg.tresc }];
      
      if (isLast && msg.rola === 'user' && msg.obrazek_base64) {
        const mimeType = msg.obrazek_base64.split(';')[0].split(':')[1];
        const base64Data = msg.obrazek_base64.split(',')[1];
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }

      return {
        role: msg.rola === 'user' ? 'user' : 'model',
        parts
      };
    });

    let aiResponseText = "";
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: dynamicChatInstruction }] },
            contents
          })
        }
      );

      if (response.ok) {
        const resData = await response.json() as any;
        aiResponseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const errText = await response.text();
        console.error("Błąd czatu Gemini:", errText);
        aiResponseText = "Przepraszam, mam chwilowy problem z połączeniem z moją bazą wiedzy.";
      }
    } else {
      aiResponseText = "Brak skonfigurowanego klucza API dla trenera AI.";
    }

    // Zapisujemy odpowiedź trenera w bazie z user_id
    const { error: insertModelError } = await supabase
      .from('czat_wiadomosci')
      .insert([{
        user_id: user.id,
        rola: 'model',
        tresc: aiResponseText
      }]);

    if (insertModelError) {
      console.error("Błąd zapisu odpowiedzi trenera:", insertModelError);
    }

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error("Wyjątek czatu Gemini:", err);
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd komunikacji." };
  }
}

// ==========================================
// V. ANALIZA AKTYWNOŚCI I METRYK (STRAVA & BACKWARD)
// ==========================================

export async function sendWorkoutToAI(trainingId: number): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Brak autoryzacji" };

  // Pobieramy parametry tego konkretnego treningu
  const { data: workout, error: workoutError } = await supabase
    .from('treningi')
    .select('*')
    .eq('id', trainingId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (workoutError || !workout) {
    console.error("Nie znaleziono treningu:", workoutError);
    return { success: false, error: "Nie znaleziono treningu w bazie." };
  }

  // Pobieramy profil zawodnika do spersonalizowania analizy AI
  const { data: profile } = await supabase
    .from('profile')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const imie = profile?.imie || 'zawodnik';
  const wiek = profile?.wiek || '';
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
  const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };
  const kadencja = profile?.strefy_tetna?.kadencja_target || 90;
  const filozofia = profile?.filozofia_treningowa || 'Mitochondrialna baza (Zone 2)';

  let aiAnaliza = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Przeanalizuj dzisiejszy trening (${workout.rodzaj}) zawodnika o imieniu ${imie}:
      Dystans: ${workout.dystans ? `${workout.dystans} km` : 'brak'}
      Czas trwania: ${workout.czas_minuty} minut
      Tętno średnie: ${workout.tetno_srednie ? `${workout.tetno_srednie} bpm` : 'brak'}
      Tętno maksymalne: ${workout.tetno_max ? `${workout.tetno_max} bpm` : 'brak'}
      Kadencja średnia: ${workout.kadencja_srednia ? `${workout.kadencja_srednia} RPM` : 'brak'}
      
      Przygotuj profesjonalną, pełną pasji, kolarskich/biegowych emotikonów odprawę po-treningową od Trenera z Wozu Technicznego. Oceń czy tętno średnie mieściło się w zalecanej Strefie 2 (${zone2.min}-${zone2.max} bpm) i czy kadencja była prawidłowa. Daj wskazówki na regenerację!`;

      const dynamicSystemInstruction = `
        Jesteś wybitnym Osobistym Trenerem i ekspertem metabolicznym. Twój podopieczny to ${imie}, wiek: ${wiek} lat, główny sport: ${glownaDyscyplina}.
        Jego strefy tętna Zone 2 to: ${zone2.min}-${zone2.max} bpm.
        Filozofia treningowa: ${filozofia}.
        Oceń ten trening merytorycznie, sportowo, z humorem, ale i rygorem naukowym.
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          })
        }
      );

      if (response.ok) {
        const resData = await response.json() as any;
        aiAnaliza = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const errText = await response.text();
        console.error("Błąd API Gemini podczas analizy treningu:", errText);
        return { success: false, error: "AI odmówiło wygenerowania raportu." };
      }
    } else {
      return { success: false, error: "Brak skonfigurowanego klucza API Gemini na serwerze." };
    }
  } catch (err: any) {
    console.error("Błąd analizy treningowej Gemini:", err);
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd Gemini." };
  }

  if (!aiAnaliza) {
    return { success: false, error: "AI zwróciło pustą analizę treningu." };
  }

  // Zapisujemy analizę i oznaczamy trening jako wysłany (wyslano = true) TYLKO gdy generowanie się powiodło!
  const { error: updateError } = await supabase
    .from('treningi')
    .update({
      ai_analiza: aiAnaliza,
      wyslano: true
    })
    .eq('id', trainingId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error("Błąd zapisu analizy w bazie danych:", updateError);
    return { success: false, error: "Nie udało się zapisać wygenerowanej analizy w bazie." };
  }

  revalidatePath('/');
  return { success: true };
}

export async function syncStravaWorkoutsAction(): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Brak autoryzacji" };
  }

  try {
    const { data: profile } = await supabase
      .from('profile')
      .select('strava_refresh_token')
      .eq('id', user.id)
      .maybeSingle();

    const refreshToken = profile?.strava_refresh_token || process.env.STRAVA_REFRESH_TOKEN;
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
      return { success: false, error: "Brak skonfigurowanych kluczy Strava OAuth." };
    }

    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!tokenResponse.ok) {
      return { success: false, error: "Błąd autoryzacji Strava." };
    }

    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;

    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!activitiesResponse.ok) {
      return { success: false, error: "Błąd pobierania aktywności Strava." };
    }

    const activities = await activitiesResponse.json() as any[];

    const { data: existingWorkouts } = await supabase
      .from('treningi')
      .select('strava_id')
      .eq('user_id', user.id);

    const existingIds = new Set(existingWorkouts?.map(t => Number(t.strava_id)) || []);

    const newWorkouts = activities
      .filter(act => !existingIds.has(act.id))
      .map(act => {
        let rodzaj = 'Bieg';
        if (act.type === 'Ride' || act.type === 'VirtualRide') rodzaj = 'Rower';
        if (act.type === 'Swim') rodzaj = 'Pływanie';
        if (act.type === 'WeightTraining' || act.type === 'Workout') rodzaj = 'Siłownia';

        return {
          user_id: user.id,
          data: act.start_date_local.split('T')[0],
          rodzaj,
          dystans: act.distance ? Number((act.distance / 1000).toFixed(2)) : null,
          czas_minuty: Math.round(act.moving_time / 60),
          tetno_srednie: act.has_heartrate ? Math.round(act.average_heartrate) : null,
          tetno_max: act.has_heartrate ? Math.round(act.max_heartrate) : null,
          kadencja_srednia: act.average_cadence ? Math.round(act.average_cadence) : null,
          strava_id: act.id,
          wyslano: false
        };
      });

    let importedCount = 0;
    if (newWorkouts.length > 0) {
      const { error: insertError } = await supabase
        .from('treningi')
        .insert(newWorkouts);

      if (insertError) {
        console.error("Błąd zapisu nowych treningów ze Stravy:", insertError);
        return { success: false, error: "Błąd zapisu nowych treningów w bazie danych." };
      }
      importedCount = newWorkouts.length;
    }

    revalidatePath('/');
    return { success: true, importedCount };
  } catch (err: any) {
    console.error("Wyjątek podczas synchronizacji Stravy:", err);
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd połączenia." };
  }
}

export async function analyzeTrainingAction(id: number): Promise<string> {
  return "Analiza wykonana pomyślnie.";
}