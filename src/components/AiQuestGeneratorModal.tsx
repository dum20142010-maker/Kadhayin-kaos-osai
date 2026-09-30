import React, { useState } from 'react';
import { MasterPlace, GeneratedQuest } from '../types';
import { ALL_MASTER_PLACES_300 } from '../data/masterPlacesIndex';
import { generateDynamicPlaceQuests } from '../lib/aiExpeditionEngine';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AiQuestGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  initialPlace?: MasterPlace | null;
  onOpenLiveLensWithFilter?: (filterId?: string) => void;
}

export const AiQuestGeneratorModal: React.FC<AiQuestGeneratorModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  initialPlace,
  onOpenLiveLensWithFilter,
}) => {
  const { user } = useAuth();
  const [selectedPlace, setSelectedPlace] = useState<MasterPlace>(
    initialPlace || ALL_MASTER_PLACES_300[0]
  );
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [quests, setQuests] = useState<GeneratedQuest[]>([]);
  const [acceptedQuestIds, setAcceptedQuestIds] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const filteredList = ALL_MASTER_PLACES_300.filter((p) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.zone.toLowerCase().includes(q) ||
      `#${p.number}`.includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }).slice(0, 30);

  const handleGenerateQuests = async (placeToUse?: MasterPlace) => {
    const target = placeToUse || selectedPlace;
    setGenerating(true);
    triggerHaptic('medium');
    onShowToast(`Generating AI quests for #${target.number} ${target.name}...`, 'auto_awesome');

    try {
      const result = await generateDynamicPlaceQuests(target, 3);
      setQuests(result);
      triggerHaptic('legendary');
      onShowToast(`Generated 3 AI Quests for ${target.name}! 🎯`, 'verified');
    } catch (err) {
      console.warn('Quest generator error:', err);
      onShowToast('Could not generate quests. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptQuest = async (quest: GeneratedQuest) => {
    triggerHaptic('medium');
    setAcceptedQuestIds((prev) => ({ ...prev, [quest.id]: true }));

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'activeQuests', quest.id), quest);
      } catch (e) {
        console.warn('Firestore active quest error:', e);
      }
    }

    onShowToast(`Quest Accepted: "${quest.title}" (+${quest.xpReward} XP)!`, 'flag');
  };

  const handleStartMission = (quest: GeneratedQuest) => {
    triggerHaptic('light');
    onClose();
    if (quest.challengeType === 'photo_lens') {
      onOpenLiveLensWithFilter?.(quest.requiredFilter || 'peaberry-1924');
      onShowToast(`Live Lens active! Use the ${quest.requiredFilter || 'vintage'} filter 📸`, 'photo_camera');
    } else {
      onShowToast(`Mission Active: ${quest.objective}`, 'flag');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-[#18181c] rounded-3xl w-full max-w-xl shadow-2xl border border-orange-500/30 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#121214] border-b border-[#26262b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/40">
              <span className="material-symbols-outlined text-[22px]">psychology</span>
            </div>
            <div>
              <h3 className="font-headline text-lg text-white font-bold flex items-center gap-1.5">
                AI Multimodal Quest Engine
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold uppercase">
                  Gemini Flash
                </span>
              </h3>
              <p className="text-[11px] text-[#9898a0]">
                Generate contextual photo lens challenges, riddles, and lore hunts
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Target Landmark Card */}
          <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b] space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold">
                    #{selectedPlace.number}
                  </span>
                  <span className="text-[11px] text-[#9898a0] font-bold">{selectedPlace.zone}</span>
                </div>
                <h4 className="font-headline text-base font-bold text-white mt-0.5">
                  {selectedPlace.name}
                </h4>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 text-[11px] font-bold border border-teal-500/20">
                {selectedPlace.category}
              </span>
            </div>
            <p className="text-xs text-[#9898a0]">{selectedPlace.lore}</p>
          </div>

          {/* Landmark Quick Switcher / Search */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-white uppercase tracking-wider">
              <span>Switch Landmark (From 300 Places)</span>
              <span className="text-[10px] text-[#9898a0] font-mono">{filteredList.length} Available</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search place name, #number, or district..."
                className="w-full bg-[#121214] text-white px-3 py-2 pl-8 rounded-xl border border-[#26262b] text-xs focus:outline-none focus:border-orange-500"
              />
              <span className="material-symbols-outlined text-[#9898a0] text-[16px] absolute left-2.5 top-2.5">
                search
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
              {filteredList.slice(0, 10).map((place) => (
                <button
                  key={place.id}
                  onClick={() => {
                    setSelectedPlace(place);
                    triggerHaptic('light');
                  }}
                  className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    selectedPlace.id === place.id
                      ? 'bg-orange-600 text-white border-orange-500 shadow'
                      : 'bg-[#121214] text-[#cfcfd6] hover:bg-[#202026] border-[#26262b]'
                  }`}
                >
                  #{place.number} {place.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => handleGenerateQuests()}
            disabled={generating}
            className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                <span>Generating Multimodal Quests via Gemini...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>Generate 3 Quests for #{selectedPlace.number} {selectedPlace.name}</span>
              </>
            )}
          </button>

          {/* Display Generated Quests */}
          {quests.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-orange-400 text-[16px]">military_tech</span>
                <span>Generated AI Quests ({quests.length})</span>
              </h4>

              <div className="space-y-3">
                {quests.map((q) => {
                  const isAccepted = !!acceptedQuestIds[q.id];

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-[#121214] border border-[#26262b] hover:border-orange-500/40 transition-all space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase">
                              {q.challengeType.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-teal-400 font-bold">{q.difficulty}</span>
                          </div>
                          <h5 className="font-headline text-sm font-bold text-white mt-1">{q.title}</h5>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                          +{q.xpReward} XP
                        </span>
                      </div>

                      {/* Riddle Clue */}
                      <div className="p-2.5 rounded-xl bg-orange-950/20 border border-orange-500/20 text-xs text-orange-300 italic flex items-start gap-2">
                        <span className="material-symbols-outlined text-[16px] text-orange-400 shrink-0">help</span>
                        <span>"{q.riddleClue}"</span>
                      </div>

                      {/* Objective */}
                      <p className="text-xs text-[#cfcfd6] leading-relaxed">
                        <strong>Objective:</strong> {q.objective}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-[#26262b]">
                        <span className="text-[11px] text-[#9898a0] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-amber-400">workspace_premium</span>
                          <span>Reward: {q.badgeReward}</span>
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptQuest(q)}
                            disabled={isAccepted}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              isAccepted
                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-orange-600 hover:bg-orange-500 text-white'
                            }`}
                          >
                            {isAccepted ? '✓ Accepted' : 'Accept Quest'}
                          </button>

                          <button
                            onClick={() => handleStartMission(q)}
                            className="px-3 py-1.5 rounded-xl bg-[#1a1a1e] hover:bg-[#26262b] text-white border border-[#26262b] text-xs font-bold flex items-center gap-1 active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[14px] text-orange-400">play_arrow</span>
                            <span>Start</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
