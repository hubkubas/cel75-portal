'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  text?: string;
  pendingText?: string;
}

export function SubmitButton({ 
  text = 'Wyślij do Trenera AI', 
  pendingText = 'Przesyłanie i analiza...' 
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full text-center p-3 rounded-lg font-bold transition-colors ${
        pending 
          ? 'bg-blue-900 text-gray-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-500 text-white'
      }`}
    >
      {pending ? pendingText : text}
    </button>
  );
}