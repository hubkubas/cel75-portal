'use client';

import { useState, useActionState, useEffect } from 'react';
import { updateProfileAction, OnboardingState } from '@/app/actions';

interface ProfileSettingsModalProps {
  initialData: {
    imie: string;
    wiek: number;
    glowna_dyscyplina: string;
    cel_wagowy: string;
    // Dodajemy typ stref tętna do właściwości komponentu
    strefy_tetna?: {
      zone2?: { min?: number; max?: number };
      kadencja_target?: number;
    };
  };
}

export default function ProfileSettingsModal({ initialData }: ProfileSettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [state, formAction, isPending] = useActionState<OnboardingState | null, FormData>(
    updateProfileAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setIsOpen(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const z2Min = initialData.strefy_tetna?.zone2?.min ?? 105;
  const z2Max = initialData.strefy_tetna?.zone2?.max ?? 115;
  const kadencja = initialData.strefy_tetna?.kadencja_target ?? 90;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold text-slate-300 rounded-lg transition-all active:scale-95 cursor-pointer"
      >
        <svg
          className="w-3.5 h-3.5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Ustawienia</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                ⚙️ Ustawienia Profilu i Celów
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Zaktualizuj dane profilu, aby dostosować strategię i zalecenia Trenera AI.
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              {state?.error && (
                <div className="p-3 bg-red-950/30 text-red-400 border border-red-900/50 text-xs rounded-xl">
                  {state.error}
                </div>
              )}

              {showSuccess && (
                <div className="p-3 bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 text-xs rounded-xl">
                  ✅ Profil został pomyślnie zaktualizowany!
                </div>
              )}

              <div className="space-y-4">
                {/* Imię */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Twoje Imię
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={initialData.imie}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-750"
                  />
                </div>

                {/* Wiek */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Twój Wiek
                  </label>
                  <input
                    type="number"
                    name="age"
                    required
                    min="13"
                    max="120"
                    defaultValue={initialData.wiek}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-750"
                  />
                </div>

                {/* Główna dyscyplina */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Dyscyplina
                  </label>
                  <select
                    name="sport_profile"
                    defaultValue={initialData.glowna_dyscyplina}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 cursor-pointer"
                  >
                    <option value="Rower">🚴‍♂️ Kolarstwo / Rower</option>
                    <option value="Bieg">🏃‍♂️ Bieganie / Marszobieg</option>
                    <option value="Senior">🌳 Aktywny Senior / Zdrowie</option>
                  </select>
                </div>

                {/* Cel wagowy */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Cel wagowy
                  </label>
                  <select
                    name="weight_goal"
                    defaultValue={initialData.cel_wagowy}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 cursor-pointer"
                  >
                    <option value="Schudnąć">🔥 Redukcja</option>
                    <option value="Utrzymać">⚖️ Utrzymanie wagi</option>
                    <option value="Przytyć">💪 Budowa / Masa</option>
                  </select>
                </div>

                {/* KARTA PARAMETRÓW OBLICZONYCH PRZEZ AI */}
                <div className="bg-slate-950/60 border border-slate-850/80 rounded-xl p-3.5 text-xs space-y-2.5">
                  <div className="text-[10px] uppercase font-extrabold text-orange-500 tracking-wider flex items-center gap-1.5">
                    ⚡ Strefy obliczone przez AI (na bazie wieku)
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Strefa tlenowa (Zone 2):</span>
                    <strong className="text-slate-100 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{z2Min} - {z2Max} bpm</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Sugerowana kadencja:</span>
                    <strong className="text-slate-100 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {kadencja} {initialData.glowna_dyscyplina === 'Rower' ? 'RPM (korba)' : 'SPM (kroki)'}
                    </strong>
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-400 rounded-lg transition-all cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-slate-100 font-bold text-xs rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}