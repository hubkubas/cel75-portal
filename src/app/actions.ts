// src/app/actions.ts
'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// Pomocnicza funkcja do pobierania lokalnej daty (YYYY-MM-DD)
function getLocalDateString() {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// OFICJALNY PROFIL I CHARAKTER TRENERA (SYSTEM PROMPT DLA GEMINI)
// -----------------------------------------------------------------------------
const ATHLETE_PROFILE = `
Jesteś profesjonalnym, wymagającym, pełnym pasji i niezwykle motywującym trenerem kolarstwa oraz Dyrektorem Sportowym Huberta. Twoje alter ego to "Wóz techniczny" oraz "Dyrektor Sportowy". Analizujesz jego parametry życiowe i treningowe na podstawie poniższego profilu:

PROFIL ZAWODNIKA I SUKCES REDUKCYJNY:
Hubert to 55-letni kolarz-amator (kategoria Masters). Zredukował wagę z 82 kg do wyścigowych 74 kg (utrzymując BMI poniżej 23 i chroniąc masę mięśniową przed sarkopenią). Obecnie znajduje się w Fazie Utrzymania (Strefa buforowa: 74-77 kg). Dieta: „Fuel for the Work Required”. W dni wolne i tlenowe stosuje Strict Low Carb (chude białka: drób, twaróg, tuńczyk, WPI na wodzie + góry warzyw + limitowane zdrowe tłuszcze). W dni mocnych treningów ładuje węglowodany (ryż/makaron) w oknie potreningowym (zero tłuszczu). Restrykcje: całkowita nietolerancja na płynne żółtko (jajka tylko na twardo). Zakaz jedzenia wieprzowiny i tłuszczów nasyconych. Wieczorna strategia: Sleep Low (białkowa kolacja bez węglowodanów).

TRENING KOLARSKI I OPOROWY:
Sprzęt: karbonowy Giant Revolt Adv 3, pulsometr na klatce, trenażer Smart na zimę. Baza tlenowa w Strefie 2 (105-115 bpm, wysoka kadencja 90+ RPM). Cel: VO2 Max, starty w wyścigach amatorskich (Gran Fondo). Wykonuje trening core (Deska 3x45s). Zadanie: wprowadzanie 1-2 razy w tygodniu 30-minutowego obwodowego treningu oporowego na górne partie (sztanga, hantle, ławka, gumy), aby wzmocnić kolarski gorset bez budowania zbędnej masy.

REGENERACJA, SEN I TELEMETRIA (KLUCZOWE!):
Hubert codziennie rano raportuje dane z Garmina (Waga, HRV, Body Battery, Sen - oceniany punktowo w skali 0-100). Wychodzi z wieloletniej bezsenności i wydłużył sen z 3 do ponad 6 godzin, stale monitorując jakość snu. Aby zapobiegać wybudzeniom o 4:00 rano (wyrzut kortyzolu), stosuje Protokół Wieczorny: 400 mg Magnezu + 1 mg Melatoniny + 1-2 małe płaskie łyżeczki miodu (miód pomijamy tylko w dni, gdy zjadł dużo węglowodanów, np. pizzę). Przy spadkach energii lub fałszywym głodzie stosuje "Ratunek Solny" (woda, sól, cytryna), a na problemy z perystaltyką jelit pije napar z siemienia lnianego.

STYL ODPOWIEDZI (KLUCZOWY):
Twoje analizy muszą być niezwykle szczegółowe, długie, rozbudowane, pełne kolarskiego żargonu, humoru i pasji. Używaj emotikonów (kolarze, rowery, wóz techniczny, owoce, jedzenie).
W analizie raportu porannego zawsze stosuj stały podział na sekcje:
1. Meldunek powitalny z motywującym okrzykiem trenerskim (np. "Wóz techniczny przyjmuje meldunek! Niedzielna odprawa Egzaminatora!").
2. Analiza wagi i sukcesu redukcyjnego w strefie buforowej (z entuzjazmem, np. "WAGA 74,9 KG – ZABETONOWANA!").
3. Szczegółowa analiza telemetrii (Body Battery, jakość snu w skali 0-100, HRV z uwzględnieniem kontekstu dnia, zmęczenia pracą i protokołu wieczornego).
4. PLAN NA DZIŚ (Zarządzanie kryzysem / treningiem / regeneracją).
5. PALIWO NA DZIŚ (Szczegółowe menu: śniadanie, obiad, ratunek solny, kolacja - dopasowane do tego, czy Hubert ma dziś trening, czy rest day).
6. WIECZORNY PROTOKÓW REGENERACYJNY (magnez, melatonina, miód).
7. ZLECENIE TRENINGOWE NA DZIŚ - Jeśli Hubert zadeklarował dostępny czas (np. 60 minut), ułóż dla niego dokładny trening kolarski w Strefie 2 (Fat Max, tętno 105-115 bpm) lub Rest Day, dopasowany do jego dzisiejszego czasu i poziomu energii.
`;

// -----------------------------------------------------------------------------
// INTEGRACJA Z GOOGLE GEMINI API
// -----------------------------------------------------------------------------
async function sendToGeminiAI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/"/g, '');

  if (!apiKey) {
    console.warn('Brak klucza GEMINI_API_KEY w pliku .env.local.');
    return 'Analiza AI: Brak skonfigurowanego klucza Google Gemini w .env.local.';
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: ATHLETE_PROFILE }]
          },
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Błąd API Gemini: ${response.statusText}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return reply || 'Nie udało się uzyskać odpowiedzi z Gemini AI.';
  } catch (error: any) {
    console.warn(`Problem z Gemini: ${error?.message || error}`);
    return 'Wystąpił błąd podczas generowania analizy przez Gemini.';
  }
}

