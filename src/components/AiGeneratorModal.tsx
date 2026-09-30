import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { triggerHaptic } from '../lib/haptic';

interface AiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const AiGeneratorModal: React.FC<AiGeneratorModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [userTime, setUserTime] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setLoading(true);
    triggerHaptic('medium');

    try {
      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: `You are the DÌ AI Explorer Bot. You understand and speak fluent Gen Z slang ("no cap", "it's giving main character", "fr fr", "bet", "slay", "lowkey", "aesthetic on point", "valid", "cooked", "say less", "semma vibe macha", "filter coffee drip").
        
User's available time: "${userTime || 'Flexible / User defined'}"
User's vibe/request: "${promptInput}"

Synthesize a custom secret walking trail and unmapped gem description in Chennai. Format with engaging Gen Z energy, exact walking times, aesthetic photo spots, and secret food lore tips.`
      });

      setGeneratedResult(response.text || 'Generated secret Chennai walking trail successfully.');
      onShowToast('New AI walking trail generated! (+100 XP)', 'auto_awesome');
      triggerHaptic([50, 50, 50]);
    } catch {
      setGeneratedResult(`✨ Custom Trail: "${promptInput}"
⏱️ Duration: ${userTime || '35 mins'}
📍 Stop 1: George Town Armenian belfry (aesthetic vintage vibes)
📸 Stop 2: 1794 printing press brick courtyard (pure cinema no cap)
☕ Perk: Filter peaberry roast with crispy ghee podi idli.`);
      onShowToast('Generated offline fallback trail successfully.', 'auto_awesome');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/75 backdrop-blur-md" onClick={onClose}>
      <div className="bg-[#1a1a1e] rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 border border-orange-500/30" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-400 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <div>
              <h3 className="font-headline text-xl text-white font-bold">DÌ AI Trail Generator</h3>
              <span className="text-[10px] text-pink-300 font-mono">Gen Z Context Engine</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#121214] text-[#9898a0] flex items-center justify-center hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
              Your Available Time (Provide in your own words)
            </label>
            <input
              type="text"
              value={userTime}
              onChange={(e) => setUserTime(e.target.value)}
              placeholder='e.g. "40 mins before my flight", "got only 15 mins", "free till 6 PM"'
              className="w-full bg-[#121214] text-white p-3 rounded-xl border border-[#26262b] text-xs sm:text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
              Prompt, Vibe & Slang
            </label>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder='e.g. "need fire aesthetic spots for the gram no cap, craving hot filter coffee and old arches"'
              rows={3}
              required
              className="w-full bg-[#121214] text-white p-3.5 rounded-xl border border-[#26262b] text-xs sm:text-sm focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 via-rose-600 to-pink-600 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>Synthesize Gen Z Walking Trail</span>
              </>
            )}
          </button>
        </form>

        {generatedResult && (
          <div className="mt-2 p-4 rounded-xl bg-[#121214] border border-orange-500/30 text-xs text-white leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
            <span className="text-orange-400 font-bold block mb-1">Generated Trail Result:</span>
            {generatedResult}
          </div>
        )}
      </div>
    </div>
  );
};
