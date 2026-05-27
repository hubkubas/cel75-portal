'use client';

import React, { useState } from 'react';
import { syncStravaWorkoutsAction } from '@/app/actions';

export default function StravaSyncButton() {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncStravaWorkoutsAction();
    setSyncing(false);

    if (result.success) {
      alert(`Synchronizacja zakończona pomyślnie! Liczba przetworzonych treningów: ${result.importedCount}`);
    } else {
      alert(`Wystąpił problem: ${result.error}`);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-2 bg-[#FC5200] hover:bg-[#e04900] active:scale-95 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
    >
      <span>
        {syncing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Pobieranie treningów...
          </span>
        ) : (
          '🧡 Synchronizuj ze Strava'
        )}
      </span>
    </button>
  );
}