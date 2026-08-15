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
// FUNKCJE POMOCNICZE I PANCERNY FALLBACK AI (GEMINI + GROQ 100% FREE)
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
 * PANCERNY I W 100% DARMOWY SILNIK AI
 * Kolejność: Gemini 2.5 Flash -> Gemini 2.0 Flash -> Groq (Llama 3.3 70B - 100% darmowy)
 */
async function callGeminiWithFallback(
  systemInstruction: string,
  promptText?: string,
  customContents?: any[]
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // 1. KROK 1: PRÓBA WYWOŁANIA DARMOWEGO GEMINI (Google AI Studio)
  if (geminiKey) {
    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    const contents = customContents || [{ role: "user", parts: [{ text: promptText || "" }] }];
    const requestBody = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents
    };

    for (const model of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
          }
        );

        if (res.ok) {
          const data = await res.json() as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim() !== "") {
            return text;
          }
        }
      } catch (e) {
        console.warn(`[Gemini Free] Chwilowy błąd modelu ${model}, sprawdzam kolejne opcje...`);
      }
    }
  }

  // 2. KROK 2: DARMOWY RATUNEK GROQ (Llama 3.3 70B Versatile)
  if (groqKey) {
    try {
      console.log("[AI Fallback] Przełączam na bezpłatny silnik Groq (Llama 3.3 70B)...");

      let messages: any[] = [{ role: "system", content: systemInstruction }];

      if (customContents && customContents.length > 0) {
        for (const item of customContents) {
          const role = item.role === 'model' ? 'assistant' : 'user';
          const textPart = item.parts?.map((p: any) => p.text || '').join('\n') || '';
          if (textPart.trim()) {
            messages.push({ role, content: textPart });
          }
        }
      } else if (promptText) {
        messages.push({ role: "user", content: promptText });
      }

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json() as any;
        const text = groqData.choices?.[0]?.message?.content;
        if (text && text.trim() !== "") {
          return text;
        }
      } else {
        const groqErr = await groqRes.text();
        console.error("[Groq Error]", groqErr);
      }
    } catch (groqErr) {
      console.error("[Groq Exception]", groqErr);
    }
  }

  throw new Error("Wszystkie darmowe serwery AI są chwilowo zajęte. Spróbuj ponownie za kilkanaście sekund.");
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
  const workout_time = (formData.get('workout_time') as string) || (formData.get('preferowana_pora') as string) || 'popoludnie';

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
// IV. MULTIMEDIALNY CZAT Z TRENEREM AI (Z PAMIĘCIĄ TRENINGÓW I MEDYTACJI)
// ==========================================

