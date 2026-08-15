'use client'

interface DiscussWorkoutButtonProps {
  workoutDate: string;
  workoutType: string;
  workoutDistance?: number | null;
}

export default function DiscussWorkoutButton({ 
  workoutDate, 
  workoutType, 
  workoutDistance 
}: DiscussWorkoutButtonProps) {

  const handleOpenChat = () => {
    const text = `Trenerze, odnośnie treningu z dnia ${workoutDate} (${workoutType}${workoutDistance ? `, ${workoutDistance} km` : ''}): `;
    
    // Wysyłamy zdarzenie do komponentu TrainerChat
    window.dispatchEvent(new CustomEvent('open-trainer-chat', {
      detail: { initialText: text }
    }));
  };

  return (
    <button
      type="button"
      onClick={handleOpenChat}
      className="inline-flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 font-semibold py-1.5 px-3 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition cursor-pointer active:scale-95"
    >
      <span>💬</span>
      <span>Dyskutuj z trenerem o tym treningu na czacie &rarr;</span>
    </button>
  );
}