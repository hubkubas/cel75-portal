'use client';

import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getChatHistory, clearChatHistory, Message } from '@/app/actions';

export default function TrainerChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null); // przechowuje obrazek w formacie Base64
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    const history = await getChatHistory();
    setMessages(history);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, loading]);

  // Obsługa wczytywania pliku graficznego i konwersja do Base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !image) || loading) return;

    const tempUserMessage = input;
    const tempImage = image;

    setInput('');
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    // Optymistyczne dodanie do stanu lokalnego dla natychmiastowego feedbacku w UI
    setMessages((prev) => [
      ...prev, 
      { rola: 'user', tresc: tempUserMessage, obrazek_base64: tempImage || undefined }
    ]);

    const result = await sendChatMessage(tempUserMessage, tempImage || undefined);
    
    if (result.success) {
      await fetchHistory();
    } else {
      alert(result.error || "Nie udało się wysłać wiadomości.");
    }
    setLoading(false);
  };

  const handleClear = async () => {
    if (confirm("Czy na pewno chcesz wyczyścić historię rozmowy z Trenerem?")) {
      await clearChatHistory();
      setMessages([]);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 w-full max-w-md px-4 sm:px-0">
      {/* Przycisk otwierania czatu */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-5 rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-105 cursor-pointer"
        >
          <span>💬 Rozmowa z Trenerem</span>
        </button>
      )}

      {/* Okno czatu */}
      {isOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[520px] overflow-hidden">
          {/* Nagłówek */}
          <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚴‍♂️</span>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Wóz Techniczny / Trener Gemini</h3>
                <p className="text-xs text-emerald-400">Na linii z Hubertem</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="text-slate-400 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-slate-700 transition cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Wiadomości */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-700">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 mt-8">
                <p className="text-base">👋 Cześć Hubert!</p>
                <p className="text-xs mt-1">Napisz lub wyślij zdjęcie menu / posiłku, a przeanalizuję go pod kątem Twojej formy.</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.rola === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 whitespace-pre-line leading-relaxed ${
                      msg.rola === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    {/* Jeśli wiadomość ma zapisany obrazek, wyświetlamy go */}
                    {msg.obrazek_base64 && (
                      <div className="mb-2 max-w-[200px] rounded overflow-hidden border border-emerald-500">
                        <img src={msg.obrazek_base64} alt="Przesłane zdjęcie" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    {msg.tresc}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 rounded-lg px-4 py-2.5 rounded-bl-none border border-slate-700 flex items-center gap-2">
                  <span className="animate-pulse">Trener analizuje dane i zdjęcie...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Podgląd wybranego zdjęcia przed wysłaniem */}
          {image && (
            <div className="px-3 py-1 bg-slate-950 flex items-center justify-between border-t border-slate-800">
              <div className="flex items-center gap-2">
                <img src={image} alt="Podgląd" className="w-10 h-10 object-cover rounded border border-emerald-500" />
                <span className="text-xs text-slate-400">Zdjęcie przygotowane do wysłania</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-red-400 hover:text-red-300 text-xs cursor-pointer"
              >
                Usuń
              </button>
            </div>
          )}

          {/* Formularz wprowadzania wiadomości i plików */}
          <form onSubmit={handleSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2 items-center">
            {/* Przycisk dodawania zdjęcia */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              title="Wyślij zdjęcie"
            >
              📷
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Zapytaj np. czy możesz zjeść jabłko..."
              disabled={loading}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
            
            <button
              type="submit"
              disabled={loading || (!input.trim() && !image)}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '...' : 'Wyślij'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}