import { 
  getTodayMorningReport, 
  getUnsentWorkout, 
  getTodayWorkout, 
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
  let podtytulFormularza = 'Wprowadź swoje dzisiejsze parametry, aby wygenerować spersonalizowaną odprawę, plan treningowy lub dietę regeneracyjną na dziś.';
  let placeholderNotatek = 'Jak się dziś czujesz? Jakieś dolegliwości? Wpływ wczorajszego protokołu na sen...';

  if (glownaDyscyplina === 'Bieg') {
    naglowekFormularza = '👟 Poranny raport biegowy';
  } else if (glownaDyscyplina === 'Marsz/Spacer') {
    naglowekFormularza = '🌳 Poranny raport zdrowotny';
    placeholderNotatek = `Dzień dobry, ${nazwaZalogowanego}! Jak się dzisiaj czujesz? Czy stawy są rozluźnione?`;
  } else if (glownaDyscyplina === 'Rower') {
    naglowekFormularza = '🚴‍♂️ Poranny raport kolarski';
  }

  // Pobieranie danych
  const todayReport = await getTodayMorningReport();
  const unsentWorkout = await getUnsentWorkout();
  const todayWorkout = await getTodayWorkout(); 
  const stats = await getDashboardStats();
  const { morningAnalysis, workoutAnalysis } = await getLatestAnalyses(); 

  // Akcja serwerowa wysłania treningu do AI
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
      <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center gap-2 py-2.5 px-4 bg-slate-900/40 border border-slate-800/80 rounded-xl text-xs">
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
      <div className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            CEL 75 <span className="text-xl">🚴‍♂️</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Centrum Dowodzenia: <strong className="text-slate-300">{nazwaZalogowanego}</strong>
          </p>
        </div>
        
        {glownaDyscyplina !== 'Marsz/Spacer' && <StravaSyncButton />}
      </div>

      {/* GŁÓWNY, WYŚRODKOWANY UKŁAD JEDNOKOLUMNOWY */}
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 1. STATYSTYKI Z 30 DNI (Kompaktowe) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              📊 Wyniki z 30 dni
            </h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block uppercase">Waga</span>
              <span className="text-sm font-bold text-slate-200 block mt-1">{stats.avgWeight || '-'} kg</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block uppercase">HRV</span>
              <span className="text-sm font-bold text-emerald-400 block mt-1">{stats.avgHrv || '-'} ms</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block uppercase">Sen</span>
              <span className="text-sm font-bold text-slate-200 block mt-1">{stats.avgSleep || '-'}/100</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block uppercase">Dystans</span>
              <span className="text-sm font-bold text-orange-400 block mt-1">{stats.totalKm || '0'} km</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block uppercase">Treningi</span>
              <span className="text-sm font-bold text-slate-200 block mt-1">{stats.totalWorkouts}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-500 block uppercase">Śr. Tętno</span>
              <span className="text-sm font-bold text-red-400 block mt-1">{stats.avgHr ? `${stats.avgHr}` : '-'}</span>
            </div>
          </div>
        </section>

        {/* 2. DYNAMICZNY FORMULARZ PORANNY LUB RAPORT */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
          {todayReport ? (
            // WIDOK ZABLOKOWANY (Raport gotowy)
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  ✅ Plan na dziś wygenerowany
                </h2>
                <span className="text-xs text-slate-500">{todayReport.data}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
                <div>
                  <span className="text-slate-500 block">Waga:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.waga} kg</span>
                </div>
                <div>
                  <span className="text-slate-500 block">HRV:</span>
                  <span className="font-bold text-emerald-400 block text-sm mt-0.5">{todayReport.hrv} ms</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sen:</span>
                  <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.jakosc_snu}/100</span>
                </div>
                
                {/* Dynamiczne pola w zależności od tego, czy to Rest Day */}
                {todayReport.is_rest_day ? (
                  <div className="col-span-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg p-2 flex items-center justify-center">
                    <span className="font-bold text-emerald-400 text-sm">🧘‍♂️ Dzień Regeneracji (Rest Day)</span>
                  </div>
                ) : (
                  <>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Rodzaj treningu:</span>
                      <span className="font-bold text-orange-400 block text-sm mt-0.5">{todayReport.workout_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Czas:</span>
                      <span className="font-bold text-slate-200 block text-sm mt-0.5">{todayReport.czas_na_trening} min</span>
                    </div>
                  </>
                )}
              </div>

              {todayReport.ai_analiza ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                    {todayReport.is_rest_day 
                      ? '🥗 Protokół Regeneracyjny i Dieta na dziś' 
                      : '📻 Komunikat z Wozu Technicznego (Plan i Dieta)'
                    }
                  </h3>
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none">
                    {todayReport.ai_analiza}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Trener właśnie analizuje Twój raport poranny...</p>
              )}
            </div>
          ) : (
            // WIDOK ODBLOKOWANY (Formularz wpisywania)
            <div>
              <h2 className="text-lg font-bold text-slate-200 mb-2 flex items-center gap-2">
                {naglowekFormularza}
              </h2>
              <p className="text-slate-400 text-xs mb-6">
                {podtytulFormularza}
              </p>

              <form action={saveMorningReport} className="space-y-5">
                {/* Podstawowe dane biologiczne */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Waga (kg)</label>
                    <input type="number" name="waga" step="0.1" required placeholder="np. 74.5" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">HRV (ms)</label>
                    <input type="number" name="hrv" required placeholder="np. 55" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Body Battery</label>
                    <input type="number" name="body_battery" required placeholder="0-100" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jakość snu</label>
                    <input type="number" name="jakosc_snu" required placeholder="0-100" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>

                {/* PRZEŁĄCZNIK REST DAY (Używamy właściwości 'peer' z Tailwind) */}
                <div className="relative mt-6">
                  {/* Ukryty checkbox sterujący logiką CSS */}
                  <input type="checkbox" id="is_rest_day" name="is_rest_day" value="true" className="peer absolute opacity-0 w-0 h-0" />
                  
                  {/* Etykieta działająca jako przycisk Rest Day */}
                  <label htmlFor="is_rest_day" className="flex items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors peer-checked:border-emerald-500 peer-checked:bg-emerald-900/20">
                    <div className="w-5 h-5 border-2 border-slate-600 rounded flex items-center justify-center peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-colors">
                      <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-200 select-none">
                      🧘‍♂️ Dzisiaj dzień bez treningu (Rest Day)
                    </span>
                  </label>

                  {/* SEKCJA TRENINGOWA - Znika całkowicie, gdy zaznaczymy Rest Day */}
                  <div className="peer-checked:hidden mt-4 space-y-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      Zaplanuj dzisiejszy trening
                    </label>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 hover:border-orange-500 transition-colors">
                        <input type="radio" name="workout_type" value="Rower" defaultChecked className="accent-orange-500 w-4 h-4" />
                        <span className="text-sm font-medium text-slate-200">🚴‍♂️ Rower</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 hover:border-orange-500 transition-colors">
                        <input type="radio" name="workout_type" value="Siłownia" className="accent-orange-500 w-4 h-4" />
                        <span className="text-sm font-medium text-slate-200">🏋️‍♂️ Siłownia (własny sprzęt)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 hover:border-orange-500 transition-colors">
                        <input type="radio" name="workout_type" value="Bieg" className="accent-orange-500 w-4 h-4" />
                        <span className="text-sm font-medium text-slate-200">🏃‍♂️ Bieg</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Czas na trening (min)</label>
                      {/* Usunięto 'required', aby formularz przeszedł walidację HTML5, gdy pole jest ukryte (Rest Day) */}
                      <input type="number" name="czas_na_trening" defaultValue="0" placeholder="np. 60" className="w-full sm:w-1/3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                </div>

                {/* Notatki */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Wskazówki dla Trenera (Opcjonalnie)</label>
                  <textarea name="notatki" rows={3} placeholder={placeholderNotatek} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 resize-none" />
                </div>

                <div className="flex justify-end pt-2">
                  <SubmitButton />
                </div>
              </form>
            </div>
          )}
        </section>

        {/* 3. NOWY TRENING ZE STRAVY DO ANALIZY */}
        {unsentWorkout && !todayWorkout && glownaDyscyplina !== 'Marsz/Spacer' && (
          <section className="bg-slate-900 border border-orange-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-orange-600/15 text-orange-400 text-[10px] uppercase font-extrabold px-3 py-1.5 rounded-bl-xl tracking-wider">
              Nowy trening ze Strava
            </div>
            <h2 className="text-lg font-bold text-orange-400 mb-2 flex items-center gap-2">
              🚴‍♂️ Trening czeka na odprawę AI
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Wykryliśmy nową aktywność z dnia {unsentWorkout.data}. Wyślij ją do Trenera, aby uzyskać pełną analizę.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 mb-4 text-xs">
              <div><span className="text-slate-500 block">Dyscyplina:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{unsentWorkout.rodzaj}</span></div>
              <div><span className="text-slate-500 block">Dystans:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{unsentWorkout.dystans ? `${unsentWorkout.dystans} km` : '---'}</span></div>
              <div><span className="text-slate-500 block">Czas trwania:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{unsentWorkout.czas_minuty} minut</span></div>
              <div><span className="text-slate-500 block">Tętno śr.:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{unsentWorkout.tetno_srednie ? `${unsentWorkout.tetno_srednie} bpm` : '---'}</span></div>
            </div>

            <form action={triggerWorkoutAnalysis}>
              <input type="hidden" name="trainingId" value={unsentWorkout.id} />
              <button type="submit" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer">
                🚀 Wyślij do odprawy AI
              </button>
            </form>
          </section>
        )}

        {/* 4. DZISIEJSZY WYGENEROWANY TRENING */}
        {todayWorkout && (
          <section className="bg-slate-900 border border-orange-900/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-orange-600/10 text-orange-400 text-[10px] uppercase font-extrabold px-3 py-1.5 rounded-bl-xl tracking-wider">
              Odprawa dzisiejszego treningu
            </div>
            <h2 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
              🏆 Analiza dzisiejszego treningu ({todayWorkout.rodzaj})
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 mb-6 text-xs">
              <div><span className="text-slate-500 block">Dystans:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{todayWorkout.dystans ? `${todayWorkout.dystans} km` : '---'}</span></div>
              <div><span className="text-slate-500 block">Czas trwania:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{todayWorkout.czas_minuty} minut</span></div>
              <div><span className="text-slate-500 block">Tętno średnie:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{todayWorkout.tetno_srednie ? `${todayWorkout.tetno_srednie} bpm` : '---'}</span></div>
              <div><span className="text-slate-500 block">Kadencja:</span><span className="font-bold text-slate-200 block text-sm mt-0.5">{todayWorkout.kadencja_srednia ? `${todayWorkout.kadencja_srednia} RPM` : 'brak'}</span></div>
            </div>

            {todayWorkout.ai_analiza ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                  🎙️ Analiza Treningowa AI (Komentarz Trenera)
                </h3>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none">
                  {todayWorkout.ai_analiza}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Trener właśnie analizuje Twój dzisiejszy trening...</p>
            )}
          </section>
        )}

        {/* 5. OSTATNIA AKTYWNOŚĆ (Dawne Archiwum - Zredukowane) */}
        {(workoutAnalysis || morningAnalysis) && (
          <section className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              🕰️ Ostatnia zarchiwizowana aktywność
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {workoutAnalysis && (
                <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800/50">
                  <span className="text-[10px] uppercase font-bold text-orange-500/70 tracking-wider block mb-3">Ostatni Trening</span>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line line-clamp-[8] hover:line-clamp-none transition-all duration-300">
                    {workoutAnalysis}
                  </p>
                </div>
              )}

              {morningAnalysis && (
                <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-500/70 tracking-wider block mb-3">Ostatni Poranek</span>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line line-clamp-[8] hover:line-clamp-none transition-all duration-300">
                    {morningAnalysis}
                  </p>
                </div>
              )}

            </div>
          </section>
        )}

      </div>

      <TrainerChat />
    </main>
  );
}