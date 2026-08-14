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

export interface OnboardingState {
  success?: boolean;
  error?: string | null;
}

// ==========================================
// FUNKCJE POMOCNICZE I ODPORNOŚĆ AI (SMART FALLBACK)
// ==========================================

function getWarsawDateString(): string {
  const warsawString = new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" });
  const warsawDate = new Date(warsawString);
  const yyyy = warsawDate.getFullYear();
  const mm = String(warsawDate.getMonth() + 1).padStart(2, '0');
  const dd = String(warsawDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Inteligentna funkcja odpytująca Gemini z automatycznym mechanizmem Fallback (przełączaniem na modele zapasowe przy 503 / przeciążeniu)
 */
async function callGeminiWithFallback(
  systemInstruction: string,
  promptText?: string,
  customContents?: any[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Brak skonfigurowanego klucza API Gemini na serwerze.");
  }

  // Lista modeli odpytywanych kolejno w przypadku błędu 503 (przeciążenie) lub 429
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro'
  ];

  const contents = customContents || [{ role: "user", parts: [{ text: promptText || "" }] }];
  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents
  };

  let lastErrorText = "";

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        const resData = await response.json() as any;
        const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text.trim() !== "") {
          return text; // Sukces! Zwracamy wygenerowany tekst
        }
      }

      const errBody = await response.text();
      lastErrorText = `[${model}] Status ${response.status}: ${errBody}`;
      console.warn(`[Gemini Fallback] Model ${model} niedostępny (${response.status}). Przełączam na model zapasowy...`);
      
      // Krótka pauza 300ms przed kolejną próbą
      await new Promise(r => setTimeout(r, 300));
    } catch (fetchErr: any) {
      lastErrorText = fetchErr?.message || "Błąd sieci";
    }
  }

  throw new Error(`Wszystkie modele AI są chwilowo zajęte. ${lastErrorText}`);
}

// ==========================================
// I. AUTORYZACJA I ZARZĄDZANIE PROFILEM (ONBOARDING / USTAWIENIA)
// ==========================================

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function saveOnboardingAction(
  prevState: any,
  formData: FormData
): Promise<OnboardingState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Brak autoryzacji." };
    }

    const imie = (formData.get('imie') as string) || 'Zawodnik';
    const wiek = parseInt(formData.get('wiek') as string, 10) || null;
    const glowna_dyscyplina = (formData.get('glowna_dyscyplina') as string) || 'Rower';
    const cel_wagowy = (formData.get('cel_wagowy') as string) || 'Utrzymanie wagi';
    const poziom_zaawansowania = (formData.get('poziom_zaawansowania') as string) || 'Początkujący';
    const cele_sportowe = (formData.get('cele_sportowe') as string) || 'Zdrowie i sprawność';
    const oczekiwania_od_trenera = (formData.get('oczekiwania_od_trenera') as string) || 'Wsparcie i motywacja';
    
    const zone2_min = parseInt(formData.get('zone2_min') as string, 10) || 105;
    const zone2_max = parseInt(formData.get('zone2_max') as string, 10) || 115;
    const kadencja_target = parseInt(formData.get('kadencja_target') as string, 10) || 90;

    const { error } = await supabase
      .from('profile')
      .upsert({
        id: user.id,
        imie,
        wiek,
        glowna_dyscyplina,
        cel_wagowy,
        poziom_zaawansowania,
        cele_sportowe,
        oczekiwania_od_trenera,
        strefy_tetna: {
          zone2: { min: zone2_min, max: zone2_max },
          kadencja_target: kadencja_target
        },
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("Błąd zapisu profilu (saveOnboardingAction):", error);
      return { success: false, error: error.message };
    }

    revalidatePath('/', 'layout');
    return { success: true, error: null };
  } catch (err: any) {
    console.error("Błąd saveOnboardingAction:", err);
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd zapisu." };
  }
}

export async function updateProfileAction(
  prevState: any,
  formData: FormData
): Promise<OnboardingState> {
  return saveOnboardingAction(prevState, formData);
}

