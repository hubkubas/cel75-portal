import { 
  getTodayMorningReport, 
  getUnsentWorkout, 
  getTodayWorkout, // <-- NOWY IMPORT
  getDashboardStats, 
  getLatestAnalyses, 
  saveMorningReport, 
  sendWorkoutToAI,
  logout
} from './actions';
import StravaSyncButton from '@/components/StravaSyncButton';
import TrainerChat from '@/components/TrainerChat';
import { SubmitButton } from './submit-button';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic'; 

export default async function Page() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Pobieramy dane profilu do pełnej personalizacji interfejsu (UI)
  const { data: profile } = await supabase
    .from('profile')
    .select('imie, glowna_dyscyplina')
    .eq('id', user.id)
    .maybeSingle();

  const nazwaZalogowanego = profile?.imie || 'Zawodnik';
  const glownaDyscyplina = profile?.glowna_dyscyplina || 'Rower';

  // --- DYNAMICZNY GENERATOR ETYKIET I OPISÓW ---
  let naglowekFormularza = '📝 Poranny raport biologiczny';
  let podtytulFormularza = 'Wprowadź swoje dzisiejsze poranne parametry z zegarka Garmin, aby wygenerować spersonalizowaną odprawę i zlecenie treningowe na dziś.';
  let etykietaCzasu = 'Czas na trening (min)';
  let placeholderCzasu = 'np. 90';
  let etykietaCzasuPodsumowanie = 'Zadeklarowany trening';
  let placeholderNotatek = 'Jak się dziś czujesz? Jakieś dolegliwości? Wpływ wczorajszego protokołu na sen...';

  if (glownaDyscyplina === 'Bieg') {
    naglowekFormularza = '👟 Poranny raport biegowy';
    podtytulFormularza = 'Wprowadź swoje dzisiejsze poranne parametry, aby wygenerować spersonalizowaną biegową odprawę i dzisiejsze zadanie.';
    etykietaCzasu = 'Czas na bieg dzisiaj (min)';
    placeholderCzasu = 'np. 45';
    etykietaCzasuPodsumowanie = 'Zaplanowany bieg';
  } 
  else if (glownaDyscyplina === 'Marsz/Spacer') {
    naglowekFormularza = '🌳 Poranny raport zdrowotny';
    podtytulFormularza = 'Wprowadź swoje dzisiejsze samopoczucie i parametry rano, aby zaplanować łagodny, prozdrowotny spacer i ćwiczenia rozciągające.';
    etykietaCzasu = 'Czas na spacer dzisiaj (min)';
    placeholderCzasu = 'np. 30';
    etykietaCzasuPodsumowanie = 'Zaplanowany spacer';
    placeholderNotatek = `Dzień dobry, ${nazwaZalogowanego}! Jak się dzisiaj czujesz? Czy stawy są rozluźnione? Jak minęła noc?`;
  } 
  else if (glownaDyscyplina === 'Rower') {
    naglowekFormularza = '🚴‍♂️ Poranny raport kolarski';
    podtytulFormularza = 'Wprowadź swoje dzisiejsze poranne parametry z zegarka Garmin, aby wygenerować spersonalizowaną odprawę i dzisiejsze zlecenie treningowe.';
    etykietaCzasu = 'Czas na rower dzisiaj (min)';
    placeholderCzasu = 'np. 90';
    etykietaCzasuPodsumowanie = 'Zaplanowany rower';
  }

  // Pobieranie danych asynchronicznie bezpośrednio w Server Component
  const todayReport = await getTodayMorningReport();
  const unsentWorkout = await getUnsentWorkout();
  const todayWorkout = await getTodayWorkout(); // <-- POBIERAMY DZISIEJSZY PRZEANALIZOWANY TRENING
  const stats = await getDashboardStats();
  const { morningAnalysis, workoutAnalysis } = await getLatestAnalyses(); // <-- TERAZ ZWRACA TYLKO POPRZEDNIE DNI

  // Akcja serwerowa wywoływana po kliknięciu przycisku wysłania treningu do AI
  const triggerWorkoutAnalysis = async (formData: FormData) => {
    'use server';
    const trainingId = parseInt(formData.get('trainingId') as string, 10);
    if (!isNaN(trainingId)) {
      await sendWorkoutToAI(trainingId);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8">
      
      {/* GÓRNY PASEK SESJI I LOGOUT */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center gap-2 py-2.5 px-4 bg-slate-900/40 border border-slate-800/80 rounded-xl text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Zalogowany jako:</span>
          <strong className="text-orange-500 font-bold">{nazwaZalogowanego}</strong>
          <span className="text-slate-500">({user.email})</span>
        </div>
        <form action={logout}>
          <button 
            type="submit" 
            className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold text-slate-300 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            Wyloguj się
          </button>
        </form>
      </div>

      {/* NAGŁÓWEK PORTALU */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            CEL 75 <span className="text-xl">🚴‍♂️</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Portal biologiczno-treningowy dla zawodnika: <strong className="text-slate-300">{nazwaZalogowanego}</strong>
          </p>
        </div>
        
        {glownaDyscyplina !== 'Marsz/Spacer' && <StravaSyncButton />}
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEWA I ŚRODKOWA KOLUMNA */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* STATYSTYKI Z 30 DNI */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              📊 Wyniki z ostatnich 30 dni
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-400 block">Średnia waga</span>
                <span className="text-xl font-bold text-slate-100 block mt-1">{stats.avgWeight || '---'} kg</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-400 block">Średnie HRV</span>
                <span className="text-xl font-bold text-emerald-400 block mt-1">{stats.avgHrv || '---'} ms</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-400 block">Jakość snu</span>
                <span className="text-xl font-bold text-slate-100 block mt-1">{stats.avgSleep || '---'}/100</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-400 block">
                  {glownaDyscyplina === 'Marsz/Spacer' ? 'Suma kroków/marszu' : 'Suma kilometrów'}
                </span>
                <span className="text-xl font-bold text-orange-400 block mt-1">{stats.totalKm || '0'} km</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">
                  {glownaDyscyplina === 'Marsz/Spacer' ? 'Wykonane marsze:' : 'Wykonane treningi:'}
                </span>
                <span className="font-bold text-slate-200 text-sm">{stats.totalWorkouts}</span>
              </div>
              <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">Średnie tętno (HR):</span>
                <span className="font-bold text-red-400 text-sm">{stats.avgHr ? `${stats.avgHr} bpm` : 'brak'}</span>
              </div>
              <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">
                  {glownaDyscyplina === 'Rower' ? 'Średnia kadencja:' : 'Średnie tempo:'}
                </span>
                <span className="font-bold text-indigo-400 text-sm">
                  {glownaDyscyplina === 'Rower' 
                    ? (stats.avgCadence ? `${stats.avgCadence} RPM` : 'brak') 
                    : 'w normie'
                  }
                </span>
              </div>
            </div>
          </section>

          {/* DYNAMICZNY FORMULARZ PORANNY */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {todayReport ? (
              // Widok ZABLOKOWANY (Wysłany)
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                    ✅ Raport poranny na dziś wysłany
                  </h2>
                  <span className="text-xs text-slate-500">{todayReport.data}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
                  <div>
                    <span className="text-slate-500 block">Waga dzisiaj:</span>
                    <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.waga} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">HRV rano:</span>
                    <span className="font-bold text-emerald-400 block text-sm mt-0.5">{todayReport.hrv} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Body Battery:</span>
                    <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.body_battery}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Jakość snu:</span>
                    <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.jakosc_snu}/100</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{etykietaCzasuPodsumowanie}:</span>
                    <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.czas_na_trening} min</span>
                  </div>
                </div>

                {todayReport.notatki && (
                  <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
                    <span className="text-slate-500 block mb-1">Twoje notatki:</span>
                    <p className="text-slate-300 italic">{todayReport.notatki}</p>
                  </div>
                )}

                {todayReport.ai_analiza ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                      {glownaDyscyplina === 'Marsz/Spacer' 
                        ? '☀️ Dziennik Zdrowia (Zalecenia na Dziś)' 
                        : '📻 Komunikat z Wozu Technicznego (Odprawa Poranna)'
                      }
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {todayReport.ai_analiza}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Trener właśnie analizuje Twój raport poranny...</p>
                )}
              </div>
            ) : (
              // Widok ODBLOKOWANY (Formularz wpisywania)
              <div>
                <h2 className="text-lg font-bold text-slate-200 mb-2 flex items-center gap-2">
                  {naglowekFormularza}
                </h2>
                <p className="text-slate-400 text-xs mb-6">
                  {podtytulFormularza}
                </p>

                <form action={saveMorningReport} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Waga (kg)</label>
                      <input
                        type="number"
                        name="waga"
                        step="0.1"
                        required
                        placeholder="np. 74.5"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">HRV (ms)</label>
                      <input
                        type="number"
                        name="hrv"
                        required
                        placeholder="np. 55"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Body Battery</label>
                      <input
                        type="number"
                        name="body_battery"
                        required
                        placeholder="0-100"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jakość snu</label>
                      <input
                        type="number"
                        name="jakosc_snu"
                        required
                        placeholder="0-100"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">{etykietaCzasu}</label>
                      <input
                        type="number"
                        name="czas_na_trening"
                        required
                        placeholder={placeholderCzasu}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Wskazówki dla Twojego Trenera AI</label>
                    <textarea
                      name="notatki"
                      rows={3}
                      placeholder={placeholderNotatek}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <SubmitButton />
                  </div>
                </form>
              </div>
            )}
          </section>

          {/* SEKCJA: WYKRYTY NOWY TRENING DO ANALIZY (TYLKO JEŚLI NIE MA ANALIZY DZISIEJSZEGO) */}
          {unsentWorkout && !todayWorkout && glownaDyscyplina !== 'Marsz/Spacer' && (
            <section className="bg-slate-900 border border-orange-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-orange-600/15 text-orange-400 text-[10px] uppercase font-extrabold px-3 py-1.5 rounded-bl-xl tracking-wider">
                Nowy trening ze Strava
              </div>
              <h2 className="text-lg font-bold text-orange-400 mb-2 flex items-center gap-2">
                🚴‍♂️ Trening czeka na odprawę AI
              </h2>
              <p className="text-slate-400 text-xs mb-4">
                Wykryliśmy nową aktywność z dnia {unsentWorkout.data}. Wyślij ją do Trenera (Gemini), aby uzyskać pełną kolarską analizę stref tętna i kadencji.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 mb-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Dyscyplina:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">{unsentWorkout.rodzaj}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dystans:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">
                    {unsentWorkout.dystans ? `${unsentWorkout.dystans} km` : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Czas trwania:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">{unsentWorkout.czas_minuty} minut</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Parametry (HR/Kadencja):</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">
                    {unsentWorkout.tetno_srednie ? `${unsentWorkout.tetno_srednie} bpm` : '---'} / {unsentWorkout.kadencja_srednia ? `${unsentWorkout.kadencja_srednia} RPM` : '---'}
                  </span>
                </div>
              </div>

              <form action={triggerWorkoutAnalysis}>
                <input type="hidden" name="trainingId" value={unsentWorkout.id} />
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  🚀 Wyślij do odprawy AI
                </button>
              </form>
            </section>
          )}

          {/* [NOWOŚĆ] SEKCJA: DZISIEJSZY WYGENEROWANY TRENING (WYŚWIETLANY NA ŚRODKU) */}
          {todayWorkout && (
            <section className="bg-slate-900 border border-orange-900/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-orange-600/10 text-orange-400 text-[10px] uppercase font-extrabold px-3 py-1.5 rounded-bl-xl tracking-wider">
                Odprawa dzisiejszego treningu
              </div>
              <h2 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
                🏆 Analiza dzisiejszego treningu ({todayWorkout.rodzaj})
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 mb-6 text-xs">
                <div>
                  <span className="text-slate-500 block">Dystans:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">
                    {todayWorkout.dystans ? `${todayWorkout.dystans} km` : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Czas trwania:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayWorkout.czas_minuty} minut</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tętno średnie:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">
                    {todayWorkout.tetno_srednie ? `${todayWorkout.tetno_srednie} bpm` : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    {glownaDyscyplina === 'Rower' ? 'Średnia kadencja:' : 'Parametr ruchu:'}
                  </span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">
                    {glownaDyscyplina === 'Rower' 
                      ? (todayWorkout.kadencja_srednia ? `${todayWorkout.kadencja_srednia} RPM` : 'brak') 
                      : 'w normie'
                    }
                  </span>
                </div>
              </div>

              {todayWorkout.ai_analiza ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    🎙️ Analiza Treningowa AI (Komentarz Trenera)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {todayWorkout.ai_analiza}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Trener właśnie analizuje Twój dzisiejszy trening...</p>
              )}
            </section>
          )}

        </div>

        {/* PRAWA KOLUMNA: HISTORIA ODPRAW (Z DNI POPRZEDNICH) */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              📢 Archiwum odpraw (Poprzednie dni)
            </h2>

            <div className="flex-1 space-y-6 overflow-y-auto max-h-[680px] pr-1">
              
              {/* Ostatni trening z dni poprzednich */}
              {workoutAnalysis ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Poprzedni trening</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line line-clamp-[12] hover:line-clamp-none transition-all duration-300">
                    {workoutAnalysis}
                  </p>
                </div>
              ) : null}

              {/* Ostatni poranek z dni poprzednich */}
              {morningAnalysis ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      {glownaDyscyplina === 'Marsz/Spacer' ? 'Wskazówki zdrowotne' : 'Plan dnia rano'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line line-clamp-[12] hover:line-clamp-none transition-all duration-300">
                    {morningAnalysis}
                  </p>
                </div>
              ) : null}

              {!workoutAnalysis && !morningAnalysis && (
                <div className="text-center text-slate-500 py-12 text-xs italic">
                  Brak wygenerowanych analiz z poprzednich dni.
                </div>
              )}

            </div>
          </section>
        </div>

      </div>

      <TrainerChat />
    </main>
  );
}