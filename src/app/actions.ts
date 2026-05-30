'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { supabase } from '@/lib/supabase';


// ==========================================
// TYPY I PROMPTY SYSTEMOWE
// ==========================================

export interface Message {
  id?: number;
  rola: 'user' | 'model';
  tresc: string;
  obrazek_base64?: string;
  created_at?: string;
}

const SYSTEM_INSTRUCTION = `
Hubert to 55-letni kolarz Masters, który przeszedł redukcję z 82 kg do wyścigowych 74 kg (strefa buforowa 74-77 kg). Trenuje na Giant Revolt Adv 3. Jego fizjologiczna Strefa 2 (tlenowa) to tętno 105-115 bpm przy wysokiej kadencji 90+ RPM. Wychodzi z bezsenności (sen ponad 6h, protokół wieczorny: magnez + melatonina + miód).

Filozofia Treningowa (Iñigo San-Millán): Twoje plany i odprawy muszą być oparte na naukowej i metabolicznej koncepcji dr. Iñigo San-Millána (trenera Tadeja Pogačara). Główne założenia:
1. Maksymalizacja zdrowia mitochondrialnego, elastyczności metabolicznej oraz utylizacji mleczanu.
2. Fundamentem treningu jest Strefa 2 (105-115 bpm dla Huberta) jako strefa maksymalnej oksydacji tłuszczów (FatMax) i budowy bazy mitochondrialnej.
3. Kiedy poranne HRV, sen i regeneracja są wysokie, wprowadzaj celowane, krótkie sesje VO2 Max (Strefa 5) i interwały progowe, aby podnosić sufit tlenowy i stymulować rzut serca.
4. Unikaj przewlekłego "No Man's Land" (nieustannego, bezcelowego jeżdżenia w Strefie 3 bez konkretnych założeń interwałowych), aby nie przeciążać Huberta metabolicznie.
5. Zlecenie treningowe musi być precyzyjnie rozpisane bezpośrednio na podstawie minut zadeklarowanych w formularzu.

Styl Analiz: Generuj, szczegółowe, pełne pasji, humoru i kolarskich emotikonów odprawy jako „Dyrektor Sportowy / Wóz Techniczny”. Zachowuj się jak zaangażowany, lekko wymagający trener, który potrafi połączyć duszę romantycznego kolarstwa z twardą, komórkową nauką metaboliczną San-Millána (odnoś się czasem do mitochondriów, utylizacji mleczanu, oszczędzania glikogenu i FatMax).

Hubert przyjmuje: K2 MK-7 100 ΜG Z NATTO + D3, OMEGA 3-6-9 STRONG, KOLAGEN + MCT + WIT. C

Dieta i Multimedia: Jeśli użytkownik prześle zdjęcie (np. menu z restauracji, posiłek lub cokolwiek innego), dokładnie je przeanalizuj, odnieś się do diety kolarza Masters i wskaż najlepsze opcje żywieniowe dla Huberta, pamiętając o roli węglowodanów w dniach VO2 Max i kwasów tłuszczowych w dniach bazy tlenowej.
`;

// ==========================================
// SEKCJA 1: RAPORTY PORANNE & STATYSTYKI (DLA PAGE.TSX)
// ==========================================

// Pobiera raport poranny na dzisiejszy dzień
// Pobiera raport poranny na dzisiejszy dzień
export async function getTodayMorningReport(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("=== [STRONA GŁÓWNA] AKTUALNIE ZALOGOWANY EMAIL ===", user?.email);

  // Jeśli użytkownik nie jest zalogowany, zwracamy brak raportu
  if (authError || !user) {
    return null;
  }

  const dzis = new Date().toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-');

  // Pobieramy raport na dziś, ale TYLKO dla zalogowanego użytkownika (user_id)
  const { data, error } = await supabase
    .from('poranki')
    .select('*')
    .eq('data', dzis)
    .eq('user_id', user.id)
    .maybeSingle(); // Używamy .maybeSingle() zamiast .single(), aby uniknąć błędów w konsoli, gdy raportu jeszcze nie ma

  if (error) {
    console.error("Błąd getTodayMorningReport:", error);
    return null;
  }
  return data;
}

// Zapisuje raport poranny przychodzący z formularza HTML (FormData) i generuje analizę
// Zaktualizowana, w pełni zgodna z React Form Action wersja saveMorningReport w src/app/actions.ts

