'use client'
import { useState } from 'react';
import { analyzeTrainingAction } from '../app/actions';

export default function TrainingCard({ training }: { training: any }) {
  const[analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await analyzeTrainingAction(training);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
      <h2 className="text-xl font-bold">{training["Nazwa Treningu"]}</h2>
      <p className="text-gray-400 text-sm mb-4">{training["Data"]}</p>
      <div className="text-sm mb-4">Dystans: {training["Dystans"]} | Kalorie: {training["Kalorie"]}</div>
      
      <button 
        onClick={handleAnalyze}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition"
      >
        {loading ? "Analizuję..." : "Poproś trenera o analizę"}
      </button>

      {analysis && (
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded text-blue-200 italic text-sm">
          {analysis}
        </div>
      )}
    </div>
  );
}