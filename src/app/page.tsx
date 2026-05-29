import { 
  getTodayMorningReport, 
  getUnsentWorkout, 
  getDashboardStats, 
  getLatestAnalyses, 
  saveMorningReport, 
  sendWorkoutToAI 
} from './actions';
import StravaSyncButton from '@/components/StravaSyncButton';
import TrainerChat from '@/components/TrainerChat';
import { SubmitButton } from './submit-button';

// --- DODAJEMY TE DWIE IMPORTY ---
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic'; 

export default async function Page() {
  // --- DODAJEMY TĘ DIAGNOSTYKĘ I WARUNEK ---
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Jeśli użytkownik nie jest zalogowany (lub sesja wygasła), odsyłamy do logowania
    redirect('/login');
  }

  // --- TUTAJ DALEJ IDZIE TWÓJ DOTYCHCZASOWY KOD ---
  // (np. pobieranie danych typu: const stats = await getDashboardStats()...)
  // 1. Pobieranie danych asynchronicznie bezpośrednio w Server Component
  const todayReport = await getTodayMorningReport();
  const unsentWorkout = await getUnsentWorkout();
  const stats = await getDashboardStats();
  const { morningAnalysis, workoutAnalysis } = await getLatestAnalyses();

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
      {/* NAGŁÓWEK PORTALU */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-500 sm:text-slate-100 flex items-center gap-2">
            CEL 75 <span className="text-xl">🚴‍♂️</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Portal biologiczno-treningowy Huberta</p>
        </div>
        
        {/* Synchronizacja ze Stravą */}
        <StravaSyncButton />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEWA I ŚRODKOWA KOLUMNA: PULPIT I RAPORTY */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SEKACJA 1: STATYSTYKI PRAWIDŁOWO PODPIĘTE POD AGREGACJE */}
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
                <span className="text-xs text-slate-400 block">Suma kilometrów</span>
                <span className="text-xl font-bold text-orange-400 block mt-1">{stats.totalKm || '0'} km</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">Wykonane treningi:</span>
                <span className="font-bold text-slate-200 text-sm">{stats.totalWorkouts}</span>
              </div>
              <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">Średnie tętno (HR):</span>
                <span className="font-bold text-red-400 text-sm">{stats.avgHr ? `${stats.avgHr} bpm` : 'brak'}</span>
              </div>
              <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">Średnia kadencja:</span>
                <span className="font-bold text-indigo-400 text-sm">{stats.avgCadence ? `${stats.avgCadence} RPM` : 'brak'}</span>
              </div>
            </div>
          </section>

          {/* SEKCJA 2: WYKRYTY NOWY TRENING DO ANALIZY */}
          {unsentWorkout && (
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

          {/* SEKACJA 3: RAPORT PORANNY (FORMULARZ LUB BLOKADA PODSUMOWANIA) */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {todayReport ? (
              // Widok ZABLOKOWANY (Raport został już wysłany na dzisiaj)
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
                    <span className="text-slate-500 block">Zadeklarowany trening:</span>
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
                      📻 Komunikat z Wozu Technicznego (Odprawa Poranna)
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
              // Widok ODBLOKOWANY (Hubert jeszcze nie wysłał dzisiejszego raportu)
              <div>
                <h2 className="text-lg font-bold text-slate-200 mb-2 flex items-center gap-2">
                  📝 Poranny raport biologiczny
                </h2>
                <p className="text-slate-400 text-xs mb-6">
                  Wprowadź swoje dzisiejsze poranne parametry z zegarka Garmin, aby wygenerować spersonalizowaną odprawę i zlecenie treningowe na dziś.
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jakość snu (Garmin)</label>
                      <input
                        type="number"
                        name="jakosc_snu"
                        required
                        placeholder="0-100"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Czas na trening (min)</label>
                      <input
                        type="number"
                        name="czas_na_trening"
                        required
                        placeholder="np. 90"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notatki dla Trenera</label>
                    <textarea
                      name="notatki"
                      rows={3}
                      placeholder="Jak się dziś czujesz? Jakieś dolegliwości? Wpływ wczorajszego protokołu na sen..."
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

        </div>

        {/* PRAWA KOLUMNA: OSTATNIE ODPRAWY OD TRENERA (HISTORIA) */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              📢 Ostatnie odprawy AI
            </h2>

            <div className="flex-1 space-y-6 overflow-y-auto max-h-[680px] pr-1">
              
              {/* Ostatni trening */}
              {workoutAnalysis ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Odprawa treningowa</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line line-clamp-[12] hover:line-clamp-none transition-all duration-300">
                    {workoutAnalysis}
                  </p>
                </div>
              ) : null}

              {/* Ostatni poranek */}
              {morningAnalysis ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Plan dnia rano</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line line-clamp-[12] hover:line-clamp-none transition-all duration-300">
                    {morningAnalysis}
                  </p>
                </div>
              ) : null}

              {!workoutAnalysis && !morningAnalysis && (
                <div className="text-center text-slate-500 py-12 text-xs italic">
                  Brak wygenerowanych analiz w ostatnim czasie. Wyślij raport poranny lub trening ze Stravy, aby wygenerować odprawę.
                </div>
              )}

            </div>
          </section>
        </div>

      </div>

      {/* Komponent pływającego czatu interaktywnego (Multimedialny dymek) */}
      <TrainerChat />
    </main>
  );
}