// Zapisuje raport poranny przychodzący z formularza HTML (FormData) i generuje analizę
export async function saveMorningReport(formData: FormData): Promise<void> {
  console.log("=== [DIAGNOSTYKA] OTRZYMANO FORMULARZ PORANNY ===");
  
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log("-> [BŁĄD] Brak zalogowanego użytkownika.");
    throw new Error("Brak autoryzacji do wykonania tej akcji.");
  }
  console.log("-> Zalogowany użytkownik ID:", user.id);

  const dzis = new Date().toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-');
  console.log("-> Wyliczona dzisiejsza data polska:", dzis);

  // Sprawdzamy czy raport istnieje
  console.log("-> Sprawdzam, czy istnieje już raport na dziś dla tego ID...");
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
  console.log("-> Brak istniejącego raportu. Przechodzę dalej.");

  // Dane biologiczne
  const waga = parseFloat(formData.get('waga') as string) || 0;
  const hrv = parseInt(formData.get('hrv') as string, 10) || 0;
  const body_battery = parseInt(formData.get('body_battery') as string, 10) || 0;
  const jakosc_snu = parseInt(formData.get('jakosc_snu') as string, 10) || 0;
  const czas_na_trening = parseInt(formData.get('czas_na_trening') as string, 10) || 0;
  const notatki = (formData.get('notatki') as string) || '';
  console.log(`-> Wyciągnięte dane: waga=${waga}, hrv=${hrv}, BB=${body_battery}, sen=${jakosc_snu}, trening=${czas_na_trening}`);

  // Pobieranie profilu
  console.log("-> Pobieram profil użytkownika...");
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
  
  // Nowe dynamiczne parametry profilu
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
  const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
  const poziom = profile?.poziom_zaawansowania || 'Początkujący';
  const oczekiwania = profile?.oczekiwania_od_trenera || 'Spokojne i wspierające doradztwo';
  const celeSportowe = profile?.cele_sportowe || 'Zdrowie i sprawność';

  console.log(`-> Wybrana dyscyplina: ${glownaDyscyplina}, Cel wagowy: ${celWagowy}, Oczekiwania: ${oczekiwania}`);

  let aiAnaliza = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("-> Klucz Gemini:", apiKey ? "ZNAJDZIONY (OBECNY)" : "BRAK KLUCZA W .ENV");
    
    if (apiKey) {
      console.log("-> Łączę się z Gemini API...");
      
      const prompt = `Przeanalizuj dzisiejszy poranek zawodnika o imieniu ${imie}:
      Waga: ${waga} kg
      HRV: ${hrv} ms
      Body Battery: ${body_battery}
      Jakość snu: ${jakosc_snu}/100
      Czas na trening dzisiaj: ${czas_na_trening} minut
      Notatki użytkownika: ${notatki || 'brak'}`;

      // --- DYNAMICZNY GENERATOR OSOBOWOŚCI TRENERA (PERSONAS) ---
      let dynamicSystemInstruction = "";

      if (glownaDyscyplina === 'Rower') {
        dynamicSystemInstruction = `
          Jesteś wybitnym Trenerem Kolarskim, Dyrektorem Sportowym z Wozu Technicznego oraz ekspertem w dziedzinie fizjologii sportu dr. Iñigo San-Millána.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          Poziom zaawansowania: ${poziom}.
          Cel wagowy: ${celWagowy}.
          Cele sportowe zawodnika: ${celeSportowe}.
          Twoje oczekiwane podejście: ${oczekiwania}.

          Kluczowe zalecenia kolarskie:
          - Fundamentem jest Strefa 2 (Zone 2) tętna, która dla tego zawodnika wynosi: ${zone2.min}-${zone2.max} bpm.
          - Docelowa kadencja kolarska: ${kadencja}+ RPM.
          - Unikaj Strefy 3 (No Man's Land) – ma jeździć albo bardzo lekko w Zone 2, albo robić ostre interwały Zone 5 (jeśli HRV i sen są wysokie).
          - Komunikuj się z pasją, kolarskim humorem, używaj dużo emotikonów (🚴‍♂️, 📻, 🚀, 🥞), stylizuj wypowiedź na odprawę przez radio z wozu technicznego.
        `;
      } 
      else if (glownaDyscyplina === 'Bieg') {
        dynamicSystemInstruction = `
          Jesteś profesjonalnym Trenerem Biegowym, fizjoterapeutą sportowym oraz ekspertem ds. biomechaniki biegu i treningu maratońskiego.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          Poziom zaawansowania: ${poziom}.
          Cel wagowy: ${celWagowy}.
          Cele sportowe zawodnika: ${celeSportowe}.
          Twoje oczekiwane podejście: ${oczekiwania}.

          Kluczowe zalecenia biegowe:
          - Unikaj przeciążeń stawów kolanowych i skokowych. Kładź nacisk na prawidłową technikę, kadencję biegową (ok. 170-180 kroków/min) i stabilizację.
          - Strefa regeneracyjna tętna w biegu dla niego to: ${zone2.min}-${zone2.max} bpm (bieg konwersacyjny, zapobiegający zakwaszeniu).
          - Podpowiadaj odpowiednią rozgrzewkę i rolowanie po biegu.
          - Komunikuj się z pasją, motywująco, ale z dużą uwagą na kwestie fizjoterapeutyczne, stawy i mądre rozkładanie sił. Używaj biegowych emotikonów (🏃‍♂️, 👟, ⏱️, 🍌).
        `;
      } 
      else if (glownaDyscyplina === 'Marsz/Spacer' || glownaDyscyplina === 'Senior') {
        dynamicSystemInstruction = `
          Jesteś ciepłym, opiekuńczym Mentorem Zdrowotnym, ekspertem ds. medycyny długowieczności (longevity) oraz sprawności funkcjonalnej seniorów.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          Poziom zaawansowania: Rekreacja i zdrowie.
          Cel wagowy: ${celWagowy}.
          Cele sportowe: ${celeSportowe}.
          Twoje podejście: Bardzo wspierające, cierpliwe, pełne empatii i ciepła (żadnej presji na wyniki!).

          Kluczowe zalecenia geriatryczne i ruchowe:
          - Główną formą aktywności są spacery, marsze rekreacyjne (power walking) oraz ćwiczenia oddechowe i równoważne.
          - Tętno podczas marszu powinno być bardzo bezpieczne, łagodne dla serca (zalecany przedział: 90-105 bpm).
          - Kładź nacisk na świeże powietrze, naturalne światło o poranku (rytmu dobowy), dbanie o stabilność stawów biodrowych i kolanowych oraz zapobieganie upadkom.
          - Doradzaj łagodne rozciąganie po spacerze.
          - Komunikuj się niezwykle uprzejmie, ciepło, używaj wspierających i pełnych szacunku emotikonów (🌳, 🚶‍♂️, ☀️, 🍵, 🌸). Chwal za każdy najmniejszy spacer i dbanie o zdrowie.
        `;
      } 
      else {
        // Domyślny trener ogólnorozwojowy
        dynamicSystemInstruction = `
          Jesteś wszechstronnym Trenerem Personalnym i doradcą zdrowotnym.
          Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          Główna dyscyplina: ${glownaDyscyplina}.
          Cel wagowy: ${celWagowy}.
          Cele sportowe: ${celeSportowe}.
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

      console.log("-> Status odpowiedzi Gemini:", response.status);
      if (response.ok) {
        const resData = await response.json() as any;
        aiAnaliza = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log("-> Pomyślnie wygenerowano odprawę AI (długość:", aiAnaliza.length, "znaków)");
      } else {
        const errText = await response.text();
        console.log("-> [BŁĄD] Gemini API zwróciło błąd:", errText);
      }
    }
  } catch (err: any) {
    console.error("-> [WYJĄTEK] Podczas kontaktu z Gemini:", err.message);
  }

  // Zapisujemy poranek w bazie danych, dodając kluczowe pole "user_id"
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
    console.log("-> [BŁĄD KRYTYCZNY] Zapis w Supabase nie powiódł się!");
    console.log("-> Komunikat błędu:", insertError.message);
    console.log("-> Pełny obiekt błędu:", insertError);
    console.log("=== [DIAGNOSTYKA] KONIEC PROCESU ===");
    return;
  }

  console.log("-> [SUKCES] Dane zapisane pomyślnie. Revaliduję ścieżkę główną...");
  revalidatePath('/');
  console.log("=== [DIAGNOSTYKA] KONIEC PROCESU ===");
}

// Pobiera średnie i zagregowane statystyki do wyświetlenia na pulpicie (w angielskim nazewnictwie camelCase)
export async function getDashboardStats(): Promise<any> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Jeśli użytkownik nie jest zalogowany, zwracamy zerowe statystyki
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

  // 1. Pobieramy poranki z ostatnich 7 dni dla zalogowanego użytkownika
  const siedemDniTemu = new Date();
  siedemDniTemu.setDate(siedemDniTemu.getDate() - 7);
  const data7 = siedemDniTemu.toISOString().split('T')[0];

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

  // 2. Pobieramy treningi z ostatnich 30 dni dla zalogowanego użytkownika
  const trzydziesciDniTemu = new Date();
  trzydziesciDniTemu.setDate(trzydziesciDniTemu.getDate() - 30);
  const data30 = trzydziesciDniTemu.toISOString().split('T')[0];

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

  const dzis = new Date().toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-');

  // Pobieramy najnowszą analizę poranka z dni POPRZEDNICH (data < dzis)
  const { data: morningData } = await supabase
    .from('poranki')
    .select('ai_analiza')
    .eq('user_id', user.id)
    .lt('data', dzis) // strictly less than today
    .not('ai_analiza', 'is', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Pobieramy najnowszą analizę treningu z dni POPRZEDNICH (data < dzis)
  const { data: workoutData } = await supabase
    .from('treningi')
    .select('ai_analiza')
    .eq('user_id', user.id)
    .lt('data', dzis) // strictly less than today
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

// Analizuje niewysłany trening za pomocą Gemini, zapisuje analizę i oznacza jako wysłany
export async function sendWorkoutToAI(trainingId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: training, error: fetchError } = await supabase
      .from('treningi')
      .select('*')
      .eq('id', trainingId)
      .single();

    if (fetchError || !training) {
      throw new Error("Nie znaleziono wybranego treningu do analizy.");
    }

    const tr = training as any;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Brak klucza API Gemini (GEMINI_API_KEY) w środowisku.");
    }

    const prompt = `Przeanalizuj dzisiejszy trening Huberta:
    Rodzaj: ${tr.rodzaj}
    Dystans: ${tr.dystans ? tr.dystans + ' km' : 'nie dotyczy'}
    Czas trwania: ${tr.czas_minuty} minut
    Średnie tętno: ${tr.tetno_srednie ? tr.tetno_srednie + ' bpm' : 'brak danych'}
    Maksymalne tętno: ${tr.tetno_max ? tr.tetno_max + ' bpm' : 'brak danych'}
    Średnia kadencja: ${tr.kadencja_srednia ? tr.kadencja_srednia + ' RPM' : 'brak danych'}
    
    Oceń ten trening z pasją, wiedzą szkoleniową i kolarskim humorem jako „Dyrektor Sportowy / Wóz Techniczny”. Odnieś średnie tętno do strefy 2 Huberta (105-115 bpm) oraz zwróć uwagę na kadencję (wysoka 90+ RPM).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Błąd API Gemini: ${response.status} - ${errText}`);
    }

    const resData = await response.json() as any;
    const aiAnaliza = resData.candidates?.[0]?.content?.parts?.[0]?.text || "Brak analizy.";

    const { error: updateError } = await supabase
      .from('treningi')
      .update({
        ai_analiza: aiAnaliza,
        wyslano: true
      })
      .eq('id', trainingId);

    if (updateError) {
      throw updateError;
    }

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error("Błąd sendWorkoutToAI:", err);
    return { success: false, error: err.message || "Wystąpił błąd podczas analizy treningu." };
  }
}

// Alias wsteczny dla starego komponentu TrainingCard.tsx
export async function analyzeTrainingAction(trainingId: any): Promise<string> {
  return "Kompilacja zachowana";
}

// ==========================================
// SEKCJA 3: SYNCHRONIZACJA ZE STRAVA (PULL)
// ==========================================

async function getStravaAccessToken(): Promise<string> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Brak zmiennych środowiskowych dla Stravy w systemie.");
  }

  const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Błąd odświeżania tokenu Strava: ${errText}`);
  }

  const data = await response.json() as any;
  return data.access_token;
}

