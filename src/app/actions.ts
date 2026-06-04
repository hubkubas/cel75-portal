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

export type OnboardingState = {
  success?: boolean;
  error?: string;
};

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

// NOWA AKCJA: INTERAKTYWNY ONBOARDING
export async function saveOnboardingAction(
  prevState: OnboardingState | null,
  formData: FormData
): Promise<OnboardingState> {
  const name = formData.get('name') as string;
  const ageStr = formData.get('age') as string;
  const sportProfile = formData.get('sport_profile') as string; // 'Rower' | 'Bieg' | 'Senior'
  const weightGoal = formData.get('weight_goal') as string; // 'Schudnąć' | 'Utrzymać' | 'Przytyć'

  const age = parseInt(ageStr, 10);

  // 1. Walidacja imienia
  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    return { error: 'Podaj poprawne imię (od 2 do 50 znaków).' };
  }

  // 2. Walidacja wieku
  if (!age || isNaN(age) || age < 13 || age > 120) {
    return { error: 'Podaj poprawny wiek (od 13 do 120 lat).' };
  }

  // 3. Walidacja profilu sportowego
  const validProfiles = ['Rower', 'Bieg', 'Senior'];
  if (!validProfiles.includes(sportProfile)) {
    return { error: 'Wybierz jeden z dostępnych profili sportowych.' };
  }

  // 4. Walidacja celu wagowego
  const validGoals = ['Schudnąć', 'Utrzymać', 'Przytyć'];
  if (!validGoals.includes(weightGoal)) {
    return { error: 'Wybierz poprawny cel wagowy.' };
  }