// ==========================================
// II. POBIERANIE I ZAPISYWANIE DANYCH BIOLOGICZNYCH (DZIŚ)
// ==========================================

export async function getTodayMorningReport(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const dzis = getWarsawDateString();

  const { data, error } = await supabase
    .from('poranki')
    .select('*')
    .eq('data', dzis)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) console.error("Błąd getTodayMorningReport:", error);
  return data;
}

export async function saveMorningReport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Brak autoryzacji do wykonania tej akcji.");

  const dzis = getWarsawDateString();

  const { data: existing } = await supabase
    .from('poranki')
    .select('id')
    .eq('data', dzis)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return;

  const waga = parseFloat(formData.get('waga') as string) || 0;
  const hrv = parseInt(formData.get('hrv') as string, 10) || 0;
  const body_battery = parseInt(formData.get('body_battery') as string, 10) || 0;
  const jakosc_snu = parseInt(formData.get('jakosc_snu') as string, 10) || 0;
  const czas_na_trening = parseInt(formData.get('czas_na_trening') as string, 10) || 0;
  const notatki = (formData.get('notatki') as string) || '';
  
  const is_rest_day = formData.get('is_rest_day') === 'true';
  const workout_type = (formData.get('workout_type') as string) || 'Rower';
  const workout_time = (formData.get('workout_time') as string) || 'popoludnie';

  const { data: profile } = await supabase.from('profile').select('*').eq('id', user.id).single();

  const imie = profile?.imie || 'zawodnik';
  const wiek = profile?.wiek || '';
  const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };
  const kadencja = profile?.strefy_tetna?.kadencja_target || 90;
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
  const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
  const poziom = profile?.poziom_zaawansowania || 'Początkujący';
  const oczekiwania = profile?.oczekiwania_od_trenera || 'Spokojne i wspierające doradztwo';
  const celeSportowe = profile?.cele_sportowe || 'Zdrowie i sprawność';

  let aiAnaliza = "";
  try {
    const prompt = `Przeanalizuj dzisiejszy poranek zawodnika o imieniu ${imie}:
    Waga: ${waga} kg
    HRV: ${hrv} ms
    Body Battery: ${body_battery}
    Jakość snu: ${jakosc_snu}/100
    Dzień bez treningu (Rest Day): ${is_rest_day ? 'TAK' : 'NIE'}
    Planowany rodzaj treningu: ${is_rest_day ? 'brak' : workout_type}
    Planowana pora treningu: ${is_rest_day ? 'brak' : workout_time}
    Czas na aktywność dzisiaj: ${czas_na_trening} minut
    Notatki użytkownika: ${notatki || 'brak'}`;

    let persona = "";
    if (glownaDyscyplina === 'Rower') {
      persona = `Jesteś wybitnym Trenerem Kolarskim, Dyrektorem Sportowym z Wozu Technicznego oraz ekspertem fizjologii dr. Iñigo San-Millána. Styl: pasja, kolarski humor (🚴‍♂️, 📻, 🚀), tętno Zone 2: ${zone2.min}-${zone2.max} bpm, kadencja: ${kadencja}+ RPM.`;
    } else if (glownaDyscyplina === 'Bieg') {
      persona = `Jesteś profesjonalnym Trenerem Biegowym i biomechanikiem. Dbaj o technikę, kadencję ~170-180 i stawy. Strefa tętna: ${zone2.min}-${zone2.max} bpm. Emotikony: 🏃‍♂️, 👟, ⏱️.`;
    } else {
      persona = `Jesteś ciepłym Mentorem Zdrowotnym, ekspertem ds. longevity. Spacery, ćwiczenia równowagi, tętno 90-105 bpm. Emotikony: 🌳, 🚶‍♂️, ☀️.`;
    }

    const dynamicSystemInstruction = `
      ${persona}
      Twój podopieczny to ${imie}, wiek: ${wiek} lat.
      Poziom: ${poziom}. Cel wagowy: ${celWagowy}. Cele sportowe: ${celeSportowe}. Oczekiwania: ${oczekiwania}.

      === KATEGORYCZNE ZASADY GENEROWANIA RAPORTU ===

      1. TRENING NA DZIŚ:
      - Jeśli "Dzień bez treningu" = TAK: BEZWZGLĘDNIE ZABRANIAM generowania planu treningowego. Napisz tylko 1-2 zdania o regeneracji (np. spacer, rolowanie).
      - Jeśli "Planowany rodzaj treningu" = Siłownia: Wygeneruj domowy plan siłowy wykorzystujący TYLKO: ławeczkę, wolne ciężary i gumy oporowe.
      - Jeśli "Planowany rodzaj treningu" = Rower/Bieg: Wygeneruj plan na podany czas i intensywność.

      2. DIETA (CAŁY DZIEŃ I NUTRIENT TIMING):
      - ZAWSZE generuj pełne menu na CAŁY DZIEŃ z podziałem na posiłki.
      - Dostosuj posiłki i makroskładniki bezpośrednio do pory treningu:
        * Trening RANO: Śniadanie to lekkostrawne węglowodany przed wysiłkiem, obiad to potreningowa regeneracja (białko + węglowodany), kolacja lekka.
        * Trening POPOŁUDNIU: Śniadanie białkowo-tłuszczowe, obiad przedtreningowy lekki, kolacja to potężny posiłek regeneracyjny po treningu.
        * Trening WIECZOREM: Śniadanie i obiad zbilansowane, podwieczorek to węglowodany przed wyjściem, kolacja potreningowa nieobciążająca żołądka przed snem.
        * Rest Day: Zbilansowane posiłki niskowęglowodanowe, regeneracyjne.
      - Uwzględnij cel wagowy: ${celWagowy} (redukcja = mniejszy bilans, masa = większy bilans białkowo-węglowodanowy).

      === WYMAGANA STRUKTURA ODPOWIEDZI (Markdown) ===
      # 🎙️ Odprawa i analiza poranna
      # ${is_rest_day ? '🧘‍♂️ Regeneracja (Dzień bez treningu)' : (workout_type === 'Siłownia' ? '🏋️‍♂️ Domowy Plan Siłowy' : '🚴‍♂️ Plan Treningowy')}
      # 🥞 Protokół Dietetyczny (Cały Dzień)
    `;

    // Wywołanie z mechanizmem zapasowym
    aiAnaliza = await callGeminiWithFallback(dynamicSystemInstruction, prompt);
  } catch (err: any) {
    console.error("Błąd generowania analizy poranka:", err?.message || err);
  }

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
      ai_analiza: aiAnaliza || null,
      is_rest_day,
      workout_type,
      workout_time: is_rest_day ? 'none' : workout_time
    }]);

  if (insertError) console.error("Błąd zapisu poranka w Supabase:", insertError);
  revalidatePath('/');
}

