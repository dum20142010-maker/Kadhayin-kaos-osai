import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

interface AiAdventureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (title: string) => void;
}

export const AiAdventureModal: React.FC<AiAdventureModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [interest, setInterest] = useState('History & Architecture');
  const [time, setTime] = useState('2 hours');
  const [style, setStyle] = useState('Solo Stroll');
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI();
      const prompt = `You are the DÌ AI Expedition Architect. 
Synthesize a custom, atmospheric Chennai discovery trail based on:
Interest: ${interest}
Time: ${time}
Style: ${style}

Respond with ONLY valid JSON:
{
  "title": "Evocative trail title",
  "summary": "1-2 sentence vivid description with Gen Z vibes",
  "stops": 3,
  "xp": 220
}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        setGeneratedResult({
          title: parsed.title || `Chennai: ${interest} Discovery Trail`,
          duration: time,
          stops: parsed.stops || 3,
          xp: parsed.xp || 220,
          summary: parsed.summary || `A curated ${time} exploration of ${interest.toLowerCase()} across historic Madras corridors.`
        });
      }
    } catch (err) {
      console.error('AI Adventure Generation Error:', err);
      setGeneratedResult({
        title: `Chennai: ${interest} Discovery Trail`,
        duration: time,
        stops: 3,
        xp: 220,
        summary: `A curated ${time} exploration of ${interest.toLowerCase()} across historic Madras corridors, paced for ${style.toLowerCase()}.`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1e] text-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-[#26262b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <div>
              <h3 className="font-headline text-xl text-white">DÌ AI Generator</h3>
              <p className="text-xs text-[#9898a0]">Custom Chennai trail synthesis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#26262b] flex items-center justify-center text-[#9898a0] hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {!generatedResult ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#9898a0] uppercase tracking-wider block mb-1.5">What are you curious about?</label>
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                className="w-full bg-[#121214] text-white p-3.5 rounded-xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-600"
              >
                <option>History & Architecture</option>
                <option>Food Lore & Cafes</option>
                <option>Sacred Heritage & Temples</option>
                <option>Colonial Chimes & Lore</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#9898a0] uppercase tracking-wider block mb-1.5">Time available</label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#121214] text-white p-3.5 rounded-xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-600"
              >
                <option>1 hour</option>
                <option>2 hours</option>
                <option>Half day (4 hours)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#9898a0] uppercase tracking-wider block mb-1.5">Exploration style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-[#121214] text-white p-3.5 rounded-xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-600"
              >
                <option>Solo Stroll</option>
                <option>With Friends / Group</option>
                <option>Family Walk</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full mt-4 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span>Synthesizing Chennai Lore...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>Generate Custom Adventure</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#121214] border border-orange-600/30 space-y-2">
              <span className="px-2.5 py-0.5 rounded bg-orange-600/20 text-orange-400 text-xs font-bold uppercase">
                AI Curated Trail
              </span>
              <h4 className="font-headline text-lg text-white">{generatedResult.title}</h4>
              <p className="text-xs text-[#9898a0]">{generatedResult.summary}</p>
              <div className="flex items-center gap-3 pt-2 text-xs text-emerald-400 font-semibold">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">schedule</span> {generatedResult.duration}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">pin_drop</span> {generatedResult.stops} Stops</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">bolt</span> +{generatedResult.xp} XP</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setGeneratedResult(null)}
                className="flex-1 py-3 rounded-xl bg-[#26262b] text-white text-sm font-semibold active:scale-95"
              >
                Configure Again
              </button>
              <button
                onClick={() => {
                  onGenerate(generatedResult.title);
                  onClose();
                  setGeneratedResult(null);
                }}
                className="flex-1 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold shadow-md active:scale-95"
              >
                Accept &amp; Start
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