// -----------------------------------------------------------------------------
// 1. OBSŁUGA RAPORTÓW PORANNYCH
// -----------------------------------------------------------------------------

export async function getTodayMorningReport() {
  try {
    const todayStr = getLocalDateString();
    const { data, error } = await supabase
      .from('poranki')
      .select('*')
      .eq('data', todayStr)
      .maybeSingle();

    if (error) {
      console.warn(`DIAGNOSTYKA PORANKI -> WIADOMOŚĆ: "${error.message}" | KOD: "${error.code}" | SZCZEGÓŁY: "${error.details}"`);
      return null;
    }
    return data;
  } catch (err: any) {
    console.warn(`Nieoczekiwany błąd poranków: ${err?.message || err}`);
    return null;
  }
}

export async function saveMorningReport(formData: FormData): Promise<void> {
  try {
    const todayStr = getLocalDateString();

    const waga = parseFloat(formData.get('waga') as string) || null;
    const hrv = parseInt(formData.get('hrv') as string, 10) || null;
    const bodyBattery = parseInt(formData.get('body_battery') as string, 10) || null;
    const jakoscSnu = parseInt(formData.get('jakosc_snu') as string, 10) || null; // <--- POZYCJA ZMIENIONA NA JAKOŚĆ SNU
    const czasNaTrening = parseInt(formData.get('czas_na_trening') as string, 10) || null;
    const notatki = formData.get('notatki') as string || '';

    // Zapis do bazy Supabase (z nową kolumną jakosc_snu zamiast sen_minuty)
    const { data: insertedData, error } = await supabase
      .from('poranki')
      .insert([
        {
          data: todayStr,
          waga,
          hrv,
          body_battery: bodyBattery,
          jakosc_snu: jakoscSnu, // <--- ZAPIS DO BAZY
          czas_na_trening: czasNaTrening,
          notatki
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.warn('Raport na dzisiejszy dzień został już zapisany.');
        return;
      }
      console.warn(`Błąd zapisu poranka: ${error.message}`);
      return;
    }

    // Przekazanie jakości snu do promptu Gemini
    const prompt = `Raport Poranny z Garmin: Waga: ${waga}kg, HRV: ${hrv}, Body Battery: ${bodyBattery}%, Jakość snu (skala 0-100): ${jakoscSnu}/100. Dostępny czas Huberta na trening rowerowy dzisiaj: ${czasNaTrening ? `${czasNaTrening} minut` : 'Brak czasu/brak określenia'}. Notatki zawodnika: "${notatki}". Przygotuj dla niego pełną, rozbudowaną, niezwykle szczegółową odprawę trenerską w swoim unikalnym stylu Dyrektora Sportowego (Meldunek, Analiza wagi, Telemetria, Plan na dziś, Paliwo na dziś, Protokół wieczorny, Zlecenie treningowe na dziś na podstawie zadeklarowanego czasu).`;
    const aiAnalysis = await sendToGeminiAI(prompt);

    await supabase
      .from('poranki')
      .update({ ai_analiza: aiAnalysis })
      .eq('id', insertedData.id);

    revalidatePath('/');
  } catch (err) {
    console.warn('Błąd serwera przy zapisie poranka:', err);
  }
}

// -----------------------------------------------------------------------------
// 2. OBSŁUGA TRENINGÓW
// -----------------------------------------------------------------------------

export async function getUnsentWorkout() {
  try {
    const { data, error } = await supabase
      .from('treningi')
      .select('*')
      .eq('wyslano', false)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`DIAGNOSTYKA TRENINGI -> WIADOMOŚĆ: "${error.message}" | KOD: "${error.code}" | SZCZEGÓŁY: "${error.details}"`);
      return null;
    }
    return data;
  } catch (err: any) {
    console.warn(`Nieoczekiwany błąd treningów: ${err?.message || err}`);
    return null;
  }
}

