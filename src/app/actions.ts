'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

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
  const dzis = new Date().toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-');

  const { data, error } = await supabase
    .from('poranki')
    .select('*')
    .eq('data', dzis)
    .maybeSingle();

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
  const dzis = new Date().toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('.').reverse().join('-');

  // Sprawdzamy czy raport na dziś już istnieje
  const { data: existing } = await supabase
    .from('poranki')
    .select('id')
    .eq('data', dzis)
    .single();

  if (existing) {
    console.warn("Raport na dziś został już wysłany.");
    return;
  }

  // Bezpieczne wyciąganie wartości z obiektu FormData
  const waga = parseFloat(formData.get('waga') as string) || 0;
  const hrv = parseInt(formData.get('hrv') as string, 10) || 0;
  const body_battery = parseInt(formData.get('body_battery') as string, 10) || 0;
  const jakosc_snu = parseInt(formData.get('jakosc_snu') as string, 10) || 0;
  const czas_na_trening = parseInt(formData.get('czas_na_trening') as string, 10) || 0;
  const notatki = (formData.get('notatki') as string) || '';

  let aiAnaliza = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Przeanalizuj dzisiejszy poranek Huberta:
      Waga: ${waga} kg
      HRV: ${hrv} ms
      Body Battery: ${body_battery}
      Jakość snu: ${jakosc_snu}/100
      Czas na trening dzisiaj: ${czas_na_trening} minut
      Notatki Huberta: ${notatki || 'brak'}
      
      Przygotuj długą, pełną pasji i kolarskich emotikonów odprawę od Trenera z Wozu Technicznego, w tym zarys menu (diety) oraz precyzyjne zlecenie treningowe na dzisiejsze ${czas_na_trening} minut.`;

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

      if (response.ok) {
        const resData = await response.json() as any;
        aiAnaliza = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }
  } catch (err) {
    console.error("Błąd generowania analizy porannej przez Gemini:", err);
  }

  const { error } = await supabase
    .from('poranki')
    .insert([{
      data: dzis,
      waga,
      hrv,
      body_battery,
      jakosc_snu,
      czas_na_trening,
      notatki: notatki || null,
      ai_analiza: aiAnaliza || null
    }]);

  if (error) {
    console.error("Błąd zapisu poranka:", error);
    return;
  }

  revalidatePath('/');
}

// Pobiera średnie i zagregowane statystyki do wyświetlenia na pulpicie (w angielskim nazewnictwie camelCase)
export async function getDashboardStats(): Promise<{
  avgWeight: number;
  avgHrv: number;
  avgSleep: number;
  totalWorkouts: number;
  totalKm: number;
  avgHr: number;
  avgCadence: number;
  // Fallback po polsku w razie potrzeby
  srednia_waga: number;
  sredni_hrv: number;
  srednia_jakosc_snu: number;
  suma_dystans: number;
  suma_czas_minuty: number;
}> {
  const { data: poranki, error: pError } = await supabase
    .from('poranki')
    .select('waga, hrv, body_battery, jakosc_snu')
    .order('data', { ascending: false })
    .limit(7);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const { data: treningi, error: tError } = await supabase
    .from('treningi')
    .select('dystans, czas_minuty, tetno_srednie, kadencja_srednia')
    .gte('data', thirtyDaysAgo);

  if (pError || tError) {
    console.error("Błąd getDashboardStats:", pError || tError);
    return {
      avgWeight: 0,
      avgHrv: 0,
      avgSleep: 0,
      totalWorkouts: 0,
      totalKm: 0,
      avgHr: 0,
      avgCadence: 0,
      srednia_waga: 0,
      sredni_hrv: 0,
      srednia_jakosc_snu: 0,
      suma_dystans: 0,
      suma_czas_minuty: 0,
    };
  }

  // Średnie z poranków
  const avgWeight = poranki && poranki.length > 0
    ? poranki.reduce((acc: number, p: any) => acc + Number(p.waga || 0), 0) / poranki.length
    : 0;

  const avgHrv = poranki && poranki.length > 0
    ? poranki.reduce((acc: number, p: any) => acc + Number(p.hrv || 0), 0) / poranki.length
    : 0;

  const avgSleep = poranki && poranki.length > 0
    ? poranki.reduce((acc: number, p: any) => acc + Number(p.jakosc_snu || 0), 0) / poranki.length
    : 0;

  // Statystyki treningowe (ostatnie 30 dni)
  const totalWorkouts = treningi ? treningi.length : 0;

  const totalKm = treningi
    ? treningi.reduce((acc: number, t: any) => acc + Number(t.dystans || 0), 0)
    : 0;

  const workoutsWithHr = treningi ? treningi.filter((t: any) => t.tetno_srednie) : [];
  const avgHr = workoutsWithHr.length > 0
    ? workoutsWithHr.reduce((acc: number, t: any) => acc + Number(t.tetno_srednie), 0) / workoutsWithHr.length
    : 0;

  const workoutsWithCadence = treningi ? treningi.filter((t: any) => t.kadencja_srednia) : [];
  const avgCadence = workoutsWithCadence.length > 0
    ? workoutsWithCadence.reduce((acc: number, t: any) => acc + Number(t.kadencja_srednia), 0) / workoutsWithCadence.length
    : 0;

  return {
    // Angielskie klucze (oczekiwane przez błędy w page.tsx)
    avgWeight: parseFloat(avgWeight.toFixed(1)),
    avgHrv: Math.round(avgHrv),
    avgSleep: Math.round(avgSleep),
    totalWorkouts,
    totalKm: parseFloat(totalKm.toFixed(1)),
    avgHr: Math.round(avgHr),
    avgCadence: Math.round(avgCadence),

    // Polskie klucze (zgodność wsteczna)
    srednia_waga: parseFloat(avgWeight.toFixed(1)),
    sredni_hrv: Math.round(avgHrv),
    srednia_jakosc_snu: Math.round(avgSleep),
    suma_dystans: parseFloat(totalKm.toFixed(1)),
    suma_czas_minuty: treningi ? treningi.reduce((acc: number, t: any) => acc + Number(t.czas_minuty || 0), 0) : 0
  };
}

// Pobiera ostatnią analizę poranka i ostatnią analizę treningu jako jeden obiekt z dwoma polami
export async function getLatestAnalyses(): Promise<{
  morningAnalysis: string | null;
  workoutAnalysis: string | null;
}> {
  const { data: poranek } = await supabase
    .from('poranki')
    .select('ai_analiza')
    .not('ai_analiza', 'is', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: trening } = await supabase
    .from('treningi')
    .select('ai_analiza')
    .not('ai_analiza', 'is', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    morningAnalysis: poranek?.ai_analiza || null,
    workoutAnalysis: trening?.ai_analiza || null
  };
}

// ==========================================
// SEKCJA 2: TRENINGI ZE STRAVY & ANALIZA AI (DLA PAGE.TSX)
// ==========================================

// Pobiera pojedynczy trening, który nie został jeszcze oceniony przez AI
export async function getUnsentWorkout(): Promise<any | null> {
  const { data, error } = await supabase
    .from('treningi')
    .select('*')
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