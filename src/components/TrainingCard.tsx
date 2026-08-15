'use client'

import { useState } from 'react';
import { analyzeTrainingAction } from '../app/actions';

export default function TrainingCard({ training }: { training: any }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [userComment, setUserComment] = useState("");

  const quickNotes = [
    "🚴‍♂️ Jazda rekreacyjna / z rodziną (kawa & lody)",
    "⛰️ Wspinaczka górska / wjazd (max wysiłek)",
    "⚡ Ustawka / wyścig / ostra jazda",
    "🌧️ Złe warunki / walka z wiatrem"
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      // Przekazujemy dane treningu ORAZ opcjonalny komentarz zawodnika
      const result = await analyzeTrainingAction(training, userComment);
      setAnalysis(result);
    } catch (error) {
      console.error("Błąd podczas analizy treningu:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-sm space-y-4">
      {/* Nagłówek treningu */}
      <div>
        <h2 className="text-xl font-bold text-white">{training["Nazwa Treningu"]}</h2>
        <p className="text-gray-400 text-sm">{training["Data"]}</p>
        <div className="text-sm text-gray-300 mt-1">
          Dystans: <span className="font-semibold text-white">{training["Dystans"]}</span> | Kalorie: <span className="font-semibold text-white">{training["Kalorie"]}</span>
        </div>
      </div>

      {/* Sekcja komentarza / kontekstu dla trenera */}
      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/60">
        <label className="block text-xs font-medium text-gray-300 mb-1.5">
          💬 Dodaj kontekst dla trenera (opcjonalnie):
        </label>
        
        {/* Szybkie tagi do kliknięcia */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickNotes.map((note) => (
            <button
              key={note}
              type="button"
              onClick={() => setUserComment(note)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                userComment === note
                  ? "bg-amber-500/20 border-amber-400 text-amber-300 font-medium"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
              }`}
            >
              {note}
            </button>
          ))}
        </div>

        {/* Pole tekstowe na własną uwagę */}
        <input
          type="text"
          value={userComment}
          onChange={(e) => setUserComment(e.target.value)}
          placeholder="np. Jechałem z rodziną / Zoncolan na 100% / bolała noga..."
          className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
        />
      </div>
      
      {/* Przycisk wysyłki do AI */}
      <button 
        onClick={handleAnalyze}
        disabled={loading}
        className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
          loading 
            ? "bg-blue-600/40 text-blue-200 border border-blue-500/30 cursor-not-allowed animate-pulse" 
            : "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95 shadow-md shadow-blue-900/20"
        }`}
      >
        {loading ? (
          <>
            <svg 
              className="animate-spin h-4 w-4 text-blue-300" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Trener analizuje dane i Twój komentarz...</span>
          </>
        ) : (
          <>
            <span>🧠</span>
            <span>Poproś trenera o analizę</span>
          </>
        )}
      </button>

      {/* Odpowiedź trenera AI */}
      {analysis && (
  <div className="mt-4 space-y-3">
    <div className="p-4 bg-blue-950/30 border border-blue-800/60 rounded-lg text-blue-200 text-sm leading-relaxed whitespace-pre-wrap">
      {analysis}
    </div>

    {/* Przycisk przejścia do pogłębionej dyskusji na czacie */}
    <a
      href="#trainer-chat"
      onClick={() => {
        // Opcjonalnie: można ustawić fokus na polu czatu
        const chatInput = document.querySelector('textarea, input[type="text"]') as HTMLInputElement;
        if (chatInput) {
          chatInput.value = `Trenerze, odnośnie treningu z ${training["Data"] || training.data} (${training["Nazwa Treningu"] || ''}): `;
          chatInput.focus();
        }
      }}
      className="inline-flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 font-medium py-1 px-2 rounded bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition"
    >
      <span>💬</span>
      <span>Dopytaj trenera o szczegóły tej jednostki na czacie &rarr;</span>
    </a>
  </div>
)}
    </div>
  );
}