export async function syncStravaWorkoutsAction(): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  try {
    const accessToken = await getStravaAccessToken();

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Błąd pobierania aktywności: ${response.statusText}`);
    }

    const stravaActivities = await response.json();
    if (!Array.isArray(stravaActivities) || stravaActivities.length === 0) {
      return { success: true, importedCount: 0 };
    }

    const { data: existingWorkouts, error: fetchError } = await supabase
      .from("treningi")
      .select("strava_id")
      .not("strava_id", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    const existingIds = new Set(existingWorkouts?.map((w: any) => Number(w.strava_id)) || []);

    const newActivities = stravaActivities.filter((act: any) => !existingIds.has(Number(act.id)));

    if (newActivities.length === 0) {
      return { success: true, importedCount: 0 };
    }

    const mappedTreningi = newActivities.map((act: any) => {
      let rodzaj = "Rower";
      const typeStr = act.sport_type || act.type || "";
      if (typeStr === "Run") rodzaj = "Bieg";
      else if (typeStr === "Swim") rodzaj = "Pływanie";
      else if (typeStr === "WeightTraining") rodzaj = "Siłownia";

      const dystansKm = act.distance ? parseFloat((act.distance / 1000).toFixed(2)) : 0;
      const czasMinuty = act.moving_time ? Math.round(act.moving_time / 60) : 0;

      const dataTreningu = act.start_date_local
  ? act.start_date_local.substring(0, 10)
  : new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).split('.').reverse().join('-');
      return {
        strava_id: act.id,
        data: dataTreningu,
        rodzaj: rodzaj,
        dystans: dystansKm > 0 ? dystansKm : null,
        czas_minuty: czasMinuty > 0 ? czasMinuty : null,
        tetno_srednie: act.has_heartrate && act.average_heartrate ? Math.round(act.average_heartrate) : null,
        tetno_max: act.has_heartrate && act.max_heartrate ? Math.round(act.max_heartrate) : null,
        kadencja_srednia: act.average_cadence ? Math.round(act.average_cadence) : null,
        wyslano: false
      };
    });

    const { error: insertError } = await supabase
      .from("treningi")
      .insert(mappedTreningi);

    if (insertError) {
      throw insertError;
    }

    revalidatePath("/");
    return { success: true, importedCount: mappedTreningi.length };
  } catch (err: any) {
    console.error("Błąd synchronizacji Stravy:", err);
    return { success: false, error: err.message || "Nie udało się zsynchronizować danych." };
  }
}

// ==========================================
// SEKCJA 4: CZAT INTERAKTYWNY (TEKST + ZDJĘCIA)
// ==========================================

export async function getChatHistory(): Promise<Message[]> {
  const { data, error } = await supabase
    .from('czat_wiadomosci')
    .select('id, rola, tresc, obrazek_base64, created_at')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error("Błąd pobierania historii czatu:", error);
    return [];
  }

  return (data || []) as Message[];
}

export async function sendChatMessage(
  content: string, 
  imageBase64?: string
): Promise<{ success: boolean; error?: string }> {
  if (!content.trim() && !imageBase64) {
    return { success: false, error: "Wiadomość nie może być pusta" };
  }

  const { error: insertUserError } = await supabase
    .from('czat_wiadomosci')
    .insert([{ 
      rola: 'user', 
      tresc: content, 
      obrazek_base64: imageBase64 || null 
    }]);

  if (insertUserError) {
    console.error("Błąd zapisu wiadomości użytkownika:", insertUserError);
    return { success: false, error: "Nie udało się zapisać Twojej wiadomości." };
  }

  try {
    const history = await getChatHistory();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Brak klucza API Gemini (GEMINI_API_KEY) w środowisku.");
    }

    const contents = history.map((msg: Message, index: number) => {
      const parts: any[] = [{ text: msg.tresc }];
      const img = msg.obrazek_base64;

      if (msg.rola === 'user' && img && index === history.length - 1) {
        const matches = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const rawBase64 = matches[2];

          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: rawBase64
            }
          });
        }
      }

      return {
        role: msg.rola,
        parts: parts
      };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          contents: contents
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Błąd API Gemini: ${response.status} - ${errText}`);
    }

    const responseData = await response.json() as any;
    const botText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || "Brak odpowiedzi od trenera.";

    const { error: insertBotError } = await supabase
      .from('czat_wiadomosci')
      .insert([{ rola: 'model', tresc: botText }]);

    if (insertBotError) {
      console.error("Błąd zapisu odpowiedzi trenera:", insertBotError);
    }

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error("Błąd podczas przetwarzania czatu:", err);
    return { success: false, error: err.message || "Wystąpił nieoczekiwany błąd." };
  }
}

export async function clearChatHistory(): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('czat_wiadomosci')
    .delete()
    .neq('id', 0);

  if (error) {
    console.error("Błąd czyszczenia czatu:", error);
    return { success: false };
  }

  revalidatePath('/');
  return { success: true };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  // Czyścimy cache strony głównej i odsyłamy do ekranu logowania
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getTodayWorkout(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const dzis = new Date().toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-');

  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .eq('data', dzis)
    .eq('wyslano', true)
    .not('ai_analiza', 'is', null)
    .maybeSingle();

  if (error) {
    console.error("Błąd getTodayWorkout:", error);
    return null;
  }

  return data;
}