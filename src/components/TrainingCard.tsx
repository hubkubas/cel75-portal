'use client'

import { useState } from 'react';
import { sendWorkoutToAI } from '@/app/actions';

interface TrainingCardProps {
  workout: {
    id: number;
    rodzaj: string;
    data: string;
    dystans: number | null;
    czas_minuty: number;
    tetno_srednie: number | null;
    kadencja_srednia?: number | null;
  };
}

export default function TrainingCard({ workout }: TrainingCardProps) {
  const [loading, setLoading] = useState(false);
  const [userComment, setUserComment] = useState("");

  const isMeditation = userComment.includes("Medytacja") || workout.rodzaj === "Medytacja";

  const quickNotes = [
    "🧘‍♂️ Medytacja / Uważność (Lama Rinczen)",
    "🚴‍♂️ Jazda z rodziną / rekreacja",
    "⛰️ Wspinaczka górska (max wysiłek)",
    "⚡ Ustawka / wyścig / ostra jazda",
    "🌧️ Ciężkie warunki / wiatr"
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      await sendWorkoutToAI(workout.id, userComment);
    } catch (error) {
      console.error("Błąd analizy treningu:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-orange-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-4">
      <div className="absolute top-0 right-0 bg-orange-600/15 text-orange-400 text-[10px] uppercase font-extrabold px-3 py-1.5 rounded-bl-xl tracking-wider">
        {isMeditation ? "Sesja Regeneracji / Medytacji" : "Nowy trening ze Strava"}
      </div>
      
      <div>
        <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2">
          {isMeditation ? "🧘‍♂️ Sesja Medytacji czeka na omówienie" : "🚴‍♂️ Trening czeka na odprawę AI"}
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          {isMeditation 
            ? `Wykryto sesję wyciszenia z dnia ${workout.data}. Przeanalizuj wpływ na układ nerwowy z Trenerem.`
            : `Wykryliśmy nową aktywność z dnia ${workout.data}. Wyślij ją do Trenera, aby uzyskać pełną analizę.`
          }
        </p>
      </div>
      
      {/* Statystyki: Ukrywamy dystans i kadencję przy medytacji */}
      <div className={`grid gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs ${
        isMeditation ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
      }`}>
        <div>
          <span className="text-slate-500 block">Aktywność:</span>
          <span className="font-bold text-slate-200 block text-sm mt-0.5">
            {isMeditation ? "Medytacja / Oddech" : workout.rodzaj}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Czas trwania:</span>
          <span className="font-bold text-slate-200 block text-sm mt-0.5">{workout.czas_minuty} minut</span>
        </div>
        {!isMeditation && (
          <>
            <div>
              <span className="text-slate-500 block">Dystans:</span>
              <span className="font-bold text-slate-200 block text-sm mt-0.5">
                {workout.dystans ? `${workout.dystans} km` : '---'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Tętno śr.:</span>
              <span className="font-bold text-slate-200 block text-sm mt-0.5">
                {workout.tetno_srednie ? `${workout.tetno_srednie} bpm` : '---'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Szybkie tagi kontekstowe */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2.5">
        <label className="block text-xs font-semibold text-slate-400">
          💬 Dodaj kontekst dla Trenera (np. wybierz medytację lub wpisz własne odczucia):
        </label>
        
        <div className="flex flex-wrap gap-2">
          {quickNotes.map((note) => (
            <button
              key={note}
              type="button"
              onClick={() => setUserComment(note)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                userComment === note
                  ? "bg-orange-500/20 border-orange-400 text-orange-300 font-medium"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {note}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={userComment}
          onChange={(e) => setUserComment(e.target.value)}
          placeholder="np. Skupiłem się na oddechu / medytacja śine / gonitwa myśli..."
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-orange-500 transition"
        />
      </div>

      {/* Przycisk wysyłki */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className={`w-full sm:w-auto font-bold py-2.5 px-6 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
          loading
            ? "bg-orange-600/40 text-orange-200 border border-orange-500/30 cursor-not-allowed animate-pulse"
            : "bg-orange-600 hover:bg-orange-500 text-white cursor-pointer active:scale-95 shadow-lg shadow-orange-950/40"
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-orange-200" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Trener analizuje sesję...</span>
          </>
        ) : (
          <>
            <span>{isMeditation ? "🧘‍♂️" : "🚀"}</span>
            <span>{isMeditation ? "Omów sesję medytacji z Trenerem" : "Wyślij do odprawy AI"}</span>
          </>
        )}
      </button>
    </section>
  );
}