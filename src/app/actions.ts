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
  revalidatePath('/', 'layout');
  redirect('/login');
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

  if (error) {
    console.error("Błąd getTodayMorningReport:", error);
    return null;
  }
  return data;
}

export async function saveMorningReport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Brak autoryzacji do wykonania tej akcji.");
  }

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

  const { data: profile } = await supabase
    .from('profile')
    .select('*')
    .eq('id', user.id)
    .single();

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Przeanalizuj dzisiejszy poranek zawodnika o imieniu ${imie}:
      Waga: ${waga} kg
      HRV: ${hrv} ms
      Body Battery: ${body_battery}
      Jakość snu: ${jakosc_snu}/100
      Czas na aktywność dzisiaj: ${czas_na_trening} minut
      Notatki użytkownika: ${notatki || 'brak'}`;

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
      } else if (glownaDyscyplina === 'Bieg') {
        dynamicSystemInstruction = `
          Jesteś profesjonalnym Trenerem Biegowym. Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          KATEGORYCZNY WYMÓG STRUKTURY ODPOWIEDZI (Markdown):
          # 🎙️ Odprawa i analiza biegowa
          # 🏃‍♂️ Zadanie biegowe na dziś
          # 🥞 PROTOKÓŁ DIETETYCZNY I ODŻYWIANIE
        `;
      } else {
        dynamicSystemInstruction = `
          Jesteś Mentorem Zdrowotnym. Twój podopieczny to ${imie}, wiek: ${wiek} lat.
          KATEGORYCZNY WYMÓG STRUKTURY ODPOWIEDZI (Markdown):
          # 🎙️ Samopoczucie i kondycja
          # 🌳 Dzisiejszy spacer i sprawność
          # 🍵 DIETA I NAWODNIENIE
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

  const { error: insertError } = await supabase
    .from('poranki')
    .insert([{
      user_id: user.id,
      data: dzis,
      waga, hrv, body_battery, jakosc_snu, czas_na_trening, notatki: notatki || null, ai_analiza: aiAnaliza || null
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // POPRAWKA: Przywrócone filtry, żeby frontend nie mylił surowego treningu z analizowanym.
  // Pobierze najnowszy trening, który MA JUŻ analizę.
  const { data, error } = await supabase
    .from('treningi')
    .select('*')
    .eq('user_id', user.id)
    .eq('wyslano', true)
    .not('ai_analiza', 'is', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error("Błąd getTodayWorkout (ostatni trening):", error);
  return data;
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
    const dynamicChatInstruction = `Jesteś Osobistym Trenerem AI. Odpowiadaj merytorycznie. Dzisiejsza data: ${dzis}. Raport: ${todayReport?.ai_analiza || 'brak'}. Trening: ${todayWorkout?.ai_analiza || 'brak'}.`;

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: dynamicChatInstruction }] }, contents })
      });

      if (response.ok) {
        const resData = await response.json() as any;
        aiResponseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        aiResponseText = "Przepraszam, mam chwilowy problem z bazą wiedzy.";
      }
    } else {
      aiResponseText = "Brak klucza API Gemini.";
    }

    await supabase.from('czat_wiadomosci').insert([{ user_id: user.id, rola: 'model', tresc: aiResponseText }]);
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd." };
  }
}

// ==========================================
// V. ANALIZA AKTYWNOŚCI I METRYK (STRAVA)
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

  let aiAnaliza = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Przeanalizuj dzisiejszy trening (${workout.rodzaj}) zawodnika o imieniu ${imie}:
      Dystans: ${workout.dystans} km, Czas: ${workout.czas_minuty} min, Tętno śr: ${workout.tetno_srednie} bpm, Kadencja: ${workout.kadencja_srednia} RPM. Oceń strefę 2 (${zone2.min}-${zone2.max} bpm).`;

      const dynamicSystemInstruction = `Jesteś Osobistym Trenerem. Podopieczny: ${imie}, wiek: ${wiek}, sport: ${glownaDyscyplina}. Filozofia: ${filozofia}.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      });

      if (response.ok) {
        const resData = await response.json() as any;
        aiAnaliza = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const errText = await response.text();
        console.error("Błąd API Gemini:", errText);
        return { success: false, error: "AI odmówiło wygenerowania raportu." };
      }
    } else {
      return { success: false, error: "Brak skonfigurowanego klucza API Gemini." };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Wystąpił nieoczekiwany błąd Gemini." };
  }

  if (!aiAnaliza || aiAnaliza.trim() === "") {
    return { success: false, error: "AI zwróciło pustą analizę treningu." };
  }

  // Zapisujemy TYLKO gdy generowanie się powiodło
  await supabase.from('treningi').update({ ai_analiza: aiAnaliza, wyslano: true }).eq('id', trainingId).eq('user_id', user.id);

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