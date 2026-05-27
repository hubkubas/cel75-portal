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
      className="flex items-center gap-2 bg-[#FC5200] hover:bg-[#e04900] text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 shadow-md"
    >
      <span>{syncing ? '🔄 Pobieranie treningów...' : '🧡 Synchronizuj ze Strava'}</span>
    </button>
  );
}