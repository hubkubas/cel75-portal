'use client';

import { useState, useActionState } from 'react';
import { saveOnboardingAction, OnboardingState } from '@/app/actions'; // Dostosuj ścieżkę do actions.ts jeśli trzeba

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(''); // Stan dla imienia
  const [age, setAge] = useState('');
  const [sportProfile, setSportProfile] = useState('Rower');
  const [weightGoal, setWeightGoal] = useState('Utrzymać');

  const [state, formAction, isPending] = useActionState<OnboardingState | null, FormData>(
    saveOnboardingAction,
    null
  );

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 md:p-8 transition-all">
      
      {/* Pasek postępu */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Krok {step} z 3
        </span>
        <div className="flex space-x-1.5">
          <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-zinc-800 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
          <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-zinc-800 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
          <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-zinc-800 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
        </div>
      </div>

      {/* Komunikat o błędzie */}
      {state?.error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 text-sm rounded-lg">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        
        {/* KROK 1: IMIĘ I WIEK */}
        <div className={step === 1 ? 'block' : 'hidden'}>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">
            Witaj w Cel 75! 👋
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Zanim Twój osobisty Trener AI przygotuje plany i timing żywieniowy, musimy poznać Twoje podstawowe dane.
          </p>
          
          <div className="space-y-4">
            {/* Pole: Imię */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Twoje Imię
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                maxLength={50}
                placeholder="np. Tomek"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800 dark:focus:ring-zinc-300 transition-all"
              />
            </div>

            {/* Pole: Wiek */}
            <div className="space-y-2">
              <label htmlFor="age" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Twój Wiek
              </label>
              <input
                type="number"
                id="age"
                name="age"
                required
                min="13"
                max="120"
                placeholder="np. 34"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800 dark:focus:ring-zinc-300 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          
          <button
            type="button"
            disabled={!name.trim() || name.trim().length < 2 || !age || parseInt(age) < 13 || parseInt(age) > 120}
            onClick={() => setStep(2)}
            className="w-full mt-8 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Przejdź dalej
          </button>
        </div>

        {/* KROK 2: PROFIL SPORTOWY */}
        <div className={step === 2 ? 'block' : 'hidden'}>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">
            Twoja Dyscyplina ⚙️
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Jaki jest Twój główny profil aktywności? AI dostosuje do niego ton wypowiedzi oraz kładziony nacisk treningowy.
          </p>
          
          <input type="hidden" name="sport_profile" value={sportProfile} />

          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'Rower', title: '🚴‍♂️ Kolarstwo / Rower', desc: 'Budowanie bazy tlenowej (Zone 2), fizjologia kolarska.' },
              { id: 'Bieg', title: '🏃‍♂️ Bieganie / Marszobieg', desc: 'Biomechanika ruchu, strefy regeneracyjne i tętno.' },
              { id: 'Senior', title: '🌳 Aktywny Senior / Zdrowie', desc: 'Longevity, sprawność, spacery i ogólne samopoczucie.' },
            ].map((prof) => (
              <button
                key={prof.id}
                type="button"
                onClick={() => setSportProfile(prof.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  sportProfile === prof.id
                    ? 'border-zinc-850 dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-850 ring-1 ring-zinc-850 dark:ring-zinc-200'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="font-semibold text-sm text-zinc-950 dark:text-zinc-50 mb-1">{prof.title}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{prof.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex space-x-3 mt-8">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              Cofnij
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium py-3 rounded-xl transition-all"
            >
              Dalej
            </button>
          </div>
        </div>

        {/* KROK 3: CEL WAGOWY */}
        <div className={step === 3 ? 'block' : 'hidden'}>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">
            Twój Cel 🎯
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Jakie zmiany w kompozycji ciała są Twoim priorytetem? AI odpowiednio dostosuje kaloryczność diety.
          </p>

          <input type="hidden" name="weight_goal" value={weightGoal} />

          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'Schudnąć', title: '🔥 Redukcja', desc: 'Chcę schudnąć i poprawić skład ciała.' },
              { id: 'Utrzymać', title: '⚖️ Utrzymanie wagi', desc: 'Chcę utrzymać masę ciała, budować czystą formę i zdrowie.' },
              { id: 'Przytyć', title: '💪 Budowa / Masa', desc: 'Chcę zdrowo przybrać na wadze lub zbudować masę mięśniową.' },
            ].map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => setWeightGoal(goal.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  weightGoal === goal.id
                    ? 'border-zinc-850 dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-850 ring-1 ring-zinc-850 dark:ring-zinc-200'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="font-semibold text-sm text-zinc-950 dark:text-zinc-50 mb-1">{goal.title}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{goal.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex space-x-3 mt-8">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              Cofnij
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <span>{isPending ? 'Zapisywanie...' : 'Zakończ'}</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}