export async function sendWorkoutToAI(workoutId: number) {
  try {
    const { data: workout, error } = await supabase
      .from('treningi')
      .select('*')
      .eq('id', workoutId)
      .single();

    if (error || !workout) {
      return { success: false, error: 'Nie znaleziono treningu.' };
    }

    const prompt = `Oceń ostatni trening kolarza: Rodzaj: ${workout.rodzaj}, Dystans: ${workout.dystans}km, Czas trwania: ${workout.czas_minuty}min, Średnie tętno: ${workout.tetno_srednie || 'N/A'} bpm, Maksymalne tętno: ${workout.tetno_max || 'N/A'} bpm, Średnia kadencja: ${workout.kadencja_srednia || 'N/A'}. Przygotuj niezwykle szczegółową i motywującą odprawę "ZLECENIE TRENINGOWE" w swoim stylu trenerskim Dyrektora Sportowego.`;
    const aiAnalysis = await sendToGeminiAI(prompt);

    await supabase
      .from('treningi')
      .update({
        wyslano: true,
        ai_analiza: aiAnalysis
      })
      .eq('id', workoutId);

    revalidatePath('/');
    return { success: true };
  } catch (err) {
    console.warn('Błąd wysyłki treningu:', err);
    return { success: false, error: 'Błąd wysyłki treningu do AI.' };
  }
}

// -----------------------------------------------------------------------------
// 3. STATYSTYKI DASHBOARDU ORAZ OSTATNIE ANALIZY
// -----------------------------------------------------------------------------

export async function getDashboardStats() {
  try {
    const { data, error } = await supabase
      .from('treningi')
      .select('dystans, tetno_srednie, kadencja_srednia');

    if (error || !data) {
      return { totalWorkouts: 0, totalKm: 0, avgHr: 0, avgCadence: 0 };
    }

    const totalWorkouts = data.length;
    const totalKm = data.reduce((sum, item) => sum + Number(item.dystans || 0), 0);
    
    const hrs = data.filter(d => d.tetno_srednie).map(d => d.tetno_srednie as number);
    const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;

    const cads = data.filter(d => d.kadencja_srednia).map(d => d.kadencja_srednia as number);
    const avgCadence = cads.length ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) : 0;

    return {
      totalWorkouts,
      totalKm: Math.round(totalKm * 100) / 100,
      avgHr,
      avgCadence
    };
  } catch (err) {
    return { totalWorkouts: 0, totalKm: 0, avgHr: 0, avgCadence: 0 };
  }
}

export async function getLatestAnalyses() {
  try {
    const { data: morning } = await supabase
      .from('poranki')
      .select('ai_analiza')
      .not('ai_analiza', 'is', null)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: workout } = await supabase
      .from('treningi')
      .select('ai_analiza')
      .not('ai_analiza', 'is', null)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      morningAnalysis: morning?.ai_analiza || 'Brak ostatniej analizy porannej.',
      workoutAnalysis: workout?.ai_analiza || 'Brak ostatniej analizy treningu.'
    };
  } catch (err) {
    return {
      morningAnalysis: 'Brak analizy.',
      workoutAnalysis: 'Brak analizy.'
    };
  }
}

// Eksport wsteczny dla kompatybilności ze starym komponentem TrainingCard.tsx
export async function analyzeTrainingAction(workoutId: number) {
  return sendWorkoutToAI(workoutId);
}