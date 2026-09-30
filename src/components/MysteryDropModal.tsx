import React, { useState, useEffect } from 'react';
import { MysteryDrop } from '../types';
import { mockMysteryDrops } from '../data/mockData';
import { triggerHaptic } from '../lib/haptic';

interface MysteryDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onDropClaimed?: (drop: MysteryDrop) => void;
}

export const MysteryDropModal: React.FC<MysteryDropModalProps> = ({ isOpen, onClose, onShowToast, onDropClaimed }) => {
  const [drops, setDrops] = useState<MysteryDrop[]>(mockMysteryDrops);
  const [activeDropIdx, setActiveDropIdx] = useState(0);
  const [claimedDrops, setClaimedDrops] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(142 * 60 + 38);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const currentDrop = drops[activeDropIdx];

  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClaim = (drop: MysteryDrop) => {
    if (claimedDrops[drop.id]) return;

    triggerHaptic('legendary');
    setClaimedDrops(prev => ({ ...prev, [drop.id]: true }));
    onShowToast(`+${drop.xpReward} XP • Flash Drop Claimed! Reward added to Vault 🎁`, 'celebration');
    onDropClaimed?.(drop);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-[#18181c] rounded-3xl w-full max-w-lg shadow-2xl border border-red-500/40 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-950 via-[#261214] to-[#141418] border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/50 flex items-center justify-center shadow-md animate-pulse">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                local_fire_department
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400 font-mono tracking-widest uppercase font-bold">Limited City Drop</span>
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
                  {currentDrop.remainingClaims} Claims Left
                </span>
              </div>
              <h3 className="font-headline text-xl text-white font-bold">Sunday Mystery Flash Drop</h3>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#121214] text-[#9898a0] flex items-center justify-center hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Live Countdown Timer Bar */}
        <div className="bg-[#121214] px-5 py-3 border-b border-[#26262b] flex items-center justify-between">
          <span className="text-xs text-[#9898a0] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>Window Closes In:</span>
          </span>
          <span className="font-mono text-base font-bold text-red-400 tracking-wider">
            {formatCountdown(secondsLeft)}
          </span>
        </div>

        {/* Drop Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="p-4 rounded-2xl bg-[#141418] border border-red-500/30 space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{currentDrop.zone} District Quest</span>
                <h4 className="font-headline text-lg text-white font-bold">{currentDrop.title}</h4>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-mono text-xs font-bold shrink-0">
                +{currentDrop.xpReward} XP
              </span>
            </div>

            <p className="text-xs text-[#9898a0] leading-relaxed italic bg-[#121214] p-3 rounded-xl border border-[#26262b]">
              "{currentDrop.clue}"
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] space-y-2">
            <span className="text-[10px] text-[#9898a0] font-bold uppercase tracking-wider block">Exclusive Mystery Reward</span>
            <div className="flex items-center gap-2.5 text-xs text-amber-300 font-semibold">
              <span className="material-symbols-outlined text-amber-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                card_membership
              </span>
              <span>{currentDrop.secretReward}</span>
            </div>
          </div>

          {/* Progress Bar of Remaining Slots */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#9898a0]">
              <span>Claimed Slots</span>
              <span>{currentDrop.totalClaims - currentDrop.remainingClaims} of {currentDrop.totalClaims} claimed</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#121214] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                style={{ width: `${((currentDrop.totalClaims - currentDrop.remainingClaims) / currentDrop.totalClaims) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-[#141418] border-t border-[#26262b]">
          <button
            onClick={() => handleClaim(currentDrop)}
            disabled={claimedDrops[currentDrop.id]}
            className={`w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
              claimedDrops[currentDrop.id]
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {claimedDrops[currentDrop.id] ? (
              <>
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Mystery Drop Claimed & Stamped!</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                <span>GPS Check-In & Claim Drop (+{currentDrop.xpReward} XP)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