export async function getChatHistory(): Promise<Message[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('czat_wiadomosci')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

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

    await supabase.from('czat_wiadomosci').insert([{ 
      user_id: user.id, 
      rola: 'user', 
      tresc: content, 
      obrazek_base64: imageBase64 || null 
    }]);

    const dzis = getWarsawDateString();
    const { data: profile } = await supabase.from('profile').select('*').eq('id', user.id).maybeSingle();
    const { data: todayReport } = await supabase.from('poranki').select('*').eq('user_id', user.id).eq('data', dzis).maybeSingle();
    
    const { data: recentWorkouts } = await supabase
      .from('treningi')
      .select('*')
      .eq('user_id', user.id)
      .order('data', { ascending: false })
      .limit(3);

    const history = await getChatHistory();
    const lastMessages = history.slice(-6);

    const imie = profile?.imie || 'zawodnik';
    const wiek = profile?.wiek || '';
    const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
    const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
    const celeSportowe = profile?.cele_sportowe || 'Zdrowie';
    const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };
    const targetCadence = profile?.strefy_tetna?.kadencja_target || 90;

    // Budujemy czytelny kontekst ostatnich jednostek treningowych i medytacji
    const formattedWorkoutsContext = recentWorkouts && recentWorkouts.length > 0
      ? recentWorkouts.map((t, i) => {
        const isMed = t.rodzaj === 'Medytacja' || (t.ai_analiza && t.ai_analiza.toLowerCase().includes('medytac'));
        return isMed
          ? `--- SESJA #${i + 1} (Data: ${t.data}, SESJA: Medytacja / Wyciszenie / Oddech) ---
             - Czas trwania: ${t.czas_minuty || 0} minut
             - Tętno spoczynkowe/średnie: ${t.tetno_srednie || 'brak danych'} bpm
             - TWOJA WCZEŚNIEJSZA REFLEKSJA: "${t.ai_analiza || 'Brak'}"`
          : `--- TRENING #${i + 1} (Data: ${t.data}, Dyscyplina: ${t.rodzaj}) ---
             - Dystans: ${t.dystans || 0} km | Czas: ${t.czas_minuty || 0} min
             - Tętno śr: ${t.tetno_srednie || 'brak'} bpm (Max: ${t.tetno_max || 'brak'} bpm)
             - Kadencja śr: ${t.kadencja_srednia || 'brak'} RPM
             - Pogoda: ${t.weather_temp !== null ? `${t.weather_temp}°C, wiatr ${t.weather_wind_speed} km/h` : 'brak danych'}
             - TWOJA WCZEŚNIEJSZA ANALIZA: "${t.ai_analiza || 'Brak'}"`;
      }).join('\n')
      : 'Brak zarejestrowanych jednostek treningowych w ostatnim czasie.';

    const dynamicChatInstruction = `
      Jesteś Osobistym Trenerem AI i Holistycznym Mentorem Zdrowia (styl fizjologii dr. Iñigo San-Millána połączony z głęboką regeneracją układu nerwowego).
      
      === PROFIL ZAWODNIKA ===
      - Imię: ${imie}, Wiek: ${wiek} lat, Sport: ${glownaDyscyplina}
      - Cel sportowy: ${celeSportowe}, Cel wagowy: ${celWagowy}
      - Strefa 2 (Zone 2): ${zone2.min}-${zone2.max} bpm (Kadencja: ${targetCadence}+ RPM)

      === STAN BIOLOGICZNY NA DZIŚ (${dzis}) ===
      ${todayReport ? `Waga rano: ${todayReport.waga} kg, HRV: ${todayReport.hrv} ms, Jakość snu: ${todayReport.jakosc_snu}/100. Odprawa: "${todayReport.ai_analiza}"` : '- Brak raportu porannego z dzisiaj.'}

      === OSTATNIE JEDNOSTKI TRENINGOWE I MEDYTACJE ===
      ${formattedWorkoutsContext}

      === KATEGORYCZNE ZASADY PROWADZENIA ROZMOWY ===
      1. MEDYTACJA I WYCISZENIE (NAUKI LAMY RINCZENA Z GRABNIKA):
         - Jeśli zawodnik pyta o medytację, oddech, wyciszenie, stres czy sesję relaksacyjną: BEZWZGLĘDNIE NIE wspominaj o dystansie, watach, prędkości czy kadencji!
         - Nawiąż do podejścia Lamy Rinczena z ośrodka w Grabniku: praktyki uważności i uspokojenia umysłu (*śine*), łagodnej obserwacji oddechu bez oceniania, niepodążania za pojawiającymi się myślami oraz rozluźniania napięć w ciele.
         - Wskaż fizjologiczny sens: aktywacja nerwu błędnego (układ przywspółczulny), podbicie HRV, obniżenie powysiłkowego kortyzolu i regeneracja mitochondriów.
      2. STANDARDOWE TRENINGI:
         - Odnoś się do konkretnych liczb i wcześniejszych analiz (tętno, moc, regeneracja, dieta powysiłkowa).
      3. Odpowiadaj zwięźle, konkretnie, z pasją i wsparciem.
    `;

    const contents = lastMessages.map((msg, index) => {
      const isLast = index === lastMessages.length - 1;
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
// V. ANALIZA AKTYWNOŚCI I METRYK (STRAVA + OPEN-METEO + AI)
// ==========================================

export async function sendWorkoutToAI(trainingId: number, userComment: string = ""): Promise<{ success: boolean; error?: string }> {
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
  const targetCadence = profile?.strefy_tetna?.kadencja_target || 90;

  const isMeditation = userComment.toLowerCase().includes('medytac') || workout.rodzaj === 'Medytacja';

  let temp = null;
  let windSpeed = null;
  let windDir = null;
  let rain = null;
  let weatherStringForAI = "Brak danych pogodowych.";

  if (workout.latitude && workout.longitude && !isMeditation) {
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
    const prompt = isMeditation 
      ? `Przeanalizuj sesję medytacji/wyciszenia zawodnika o imieniu ${imie}:
         - Czas trwania: ${workout.czas_minuty} minut
         - Tętno spoczynkowe/średnie: ${workout.tetno_srednie || 'brak danych'} bpm
         - Komentarz / odczucia: "${userComment}"`
      : `Przeanalizuj dzisiejszy trening (${workout.rodzaj}) zawodnika o imieniu ${imie}:
         - Dystans: ${workout.dystans} km
         - Czas trwania: ${workout.czas_minuty} min
         - Średnie tętno: ${workout.tetno_srednie || 'Brak danych'} bpm
         - Średnia kadencja: ${workout.kadencja_srednia || 'Brak danych'} RPM
         - WARUNKI ATMOSFERYCZNE: ${weatherStringForAI}
         - STREFY DOCELOWE: Zone 2 (${zone2.min}-${zone2.max} bpm), Kadencja (${targetCadence}+ RPM)
         === WAŻNY KONTEKST I KOMENTARZ ZAWODNIKA ===
         ${userComment ? `Zawodnik przekazał: "${userComment}"` : 'Brak dodatkowego komentarza.'}`;

    const dynamicSystemInstruction = `
      Jesteś elitarnym Trenerem Osobistym i Fizjologiem Sportu (styl dr. Iñigo San-Millána) oraz mentorem regeneracji układu nerwowego.
      Podopieczny: ${imie}, wiek: ${wiek}, sport główny: ${glownaDyscyplina}.

      === KATEGORYCZNE ZASADY ANALIZY ===
      1. JEŚLI SESJA TO MEDYTACJA / WYCISZENIE:
         - BEZWZGLĘDNIE ZABRANIAM pytania o prędkość, dystans, waty czy strefy tętna!
         - Odnieś się do nauk Lamy Rinczena z Grabnika (uspokojenie umysłu *śine*, nieoceniająca obserwacja oddechu, puszczanie napięć).
         - Wyjaśnij korzyść fizjologiczną: aktywacja nerwu błędnego, redukcja kortyzolu, wsparcie mitochondriów i regeneracja HRV.
      2. JEŚLI JAZDA REKREACYJNA / RODZINA:
         - NIE KRYTYKUJ niskiego tętna ani przerw. Pochwal aktywny wypoczynek (regenerację czynną) i relacje.
      3. JEŚLI WSPINACZKA GÓRSKA (ZONCOLAN / TEST / MAX) LUB WYŚCIG:
         - NIE KRYTYKUJ wyjścia z Zone 2. Doceń siłę woli, pułap tlenowy (VO2max) i zalec uzupełnienie glikogenu.
      4. Zwróć motywującą, zwięzłą analizę w formacie Markdown (2-3 akapity).
    `;

    aiAnaliza = await callGeminiWithFallback(dynamicSystemInstruction, prompt);
  } catch (err: any) {
    console.error("Błąd analizy aktywności:", err);
    return { success: false, error: err?.message || "Wystąpił błąd generowania analizy." };
  }

  if (!aiAnaliza || aiAnaliza.trim() === "") {
    return { success: false, error: "AI zwróciło pustą analizę." };
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

/**
 * Akcja wywoływana z komponentu TrainingCard
 */
export async function analyzeTrainingAction(training: any, userComment: string = ""): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const trainingId = typeof training === 'object' ? (training.id || training.strava_id) : training;

    if (user && trainingId) {
      const result = await sendWorkoutToAI(Number(trainingId), userComment);
      if (!result.success && result.error) {
        return `⚠️ Nie udało się przeprowadzić pełnej analizy: ${result.error}`;
      }

      const { data } = await supabase
        .from('treningi')
        .select('ai_analiza')
        .eq('id', Number(trainingId))
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.ai_analiza) {
        return data.ai_analiza;
      }
    }

    const isMed = userComment.toLowerCase().includes('medytac');
    const prompt = isMed
      ? `Przeanalizuj sesję medytacji: Czas: ${training["Czas"] || training.czas_minuty || 15} min, Komentarz: ${userComment}`
      : `Przeanalizuj trening: Nazwa: ${training["Nazwa Treningu"] || training.nazwa || 'Trening'}, Dystans: ${training["Dystans"] || training.dystans}, Komentarz: ${userComment || 'brak'}`;

    return await callGeminiWithFallback("Jesteś profesjonalnym trenerem i mentorem regeneracji (nauki Lamy Rinczena z Grabnika dla medytacji).", prompt);
  } catch (err: any) {
    console.error("Błąd analyzeTrainingAction:", err);
    return `Wystąpił błąd podczas analizy: ${err?.message || 'Spróbuj ponownie za chwilę.'}`;
  }
}

// ==========================================
// VI. SYNCHRONIZACJA ZE STRAVĄ (BEZPIECZNE MAPOWANIE ENUM)
// ==========================================

export async function syncStravaWorkoutsAction(): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Brak autoryzacji" };

  try {
    const { data: profile } = await supabase.from('profile').select('strava_refresh_token').eq('id', user.id).maybeSingle();
    const refreshToken = profile?.strava_refresh_token || process.env.STRAVA_REFRESH_TOKEN;
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) return { success: false, error: "Brak skonfigurowanych kluczy Strava." };

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

    if (!activitiesResponse.ok) return { success: false, error: "Błąd pobierania aktywności ze Strava." };

    const activities = await activitiesResponse.json() as any[];
    const { data: existingWorkouts } = await supabase.from('treningi').select('strava_id').eq('user_id', user.id);
    const existingIds = new Set(existingWorkouts?.map(t => Number(t.strava_id)) || []);

    const newWorkouts = activities.filter(act => !existingIds.has(act.id)).map(act => {
      // Bezpieczne mapowanie wyłącznie na dozwolone wartości ENUM w Supabase:
      let rodzaj = 'Siłownia';

      if (act.type === 'Ride' || act.type === 'VirtualRide' || act.type === 'GravelRide' || act.type === 'MountainBikeRide') {
        rodzaj = 'Rower';
      } else if (act.type === 'Run' || act.type === 'VirtualRun' || act.type === 'TrailRun') {
        rodzaj = 'Bieg';
      } else if (act.type === 'Swim') {
        rodzaj = 'Pływanie';
      } else {
        rodzaj = 'Siłownia';
      }

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
    return { success: false, error: err?.message || "Wystąpił błąd synchronizacji Strava." };
  }
}