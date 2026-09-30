import React, { useState } from 'react';
import { DistrictTerritory } from '../types';
import { mockTerritories } from '../data/mockData';
import { triggerHaptic } from '../lib/haptic';

interface TerritoryLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const TerritoryLeaderboardModal: React.FC<TerritoryLeaderboardModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [territories] = useState<DistrictTerritory[]>(mockTerritories);
  const [selectedZoneIdx, setSelectedZoneIdx] = useState(0);

  if (!isOpen) return null;

  const currentTerritory = territories[selectedZoneIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-[#18181c] rounded-3xl w-full max-w-lg shadow-2xl border border-teal-500/40 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-teal-950 via-[#102022] to-[#141418] border-b border-teal-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600/20 text-teal-400 border border-teal-500/50 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                shield_person
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-teal-400 font-mono tracking-widest uppercase font-bold">Territorial Dominance</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                  Weekly Reset in 2d
                </span>
              </div>
              <h3 className="font-headline text-xl text-white font-bold">District Mayorships</h3>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#121214] text-[#9898a0] flex items-center justify-center hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* District Selector Tabs */}
        <div className="p-4 bg-[#141418] border-b border-[#26262b] flex gap-2 overflow-x-auto no-scrollbar">
          {territories.map((t, idx) => (
            <button
              key={t.zone}
              onClick={() => {
                setSelectedZoneIdx(idx);
                triggerHaptic('light');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedZoneIdx === idx
                  ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                  : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white'
              }`}
            >
              {t.zone}
            </button>
          ))}
        </div>

        {/* Territory Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Reigning Mayor Dossier */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1a1e] to-[#20252b] border border-teal-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={currentTerritory.mayorAvatar}
                  alt={currentTerritory.mayorDisplayName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-teal-400"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-black rounded-full flex items-center justify-center text-[10px] font-bold shadow">
                  👑
                </span>
              </div>
              <div>
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">Reigning District Mayor</span>
                <h4 className="font-headline text-lg text-white font-bold">{currentTerritory.mayorDisplayName}</h4>
                <span className="text-xs text-[#9898a0]">{currentTerritory.totalExplorers} active explorers</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#9898a0] uppercase block">Dominance</span>
              <span className="font-headline text-2xl font-bold text-teal-400">{currentTerritory.dominanceScore}%</span>
            </div>
          </div>

          {/* Weekly Challenge Banner */}
          <div className="p-3.5 rounded-2xl bg-[#141418] border border-[#26262b] space-y-1">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Weekly Territory Quest</span>
            <p className="text-xs text-white leading-relaxed">{currentTerritory.weeklyChallenge}</p>
          </div>

          {/* Leaderboard Table */}
          <div className="space-y-2">
            <span className="text-[10px] text-[#9898a0] uppercase font-bold tracking-wider block">District Vanguard Ranking</span>
            <div className="space-y-1.5">
              {currentTerritory.topLeaderboard.map((user) => (
                <div
                  key={user.rank}
                  className="p-3 rounded-2xl bg-[#1a1a1e] border border-[#26262b] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center font-headline font-bold text-sm ${user.rank === 1 ? 'text-amber-400' : user.rank === 2 ? 'text-zinc-300' : 'text-amber-600'}`}>
                      #{user.rank}
                    </span>
                    <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-xl object-cover" />
                    <div>
                      <span className="text-xs font-bold text-white block">{user.name}</span>
                      <span className="text-[10px] text-orange-400 font-semibold">{user.streak}d streak</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-teal-400">{user.xp} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141418] border-t border-[#26262b]">
          <button
            onClick={() => {
              onShowToast(`Joined ${currentTerritory.zone} territory challenge! (+50 XP)`, 'flag');
              triggerHaptic('medium');
            }}
            className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">flag</span>
            <span>Contribute XP to Claim {currentTerritory.zone} Mayorship</span>
          </button>
        </div>
      </div>
    </div>
  );
};
