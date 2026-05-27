// src/app/page.tsx
import { 
  getTodayMorningReport, 
  getUnsentWorkout, 
  getDashboardStats, 
  getLatestAnalyses,
  saveMorningReport,
  sendWorkoutToAI
} from './actions';
import { SubmitButton } from './submit-button';
import StravaSyncButton from '@/components/StravaSyncButton';
import TrainerChat from '@/components/TrainerChat';

export const revalidate = 0; // Wyłączamy cache, aby dane zawsze ładowały się na żywo

export default async function DashboardPage() {
  const todayReport = await getTodayMorningReport();
  const unsentWorkout = await getUnsentWorkout();
  const stats = await getDashboardStats();
  const analyses = await getLatestAnalyses();

  // Obsługa błędu połączenia z bazą
  if (todayReport && 'dbError' in todayReport) {
    return (
      <div className="min-h-screen bg-gray-950 text-red-200 p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-red-950/40 border border-red-800 rounded-xl p-6 space-y-3">
          <h1 className="text-xl font-bold text-red-400">Błąd połączenia z Supabase</h1>
          <p className="text-sm text-gray-300">Baza danych zwróciła następujący błąd:</p>
          <p className="bg-black/40 p-3 rounded font-mono text-xs text-red-300 whitespace-pre-wrap">
            {todayReport.dbError}
          </p>
          <p className="text-xs text-gray-400">Sprawdź konfigurację zmiennych w pliku .env.local oraz czy tabele istnieją w bazie danych.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Nagłówek */}
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-500">CEL 75 (Hubert)</h1>
          <p className="text-gray-400 text-sm mt-1">Dyrektor Sportowy w chmurze (Supabase + Google Gemini API)</p>

        </header>
          <StravaSyncButton />
        {/* 1. SEKCJA STATYSTYK */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 uppercase font-medium">Treningi</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.totalWorkouts}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 uppercase font-medium">Suma dystansu</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.totalKm} km</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 uppercase font-medium">Śr. Tętno</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.avgHr} bpm</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 uppercase font-medium">Śr. Kadencja</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.avgCadence} spm</p>
          </div>
        </section>

        {/* 2. RAPORT PORANNY & NIEWYSŁANY TRENING */}
        <section className="grid md:grid-cols-2 gap-8">
          
          {/* Formularz lub Podsumowanie Poranka */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-800 pb-2">Raport Poranny</h2>
            
            {todayReport ? (
              <div className="space-y-3 text-sm text-gray-300">
                <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3 text-emerald-400 font-medium mb-4">
                  ✓ Raport na dzisiaj został wysłany i zablokowany.
                </div>
                <p><strong className="text-gray-400">Waga:</strong> {todayReport.waga} kg</p>
                <p><strong className="text-gray-400">HRV:</strong> {todayReport.hrv}</p>
                <p><strong className="text-gray-400">Body Battery:</strong> {todayReport.body_battery}%</p>
                <p><strong className="text-gray-400">Jakość snu:</strong> {todayReport.jakosc_snu}/100</p>
                {todayReport.czas_na_trening && (
                  <p><strong className="text-gray-400">Czas na trening:</strong> {todayReport.czas_na_trening} min</p>
                )}
                {todayReport.notatki && <p><strong className="text-gray-400">Notatki:</strong> {todayReport.notatki}</p>}
              </div>
            ) : (
              <form action={saveMorningReport} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Waga (kg)</label>
                    <input step="0.1" name="waga" type="number" required className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none hover:border-emerald-500/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">HRV</label>
                    <input name="hrv" type="number" required className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none hover:border-emerald-500/50 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Body Battery</label>
                    <input name="body_battery" type="number" required className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none hover:border-emerald-500/50 transition-colors" />
                  </div>
                  <div>
                    {/* ZMIENIONE POLE: JAKAŚĆ SNU (ZAMIAST SEN MINUTY) */}
                    <label className="block text-xs text-gray-400 mb-1">Ocena jakości snu (Garmin 0-100)</label>
                    <input name="jakosc_snu" type="number" min="0" max="100" required className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none hover:border-emerald-500/50 transition-colors" />
                  </div>
                </div>

                {/* NOWE POLE: CZAS NA TRENING */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ile czasu możesz dziś przeznaczyć na trening rowerowy? (minuty)</label>
                  <input name="czas_na_trening" type="number" placeholder="np. 60 (zostaw puste, jeśli dziś nie trenujesz)" className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none hover:border-emerald-500/50 transition-colors" />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notatki dla trenera</label>
                  <textarea name="notatki" rows={3} placeholder="np. dziś długa praca przy biurku, lekkie zmęczenie..." className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none resize-none hover:border-emerald-500/50 transition-colors"></textarea>
                </div>
                <SubmitButton />
              </form>
            )}
          </div>

          {/* Ostatni trening oczekujący na wysłanie do AI */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-800 pb-2">Oczekiwanie na analizę treningu</h2>
            
            {unsentWorkout ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
                  <p className="text-xs text-emerald-500 font-semibold uppercase">{unsentWorkout.rodzaj}</p>
                  <p className="text-lg font-bold mt-1">{unsentWorkout.dystans} km</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Czas trwania: {unsentWorkout.czas_minuty} min 
                    {unsentWorkout.tetno_srednie && ` | Śr. tętno: ${unsentWorkout.tetno_srednie} bpm`}
                    {unsentWorkout.tetno_max && ` | Max tętno: ${unsentWorkout.tetno_max} bpm`}
                  </p>
                </div>
                <form action={async () => {
                  'use server';
                  await sendWorkoutToAI(unsentWorkout.id);
                }}>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-semibold py-2 px-4 rounded text-sm">
                    Wyślij ten trening do AI Trenera
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                Wszystkie treningi z bazy danych zostały przeanalizowane przez AI.
              </div>
            )}
          </div>

        </section>

        {/* 3. TRWAŁE KARTY ANALIZY AI NA DOLE */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-200 mb-3 border-b border-gray-800 pb-1">Ostatnia analiza poranna</h3>
            <div className="text-sm text-gray-400 whitespace-pre-line leading-relaxed font-sans">
              {analyses.morningAnalysis}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-200 mb-3 border-b border-gray-800 pb-1">Ostatnia analiza treningu</h3>
            <div className="text-sm text-gray-400 whitespace-pre-line leading-relaxed font-sans">
              {analyses.workoutAnalysis}
            </div>
          </div>
        </section>
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
  <div>
    <h1 className="text-3xl font-bold text-slate-100">CEL 75 🚴‍♂️</h1>
    <p className="text-slate-400 text-sm">Portal Huberta</p>
  </div>
  
  {/* TUTAJ WKLEJAMY POMARAŃCZOWY PRZYCISK STRAVY */}
  <TrainerChat />
</div>
      </div>
    </div>
  );
}