// ==========================================
  // KLASYCZNE OBLICZANIE STREF NA BAZIE % HRMAX
  // ==========================================
  const hrMax = 220 - age; // Tętno maksymalne (220 - wiek)
  const zone2Min = Math.round(hrMax * 0.60); // Dolna granica Zone 2 (60% HRmax)
  const zone2Max = Math.round(hrMax * 0.70); // Górna granica Zone 2 (70% HRmax)
  
  // Docelowa kadencja
  const kadencjaTarget = sportProfile === 'Rower' ? 90 : sportProfile === 'Bieg' ? 175 : 100;

  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Sesja wygasła. Zaloguj się ponownie.' };
    }

    const { error } = await supabase
      .from('profile')
      .upsert({
        id: user.id,
        imie: name.trim(),
        wiek: age,
        glowna_dyscyplina: sportProfile,
        cel_wagowy: weightGoal,
        onboarded: true,
        // Zapisujemy wyliczone strefy i kadencję bezpośrednio do kolumny JSONB
        strefy_tetna: {
          zone2: {
            min: zone2Min,
            max: zone2Max
          },
          kadencja_target: kadencjaTarget
        },
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Błąd zapisu profilu:', error.message);
      return { error: 'Nie udało się zapisać profilu. Spróbuj ponownie.' };
    }

    revalidatePath('/');
    return { success: true };

  } catch (err) {
    console.error('Nieoczekiwany błąd w saveOnboardingAction:', err);
    return { error: 'Wystąpił nieoczekiwany błąd serwera.' };
  }
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

  // 1. Pobieranie danych wprowadzonych przez użytkownika
  const waga = parseFloat(formData.get('waga') as string) || 0;
  const hrv = parseInt(formData.get('hrv') as string, 10) || 0;
  const body_battery = parseInt(formData.get('body_battery') as string, 10) || 0;
  const jakosc_snu = parseInt(formData.get('jakosc_snu') as string, 10) || 0;
  const czas_na_trening = parseInt(formData.get('czas_na_trening') as string, 10) || 0;
  const docelowy_dystans = parseFloat(formData.get('docelowy_dystans') as string) || 0;
  const preferowana_pora = (formData.get('preferowana_pora') as string) || 'popoludnie'; // Opcjonalna preferowana pora
  let notatkiRaw = (formData.get('notatki') as string) || '';

  // Archiwizacja celu dystansowego bezpośrednio w notatkach
  const notatki = docelowy_dystans > 0 
    ? `[Cel: ${docelowy_dystans} km] ${notatkiRaw}`.trim() 
    : notatkiRaw;

  // 2. Pobieranie profilu użytkownika
  const { data: profile } = await supabase.from('profile').select('*').eq('id', user.id).single();

  const imie = profile?.imie || 'zawodnik';
  const wiek = profile?.wiek || '';
  const zone2 = profile?.strefy_tetna?.zone2 || { min: 105, max: 115 };
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';
  const celWagowy = profile?.cel_wagowy || 'Utrzymanie wagi';
  const poziom = profile?.poziom_zaawansowania || 'Początkujący';
  const oczekiwania = profile?.oczekiwania_od_trenera || 'Spokojne i wspierające doradztwo';
  const celeSportowe = profile?.cele_sportowe || 'Zdrowie i sprawność';

  // 3. Pobranie historii ostatnich treningów
  const { data: recentWorkouts } = await supabase
    .from('treningi')
    .select('data, rodzaj, dystans, czas_minuty, tetno_srednie')
    .eq('user_id', user.id)
    .order('data', { ascending: false })
    .limit(3);

  const workoutsHistoryString = recentWorkouts && recentWorkouts.length > 0
    ? recentWorkouts.map(w => `- ${w.data}: ${w.rodzaj}, ${w.dystans ? w.dystans + 'km' : ''} ${w.czas_minuty}min, tętno śr: ${w.tetno_srednie || 'brak'} bpm`).join('\n')
    : 'Brak wcześniejszych treningów w bazie.';

  // Inicjalizacja domyślnych wartości
  let aiAnaliza = "";
  let is_rest_day = false;
  let workout_type = glownaDyscyplina;
  let workout_time = "popoludnie";

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      // Rozbudowanie promptu o preferowaną porę dnia
      const prompt = `Przeanalizuj dzisiejszy poranek zawodnika o imieniu ${imie} i zaproponuj sugerowane zalecenia:
      Waga: ${waga} kg
      HRV: ${hrv} ms
      Body Battery: ${body_battery}
      Jakość snu: ${jakosc_snu}/100
      Ograniczenie czasowe na dziś: ${czas_na_trening > 0 ? czas_na_trening + ' minut' : 'brak konkretnego limitu czasowego'}
      Docelowy dystans zadeklarowany przez zawodnika: ${docelowy_dystans > 0 ? docelowy_dystans + ' km' : 'brak konkretnego celu dystansowego'}
      Preferowana pora treningu określona przez zawodnika: ${preferowana_pora === 'poranek' ? 'Rano (przed 12:00)' : preferowana_pora === 'popoludnie' ? 'Popołudnie (12:00 - 17:00)' : 'Wieczór (po 17:00)'}
      Notatki/Samopoczucie użytkownika: ${notatkiRaw || 'brak'}
      
      HISTORIA OSTATNICH TRENINGÓW:
      ${workoutsHistoryString}`;

      let persona = "";
      if (glownaDyscyplina === 'Rower') {
        persona = `Jesteś wybitnym Trenerem Kolarskim, fizjologiem i ekspertem żywienia. Komunikuj się z pasją, kolarskim humorem (🚴‍♂️, 📻, 🚀). Fundamentem jest Strefa 2 (${zone2.min}-${zone2.max} bpm).`;
      } else if (glownaDyscyplina === 'Bieg') {
        persona = `Jesteś profesjonalnym Trenerem Biegowym i biomechanikiem. Strefa regeneracyjna to ${zone2.min}-${zone2.max} bpm. Używaj emotikonów (🏃‍♂️, 👟, ⏱️).`;
      } else {
        persona = `Jesteś ciepłym Mentorem Zdrowotnym, ekspertem ds. longevity. Tętno podczas marszu: 90-105 bpm. Używaj wspierających emotikonów (🌳, 🚶‍♂️, ☀️).`;
      }

      const dynamicSystemInstruction = `
        ${persona}
        Twój podopieczny to ${imie}, wiek: ${wiek} lat.
        Poziom: ${poziom}. Cel wagowy: ${celWagowy}. Cele sportowe: ${celeSportowe}. Oczekiwania: ${oczekiwania}.

        === TWOJA ROLA JAKO DORADCY ===
        Przeanalizuj stan biologiczny podopiecznego (HRV, Sen, Body Battery, jego notatki o samopoczuciu oraz ostatnie treningi). 
        Zasugeruj decyzję, czy dzisiaj zalecasz trening, czy dzień regeneracji (Rest Day).
        
        ZASADY FIZJOLOGICZNE:
        1. Jeśli wskaźniki regeneracji są bardzo niskie (np. HRV znacznie poniżej normy, sen poniżej 55, Body Battery poniżej 40, lub użytkownik zgłasza ból, przeziębienie czy silne przemęczenie) -> Zasugeruj dzień regeneracji (is_rest_day: true).
        2. Jeśli wskaźniki są dobre -> Zaproponuj trening (is_rest_day: false). 
           - Rodzaj treningu (workout_type): Dostosuj do głównej dyscypliny (${glownaDyscyplina}) lub zaproponuj domową Siłownię ('Siłownia') w oparciu o posiadany sprzęt (ławeczka, wolne ciężary, gumy).
           
           === OBSŁUGA LIMITÓW, CELÓW I PORY DNIA ZAWODNIKA ===
           - WARUNEK PORY DNIA: Jeśli planujesz trening, BEZWZGLĘDNIE zaplanuj go na preferowaną przez niego porę dnia (zwróć tę samą wartość w polu 'workout_time': 'poranek', 'popoludnie' lub 'wieczor').
           - JEŚLI zadeklarował dystans (dystans > 0): Zaplanuj jednostkę pod ten dystans! Oblicz czas trwania i dostosuj dietę oraz timing posiłków pod taki wydatek energetyczny.
           - JEŚLI nie podał dystansu, ale podał czas (czas > 0): Zaplanuj jednostkę mieszczącą się w tym limicie.

        3. PLAN REGENERACJI (Gdy is_rest_day to true):
           - Napisz krótki tekst o regeneracji, ale jeśli to możliwe, dodaj zalecenia na bardzo lekkie ćwiczenia aktywacyjne/stabilizacyjne w domu (np. planki, mobilność, lekkie rozciąganie, ćwiczenia na gumach oporowych na ławce).

        4. DIETA (Nutrient Timing):
           - Zawsze rozpisz pełne menu na cały dzień z dostosowaniem makroskładników do wybranej przez zawodnika pory treningu (wysokie węglowodany bezpośrednio po treningu, lekkostrawne węglowodany przed rannym treningiem) lub zbilansowane, niskowęglowodanowe posiłki w przypadku Rest Day.

        === WYMAGANY FORMAT ODPOWIEDZI (JSON) ===
        Zwróć odpowiedź wyłącznie w formacie JSON o podanej niżej strukturze pól:
        {
          "is_rest_day": true / false,
          "workout_type": "Rower" | "Bieg" | "Siłownia" | "Brak",
          "workout_time": "poranek" | "popoludnie" | "wieczor" | "none",
          "ai_analiza": "Tutaj umieść całą swoją analizę poranną, plan treningowy lub regeneracyjny oraz protokół dietetyczny rozpisany w formacie Markdown."
        }
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (response.ok) {
        const resData = await response.json() as any;
        const rawJsonText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        let cleanedJsonText = rawJsonText.trim();
        if (cleanedJsonText.startsWith("```")) {
          cleanedJsonText = cleanedJsonText.replace(/^```json\s*/i, "");
          cleanedJsonText = cleanedJsonText.replace(/```$/, "");
          cleanedJsonText = cleanedJsonText.trim();
        }

        try {
          const decisionObj = JSON.parse(cleanedJsonText);
          
          is_rest_day = decisionObj.is_rest_day === true;
          workout_type = decisionObj.workout_type || "Brak";
          workout_time = decisionObj.workout_time || "none";
          aiAnaliza = decisionObj.ai_analiza || "Błąd generowania analizy.";
        } catch (jsonErr) {
          console.warn("Standardowe parsowanie JSON nie powiodło się, uruchamiam bezpieczny fallback parser:", jsonErr);
          
          const restDayMatch = cleanedJsonText.match(/"is_rest_day"\s*:\s*(true|false)/i);
          if (restDayMatch) {
            is_rest_day = restDayMatch[1].toLowerCase() === 'true';
          }

          const typeMatch = cleanedJsonText.match(/"workout_type"\s*:\s*"([^"]+)"/i);
          if (typeMatch) {
            workout_type = typeMatch[1];
          }

          const timeMatch = cleanedJsonText.match(/"workout_time"\s*:\s*"([^"]+)"/i);
          if (timeMatch) {
            workout_time = timeMatch[1];
          }

          const analizaIndex = cleanedJsonText.indexOf('"ai_analiza"');
          if (analizaIndex !== -1) {
            let tempText = cleanedJsonText.substring(analizaIndex);
            const firstQuoteIndex = tempText.indexOf('"', tempText.indexOf(':'));
            if (firstQuoteIndex !== -1) {
              let contentText = tempText.substring(firstQuoteIndex + 1);
              contentText = contentText.trim();
              
              if (contentText.endsWith('}')) {
                contentText = contentText.substring(0, contentText.lastIndexOf('}')).trim();
              }
              if (contentText.endsWith('"')) {
                contentText = contentText.substring(0, contentText.length - 1);
              }

              aiAnaliza = contentText
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .trim();
            }
          }

          if (!aiAnaliza) {
            aiAnaliza = `Nie udało się sparsować decyzji trenera AI.\n\nSurowa odpowiedź modelu:\n${rawJsonText}`;
          }
        }
      }
    }
  } catch (err) {
    console.error("Błąd generowania analizy przez Gemini:", err);
  }

  // Zapis do Supabase (wybrana pora dnia automatycznie zostanie zapisana w kolumnie workout_time)
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
      workout_time
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

  // ZMIENNE POGODOWE (DOMYŚLNE)
  let temp = null;
  let windSpeed = null;
  let windDir = null;
  let rain = null;
  let weatherStringForAI = "Brak danych pogodowych.";

  // POBIERANIE POGODY Z OPEN-METEO (Jeśli są współrzędne)
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
      console.error("Błąd pobierania pogody:", weatherErr);
    }
  }

  let aiAnaliza = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Przeanalizuj dzisiejszy trening (${workout.rodzaj}) zawodnika o imieniu ${imie}:
      Dystans: ${workout.dystans} km, Czas: ${workout.czas_minuty} min, Tętno śr: ${workout.tetno_srednie} bpm, Kadencja: ${workout.kadencja_srednia} RPM.
      WARUNKI ATMOSFERYCZNE: ${weatherStringForAI}
      Oceń strefę 2 (${zone2.min}-${zone2.max} bpm) w odniesieniu do tych warunków.`;

      const dynamicSystemInstruction = `
        Jesteś elitarnym Trenerem Osobistym i Fizjologiem Sportu. Podopieczny: ${imie}, wiek: ${wiek}, sport: ${glownaDyscyplina}. Filozofia: ${filozofia}.
        Odpowiadaj profesjonalnie, motywująco, stosując kolarskie/biegowe pojęcia.
        KATEGORYCZNY WYMÓG: Jeśli w warunkach atmosferycznych podano silny wiatr (np. powyżej 15 km/h) lub ekstremalną temperaturę (poniżej 5°C lub powyżej 28°C), uwzględnij ten wpływ na tętno i wysiłek zawodnika! Wyjaśnij mu, że walka z wiatrem czołowym podnosi tętno i jest to naturalna reakcja fizjologiczna.
      `;

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

export async function updateProfileAction(
  prevState: OnboardingState | null,
  formData: FormData
): Promise<OnboardingState> {
  const name = formData.get('name') as string;
  const ageStr = formData.get('age') as string;
  const sportProfile = formData.get('sport_profile') as string;
  const weightGoal = formData.get('weight_goal') as string;

  const age = parseInt(ageStr, 10);

  // 1. Walidacja imienia
  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    return { error: 'Imię musi zawierać od 2 do 50 znaków.' };
  }

  // 2. Walidacja wieku
  if (!age || isNaN(age) || age < 13 || age > 120) {
    return { error: 'Podaj poprawny wiek (13-120 lat).' };
  }

  // 3. Walidacja profilu sportowego
  const validProfiles = ['Rower', 'Bieg', 'Senior'];
  if (!validProfiles.includes(sportProfile)) {
    return { error: 'Nieprawidłowa główna dyscyplina.' };
  }

  // 4. Walidacja celu wagowego
  const validGoals = ['Schudnąć', 'Utrzymać', 'Przytyć'];
  if (!validGoals.includes(weightGoal)) {
    return { error: 'Nieprawidłowy cel wagowy.' };
  }

// ==========================================
  // KLASYCZNE OBLICZANIE STREF NA BAZIE % HRMAX
  // ==========================================
  const hrMax = 220 - age; // Tętno maksymalne (220 - wiek)
  const zone2Min = Math.round(hrMax * 0.60); // Dolna granica Zone 2 (60% HRmax)
  const zone2Max = Math.round(hrMax * 0.70); // Górna granica Zone 2 (70% HRmax)
  
  // Docelowa kadencja
  const kadencjaTarget = sportProfile === 'Rower' ? 90 : sportProfile === 'Bieg' ? 175 : 100;

  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Sesja wygasła. Zaloguj się ponownie.' };
    }

    const { error } = await supabase
      .from('profile')
      .update({
        imie: name.trim(),
        wiek: age,
        glowna_dyscyplina: sportProfile,
        cel_wagowy: weightGoal,
        // Nadpisujemy strefy nowymi wartościami w przypadku zmiany wieku lub dyscypliny
        strefy_tetna: {
          zone2: {
            min: zone2Min,
            max: zone2Max
          },
          kadencja_target: kadencjaTarget
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Błąd aktualizacji profilu:', error.message);
      return { error: 'Wystąpił błąd podczas zapisywania zmian.' };
    }

    revalidatePath('/');
    return { success: true };

  } catch (err) {
    console.error('Nieoczekiwany błąd w updateProfileAction:', err);
    return { error: 'Wystąpił nieoczekiwany błąd serwera.' };
  }
}