// ==========================================
// III. STATYSTYKI I ARCHIWUM
// ==========================================

export async function getDashboardStats(): Promise<any> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { avgWeight: 0, avgHrv: 0, avgSleep: 0, totalWorkouts: 0, totalKm: 0, avgHr: 0, avgCadence: 0 };
  }

  const siedemDniTemu = new Date();
  siedemDniTemu.setDate(siedemDniTemu.getDate() - 7);
  const data7 = siedemDniTemu.toISOString().split('T')[0];

  const { data: poranki } = await supabase.from('poranki').select('waga, hrv, jakosc_snu').eq('user_id', user.id).gte('data', data7);

  let avgWeight = 0, avgHrv = 0, avgSleep = 0;
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

  const { data: treningi } = await supabase.from('treningi').select('dystans, tetno_srednie, kadencja_srednia').eq('user_id', user.id).gte('data', data30);

  let totalWorkouts = 0, totalKm = 0, avgHr = 0, avgCadence = 0;
  if (treningi && treningi.length > 0) {
    totalWorkouts = treningi.length;
    const distances = treningi.map(t => Number(t.dystans)).filter(d => d > 0);
    const hrs = treningi.map(t => Number(t.tetno_srednie)).filter(h => h > 0);
    const cadences = treningi.map(t => Number(t.kadencja_srednia)).filter(c => c > 0);

    totalKm = Number(distances.reduce((a, b) => a + b, 0).toFixed(1));
    if (hrs.length > 0) avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
    if (cadences.length > 0) avgCadence = Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length);
  }

  return { avgWeight, avgHrv, avgSleep, totalWorkouts, totalKm, avgHr, avgCadence };
}

