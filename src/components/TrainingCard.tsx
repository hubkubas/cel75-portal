'use client'

import { useState } from 'react';
import { analyzeTrainingAction } from '../app/actions';

export default function TrainingCard({ training }: { training: any }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analyzeTrainingAction(training);
      setAnalysis(result);
    } catch (error) {
      console.error("Błąd podczas analizy treningu:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-sm">
      <h2 className="text-xl font-bold text-white">{training["Nazwa Treningu"]}</h2>
      <p className="text-gray-400 text-sm mb-4">{training["Data"]}</p>
      <div className="text-sm text-gray-300 mb-4">
        Dystans: <span className="font-semibold text-white">{training["Dystans"]}</span> | Kalorie: <span className="font-semibold text-white">{training["Kalorie"]}</span>
      </div>
      
      <button 
        onClick={handleAnalyze}
        disabled={loading}
        className={`px-4 py-2 rounded text-sm font-medium transition flex items-center justify-center gap-2 ${
          loading 
            ? "bg-blue-600/40 text-blue-200 border border-blue-500/30 cursor-not-allowed animate-pulse" 
            : "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95"
        }`}
      >
        {loading ? (
          <>
            {/* Animowane kółko ładowania (spinner) */}
            <svg 
              className="animate-spin h-4 w-4 text-blue-300" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Trwa analiza trenera AI...</span>
          </>
        ) : (
          <>
            <span>🧠</span>
            <span>Poproś trenera o analizę</span>
          </>
        )}
      </button>

      {analysis && (
        <div className="mt-4 p-4 bg-blue-950/30 border border-blue-800/60 rounded-lg text-blue-200 text-sm leading-relaxed whitespace-pre-wrap">
          {analysis}
        </div>
      )}
    </div>
  );
}