export async function getLatestAnalyses(): Promise<{ morningAnalysis: string | null, workoutAnalysis: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { morningAnalysis: null, workoutAnalysis: null };

  const dzis = getWarsawDateString();

  const { data: morningData } = await supabase.from('poranki').select('ai_analiza').eq('user_id', user.id).lt('data', dzis).not('ai_analiza', 'is', null).order('data', { ascending: false }).limit(1).maybeSingle();
  const { data: workoutData } = await supabase.from('treningi').select('ai_analiza').eq('user_id', user.id).lt('data', dzis).not('ai_analiza', 'is', null).order('data', { ascending: false }).limit(1).maybeSingle();

  return { morningAnalysis: morningData?.ai_analiza || null, workoutAnalysis: workoutData?.ai_analiza || null };
}

export async function getUnsentWorkout(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .eq('wyslano', false)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error("Błąd getUnsentWorkout:", error);
  return data;
}

export async function getTodayWorkout(): Promise<any | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: latestWorkout, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !latestWorkout) return null;

  if (latestWorkout.wyslano === false || latestWorkout.ai_analiza === null) {
    return null;
  }

  return latestWorkout;
}

export async function getRecentWorkouts(): Promise<any[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .order('data', { ascending: false })
    .limit(3);

  if (error) console.error("Błąd getRecentWorkouts:", error);
  return data || [];
}

// ==========================================
// IV. MULTIMEDIALNY CZAT Z TRENEREM AI
// ==========================================

export async function getChatHistory(): Promise<Message[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from('czat_wiadomosci').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
  if (error) console.error("Błąd getChatHistory:", error);
  return (data as Message[]) || [];
}

export async function clearChatHistory(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('czat_wiadomosci').delete().eq('user_id', user.id);
  revalidatePath('/');
}

export async function sendChatMessage(content: string, imageBase64?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Brak autoryzacji do wysłania wiadomości." };

    await supabase.from('czat_wiadomosci').insert([{ user_id: user.id, rola: 'user', tresc: content, obrazek_base64: imageBase64 || null }]);

    const dzis = getWarsawDateString();
    const { data: profile } = await supabase.from('profile').select('*').eq('id', user.id).maybeSingle();
    const { data: todayReport } = await supabase.from('poranki').select('*').eq('user_id', user.id).eq('data', dzis).maybeSingle();
    const { data: todayWorkout } = await supabase.from('treningi').select('*').eq('user_id', user.id).eq('data', dzis).maybeSingle();

    const history = await getChatHistory();
    const last10Messages = history.slice(-10);

    const imie = profile?.imie || 'zawodnik';
    const wiek = profile?.wiek || '';
    const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
    const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
    const celeSportowe = profile?.cele_sportowe || 'Zdrowie';
    const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };

    const dynamicChatInstruction = `
      Jesteś tym samym Osobistym Trenerem AI. 
      === PROFIL ZAWODNIKA ===
      - Wiek: ${wiek} lat
      - Główna dyscyplina: ${glownaDyscyplina}
      - Cel sportowy: ${celeSportowe}
      - Cel wagowy: ${celWagowy}
      - Strefa 2 (Zone 2) tętna: ${zone2.min}-${zone2.max} bpm

      === AKTUALNY STAN BIOLOGICZNY NA DZIŚ (${dzis}) ===
      ${todayReport ? `Waga rano: ${todayReport.waga} kg, HRV: ${todayReport.hrv} ms, Sen: ${todayReport.jakosc_snu}/100. Analiza rano: "${todayReport.ai_analiza}"` : '- Brak raportu porannego.'}

      === AKTUALNY TRENING NA DZIŚ (${dzis}) ===
      ${todayWorkout ? `Dystans: ${todayWorkout.dystans} km, Tętno: ${todayWorkout.tetno_srednie} bpm. Analiza treningu: "${todayWorkout.ai_analiza}"` : '- Brak treningu.'}

      Odpowiadaj z pasją, merytorycznie, motywująco. OPRZYJ SIĘ na powyższych danych z dzisiaj!
    `;

    const contents = last10Messages.map((msg, index) => {
      const isLast = index === last10Messages.length - 1;
      const parts: any[] = [{ text: msg.tresc }];
      if (isLast && msg.rola === 'user' && msg.obrazek_base64) {
        const mimeType = msg.obrazek_base64.split(';')[0].split(':')[1];
        const base64Data = msg.obrazek_base64.split(',')[1];
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      return { role: msg.rola === 'user' ? 'user' : 'model', parts };
    });

    let aiResponseText = "";
    try {
      // Wywołanie odporne na błędy 503/429
      aiResponseText = await callGeminiWithFallback(dynamicChatInstruction, undefined, contents);
    } catch (aiErr: any) {
      aiResponseText = `Przepraszam, serwery AI mają chwilowe przeciążenie: ${aiErr.message}`;
    }

    await supabase.from('czat_wiadomosci').insert([{ user_id: user.id, rola: 'model', tresc: aiResponseText }]);
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd." };
  }
}

// ==========================================
// V. ANALIZA AKTYWNOŚCI I METRYK (STRAVA + OPEN-METEO)
// ==========================================

export async function sendWorkoutToAI(trainingId: number): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Brak autoryzacji" };

  const { data: workout } = await supabase.from('treningi').select('*').eq('id', trainingId).eq('user_id', user.id).maybeSingle();
  if (!workout) return { success: false, error: "Nie znaleziono treningu w bazie." };

  const { data: profile } = await supabase.from('profile').select('*').eq('id', user.id).maybeSingle();

  const imie = profile?.imie || 'zawodnik';
  const wiek = profile?.wiek || '';
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
  const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };
  const filozofia = profile?.filozofia_treningowa || 'Mitochondrialna baza (Zone 2)';

  let temp = null;
  let windSpeed = null;
  let windDir = null;
  let rain = null;
  let weatherStringForAI = "Brak danych pogodowych.";

  if (workout.latitude && workout.longitude) {
    try {
      const dataTreningu = workout.data;
      const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${workout.latitude}&longitude=${workout.longitude}&start_date=${dataTreningu}&end_date=${dataTreningu}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,rain&wind_speed_unit=ms`;
      
      const weatherRes = await fetch(weatherUrl);
      if (weatherRes.ok) {
        const weatherJson = await weatherRes.json() as any;
        const hourIndex = 14; 
        
        temp = weatherJson.hourly?.temperature_2m?.[hourIndex] || null;
        windSpeed = weatherJson.hourly?.wind_speed_10m?.[hourIndex] || null;
        windDir = weatherJson.hourly?.wind_direction_10m?.[hourIndex] || null;
        rain = weatherJson.hourly?.rain?.[hourIndex] || null;

        if (temp !== null && windSpeed !== null) {
          const windKmH = Math.round(windSpeed * 3.6);
          weatherStringForAI = `Temperatura: ${temp}°C, Wiatr: ${windKmH} km/h (kierunek: ${windDir}°), Opady: ${rain || 0} mm.`;
        }
      }
    } catch (weatherErr) {
      console.error("Błąd pobierania pogody z Open-Meteo:", weatherErr);
    }
  }

  let aiAnaliza = "";
  try {
    const prompt = `Przeanalizuj dzisiejszy trening (${workout.rodzaj}) zawodnika o imieniu ${imie}:
    Dystans: ${workout.dystans} km, Czas: ${workout.czas_minuty} min, Tętno śr: ${workout.tetno_srednie} bpm, Kadencja: ${workout.kadencja_srednia} RPM.
    WARUNKI ATMOSFERYCZNE: ${weatherStringForAI}
    Oceń strefę 2 (${zone2.min}-${zone2.max} bpm) w odniesieniu do tych warunków.`;

    const dynamicSystemInstruction = `
      Jesteś elitarnym Trenerem Osobistym i Fizjologiem Sportu. Podopieczny: ${imie}, wiek: ${wiek}, sport: ${glownaDyscyplina}. Filozofia: ${filozofia}.
      Odpowiadaj profesjonalnie, motywująco.
      KATEGORYCZNY WYMÓG: Jeśli w warunkach atmosferycznych podano silny wiatr (np. powyżej 15 km/h) lub ekstremalną temperaturę, uwzględnij ten wpływ na tętno i wysiłek zawodnika!
    `;

    // Wywołanie odporne na przeciążenia 503
    aiAnaliza = await callGeminiWithFallback(dynamicSystemInstruction, prompt);
  } catch (err: any) {
    console.error("Błąd analizy treningu:", err);
    return { success: false, error: err?.message || "Wystąpił błąd generowania analizy." };
  }

  if (!aiAnaliza || aiAnaliza.trim() === "") {
    return { success: false, error: "AI zwróciło pustą analizę treningu." };
  }

  await supabase.from('treningi').update({ 
    ai_analiza: aiAnaliza, 
    wyslano: true,
    weather_temp: temp,
    weather_wind_speed: windSpeed ? Math.round(windSpeed * 3.6) : null,
    weather_wind_direction: windDir,
    weather_rain: rain
  }).eq('id', trainingId).eq('user_id', user.id);
  
  revalidatePath('/');
  return { success: true };
}

export async function syncStravaWorkoutsAction(): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Brak autoryzacji" };

  try {
    const { data: profile } = await supabase.from('profile').select('strava_refresh_token').eq('id', user.id).maybeSingle();
    const refreshToken = profile?.strava_refresh_token || process.env.STRAVA_REFRESH_TOKEN;
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) return { success: false, error: "Brak kluczy Strava." };

    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken })
    });

    if (!tokenResponse.ok) return { success: false, error: "Błąd autoryzacji Strava." };

    const tokenData = await tokenResponse.json() as any;
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const activitiesResponse = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!activitiesResponse.ok) return { success: false, error: "Błąd pobierania aktywności Strava." };

    const activities = await activitiesResponse.json() as any[];
    const { data: existingWorkouts } = await supabase.from('treningi').select('strava_id').eq('user_id', user.id);
    const existingIds = new Set(existingWorkouts?.map(t => Number(t.strava_id)) || []);

    const newWorkouts = activities.filter(act => !existingIds.has(act.id)).map(act => {
      let rodzaj = 'Bieg';
      if (act.type === 'Ride' || act.type === 'VirtualRide') rodzaj = 'Rower';
      if (act.type === 'Swim') rodzaj = 'Pływanie';
      if (act.type === 'WeightTraining' || act.type === 'Workout') rodzaj = 'Siłownia';

      const latitude = act.start_latlng && act.start_latlng[0] ? act.start_latlng[0] : null;
      const longitude = act.start_latlng && act.start_latlng[1] ? act.start_latlng[1] : null;

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
        wyslano: false,
        latitude,
        longitude
      };
    });

    let importedCount = 0;
    if (newWorkouts.length > 0) {
      const { error: insertError } = await supabase.from('treningi').insert(newWorkouts);
      if (insertError) return { success: false, error: `Błąd zapisu bazy: ${insertError.message}` };
      importedCount = newWorkouts.length;
    }

    revalidatePath('/');
    return { success: true, importedCount };
  } catch (err: any) {
    return { success: false, error: err?.message || "Wystąpił błąd połączenia." };
  }
}

export async function analyzeTrainingAction(id: number): Promise<string> {
  return "Analiza wykonana pomyślnie.";
}