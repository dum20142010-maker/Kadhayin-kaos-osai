import React, { useState, useEffect } from 'react';
import { PassportStamp, SecretPerk } from '../types';
import { mockPassportStamps, mockSecretPerks } from '../data/mockData';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { getUserStreak } from '../services/challengeService';

export type ActionHubTab = 'passport' | 'perks' | 'radar';

interface ActionHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  initialTab?: ActionHubTab;
  onStartQuestOnMap?: (questTitle: string) => void;
  onOpenDiBlack?: () => void;
}

export const ActionHubModal: React.FC<ActionHubModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  initialTab = 'passport',
  onStartQuestOnMap,
  onOpenDiBlack,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActionHubTab>(initialTab);

  // Passport State
  const [stamps, setStamps] = useState<PassportStamp[]>(mockPassportStamps);
  const [selectedStampId, setSelectedStampId] = useState<string>(mockPassportStamps[0]?.id || '');
  const [activeZoneFilter, setActiveZoneFilter] = useState('all');

  // Secret Perks State
  const [perks] = useState<SecretPerk[]>(mockSecretPerks);
  const [activePerk, setActivePerk] = useState<SecretPerk | null>(mockSecretPerks[0]);
  const [redeemedCodes, setRedeemedCodes] = useState<Record<string, boolean>>({
    'perk-peaberry-tasting': true,
  });
  const [claiming, setClaiming] = useState(false);

  // Mood & Time Radar State
  const [userProvidedTime, setUserProvidedTime] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [budget, setBudget] = useState('₹150');
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [generatedItinerary, setGeneratedItinerary] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadStreakAndUnlockBadges() {
      let streak = 0;
      if (user?.uid) {
        streak = await getUserStreak(user.uid);
      } else {
        const storedStreak = localStorage.getItem('daily_streak_guest') || '0';
        streak = parseInt(storedStreak, 10);
      }

      const isVeteranUnlocked =
        streak >= 7 ||
        localStorage.getItem(`unlocked_badge_stamp-veteran-explorer_${user?.uid || 'guest'}`) === 'true';

      if (isVeteranUnlocked) {
        localStorage.setItem(`unlocked_badge_stamp-veteran-explorer_${user?.uid || 'guest'}`, 'true');
      }

      setStamps((prevStamps) =>
        prevStamps.map((stamp) => {
          if (stamp.id === 'stamp-veteran-explorer') {
            return {
              ...stamp,
              unlocked: isVeteranUnlocked,
              stampedDate: stamp.stampedDate || (isVeteranUnlocked ? '7-Day Streak' : ''),
            };
          }
          return stamp;
        })
      );
    }

    loadStreakAndUnlockBadges();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const selectedStamp = stamps.find((s) => s.id === selectedStampId) || stamps[0];
  const unlockedCount = stamps.filter((s) => s.unlocked).length;
  const filteredStamps = stamps.filter(
    (s) => activeZoneFilter === 'all' || s.zone === activeZoneFilter
  );

  const handleInspectStamp = (stamp: PassportStamp) => {
    triggerHaptic('light');
    setSelectedStampId(stamp.id);
  };

  const handleSimulateCheckinStamp = (stamp: PassportStamp) => {
    if (stamp.unlocked) {
      onShowToast(`Passport Stamp "${stamp.title}" already verified on-site!`, 'verified');
      return;
    }

    triggerHaptic([50, 70, 90]);
    const updated = stamps.map((s) =>
      s.id === stamp.id ? { ...s, unlocked: true, stampedDate: 'Just Now (GPS Verified)' } : s
    );
    setStamps(updated);
    onShowToast(`+${stamp.xpValue} XP • Proof-of-Discovery Minted! 🎖️`, 'military_tech');
  };

  const handleClaimPerk = (perk: SecretPerk) => {
    setClaiming(true);
    triggerHaptic('medium');

    setTimeout(() => {
      setClaiming(false);
      setRedeemedCodes((prev) => ({ ...prev, [perk.id]: true }));
      triggerHaptic([40, 70, 90]);
      onShowToast(`Secret Voucher Activated for ${perk.placeName}! Present to host. 🎟️`, 'redeem');
    }, 900);
  };

  const handleGenerateRadar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProvidedTime.trim()) {
      onShowToast('Please provide your available time (e.g. 30 mins, 2 hours)', 'schedule');
      return;
    }

    setLoadingRadar(true);
    triggerHaptic('medium');

    try {
      const prompt = `You are the DÌ AI Explorer Bot for Chennai heritage.
User Time: "${userProvidedTime}"
User Vibe: "${userPrompt || 'Aesthetic spots & heritage snacks'}"
Budget: "${budget}"

Synthesize a custom turn-by-turn walking trail that fits their exact time. Include trail name, starting checkpoint, aesthetic photo angle, secret snack pairing, and estimated XP.`;

      const res = await fetch('/api/ai/mood-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      setGeneratedItinerary({
        title: `Custom Expedition (${userProvidedTime})`,
        text: data.text || '',
      });
      triggerHaptic('legendary');
      onShowToast('Custom Walking Quest Synthesized! 🧭✨', 'auto_awesome');
    } catch {
      setGeneratedItinerary({
        title: `Mylapore Custom Expedition (${userProvidedTime})`,
        text: `🔥 Route Name: "Mylapore Heritage Stride"\n\n📍 Stop 1: Rayar's Mess - Crispy ghee podi mini idlis & brass filter coffee.\n📸 Stop 2: Kapaleeshwarar Teppakulam Steps - Sunset reflection aesthetic.\n🏛️ Stop 3: 19th-century Agraharam Walk.\n\n✨ Total Time: ${userProvidedTime} | Budget: ${budget} | Reward: +200 XP.`,
      });
      onShowToast('Synthesized contextual walking itinerary!', 'auto_awesome');
    } finally {
      setLoadingRadar(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#141418] rounded-3xl w-full max-w-xl shadow-2xl border border-orange-500/40 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unified Action Hub Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#201511] via-[#16141a] to-[#121114] border-b border-[#2d2a34] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-600/20 text-orange-400 border border-orange-500/40 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[24px]">hub</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-orange-400 font-mono tracking-widest uppercase font-bold">
                  DISCOVERY ACTION HUB
                </span>
                <span className="text-zinc-500">·</span>
                <span className="text-[10px] text-zinc-300 font-mono">
                  {unlockedCount}/8 STAMPS
                </span>
              </div>
              <h3 className="font-headline text-lg sm:text-xl text-white font-bold tracking-tight">
                {activeTab === 'passport' && 'Digital Heritage Passport'}
                {activeTab === 'perks' && 'Secret Pass & Vault Perks'}
                {activeTab === 'radar' && 'AI Mood & Time Radar'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e1e24] text-[#9898a0] flex items-center justify-center hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Action Hub Segment Switcher */}
        <div className="flex bg-[#0f0e12] p-1.5 border-b border-[#26242c] gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('passport');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'passport'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1e]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>Passport</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('perks');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'perks'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1e]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">stars</span>
            <span>Secret Perks</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('radar');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1e]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>Mood Radar</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* ================= TAB 1: DIGITAL PASSPORT ================= */}
          {activeTab === 'passport' && (
            <div className="space-y-4">
              {/* Passport Header Stats */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1c1924] to-[#141418] border border-orange-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 font-mono uppercase block">Passport Holder</span>
                  <h4 className="font-headline text-base font-bold text-white">
                    {user?.displayName || 'Chennai Explorer'}
                  </h4>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    {unlockedCount} of {stamps.length} Landmarks Minted
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-zinc-400 font-mono uppercase block">Total Points</span>
                  <span className="font-headline text-xl font-extrabold text-orange-400">
                    +{stamps.filter((s) => s.unlocked).reduce((acc, s) => acc + s.xpValue, 0)} XP
                  </span>
                </div>
              </div>

              {/* Zone Filter */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {['all', 'Mylapore', 'George Town', 'Marina', 'Triplicane', 'Special'].map((zone) => (
                  <button
                    key={zone}
                    onClick={() => {
                      setActiveZoneFilter(zone);
                      triggerHaptic('light');
                    }}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                      activeZoneFilter === zone
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-[#1a1a1e] text-zinc-400 hover:text-white border border-[#26262b]'
                    }`}
                  >
                    {zone === 'all' ? 'All Zones' : zone}
                  </button>
                ))}
              </div>

              {/* Stamps Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {filteredStamps.map((stamp) => {
                  const isSelected = selectedStamp?.id === stamp.id;
                  return (
                    <div
                      key={stamp.id}
                      onClick={() => handleInspectStamp(stamp)}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between relative min-h-28 ${
                        stamp.unlocked
                          ? 'bg-gradient-to-b from-orange-950/30 to-[#18181c] border-orange-500/50 text-white shadow-md'
                          : 'bg-[#141418] border-zinc-800 text-zinc-500 hover:border-zinc-700 opacity-65'
                      } ${isSelected ? 'ring-2 ring-orange-500' : ''}`}
                    >
                      <span className="material-symbols-outlined text-[28px] my-1 text-orange-400">
                        {stamp.icon}
                      </span>
                      <span className="text-[11px] font-bold line-clamp-1 text-zinc-200">
                        {stamp.title}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400 mt-1">
                        {stamp.unlocked ? '✓ Verified' : 'Locked'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected Stamp Inspection Card */}
              {selectedStamp && (
                <div className="p-4 rounded-2xl bg-[#18171d] border border-orange-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-400 text-[20px]">
                        {selectedStamp.icon}
                      </span>
                      <h4 className="text-sm font-bold text-white">{selectedStamp.title}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{selectedStamp.xpValue} XP
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {selectedStamp.description || 'Visit landmark location and scan via AI Live Lens to mint permanent Proof-of-Discovery stamp.'}
                  </p>

                  <div className="flex gap-2 pt-1">
                    {!selectedStamp.unlocked ? (
                      <button
                        onClick={() => handleSimulateCheckinStamp(selectedStamp)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">near_me</span>
                        <span>Verify On-Site Check-in</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/25">
                        ✓ Minted on {selectedStamp.stampedDate || 'Passport Record'}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setActiveTab('radar');
                        triggerHaptic('light');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#121114] text-zinc-300 text-xs font-semibold hover:text-white border border-zinc-700 cursor-pointer"
                    >
                      Find Next Spot
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: SECRET PASS & PERKS ================= */}
          {activeTab === 'perks' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 to-[#141418] border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 uppercase font-mono font-bold">Exclusive Partner Perks</span>
                  <h4 className="font-headline text-base font-bold text-white">Merchant Secret Vault</h4>
                  <p className="text-[11px] text-zinc-400">Flash vouchers unlocked through explorer check-ins.</p>
                </div>
                {onOpenDiBlack && (
                  <button
                    onClick={onOpenDiBlack}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white font-bold text-xs shadow-md active:scale-95 cursor-pointer"
                  >
                    VIP Pass
                  </button>
                )}
              </div>

              {/* Perks List */}
              <div className="space-y-2.5">
                {perks.map((perk) => {
                  const isClaimed = redeemedCodes[perk.id];
                  const isSelected = activePerk?.id === perk.id;

                  return (
                    <div
                      key={perk.id}
                      onClick={() => {
                        setActivePerk(perk);
                        triggerHaptic('light');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#1e1b24] border-orange-500 shadow-md'
                          : 'bg-[#15151a] border-[#26262b] hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[22px]">redeem</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{perk.perkTitle}</span>
                            <span className="text-[9px] font-mono text-orange-400 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                              {perk.placeName}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{perk.perkValue} • {perk.secretMenuDish}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isClaimed) handleClaimPerk(perk);
                        }}
                        disabled={claiming}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isClaimed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                            : 'bg-orange-600 hover:bg-orange-500 text-white shadow-md active:scale-95'
                        }`}
                      >
                        {isClaimed ? '✓ Voucher Active' : 'Claim Voucher'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 3: MOOD & TIME RADAR ================= */}
          {activeTab === 'radar' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/30 via-[#16141a] to-[#121114] border border-teal-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-400 text-[20px]">psychology</span>
                  <h4 className="text-sm font-bold text-white">AI Contextual Route Synthesizer</h4>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enter your exact free time and custom vibe. The DÌ Engine computes tailored heritage checkpoints, photo angles, and snack pairings.
                </p>
              </div>

              {/* Mood Category Selector for Dynamic Background Shifting */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Select Mood Radar Theme & Ambient Gradient
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'heritage', label: 'Heritage & Temples', icon: 'temple_hindu' },
                    { id: 'coastal', label: 'Coastal Breeze', icon: 'water' },
                    { id: 'coffee', label: 'Coffee & Spice', icon: 'coffee' },
                    { id: 'cyber', label: 'Cyber Secrets', icon: 'bolt' },
                  ].map((mood) => {
                    const currentMood = localStorage.getItem('kaos_active_mood') || 'balanced';
                    const isSelected = currentMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          localStorage.setItem('kaos_active_mood', mood.id);
                          window.dispatchEvent(new CustomEvent('kaos-mood-changed'));
                          onShowToast(`Mood Radar theme set to ${mood.label} ✨`, 'palette');
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-600 text-white border-orange-500 shadow-md font-bold'
                            : 'bg-[#15151a] text-zinc-300 border-[#26262b] hover:border-zinc-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{mood.icon}</span>
                        <span className="text-[10px] text-center">{mood.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleGenerateRadar} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Your Available Time (Free-Form)
                  </label>
                  <input
                    type="text"
                    value={userProvidedTime}
                    onChange={(e) => setUserProvidedTime(e.target.value)}
                    placeholder="e.g. 45 mins, 2 hours before sunset"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0e12] border border-zinc-700 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Vibe / Focus (Optional)
                    </label>
                    <input
                      type="text"
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder="e.g. Filter coffee & peaceful courtyards"
                      className="w-full px-3 py-2 rounded-xl bg-[#0f0e12] border border-zinc-700 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">Budget</label>
                    <input
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="e.g. ₹150"
                      className="w-full px-3 py-2 rounded-xl bg-[#0f0e12] border border-zinc-700 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingRadar}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loadingRadar ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                      <span>Synthesize Custom Expedition</span>
                    </>
                  )}
                </button>
              </form>

              {/* Generated Result */}
              {generatedItinerary && (
                <div className="p-4 rounded-2xl bg-[#0e0d11] border border-teal-500/40 space-y-3 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-teal-400 text-[18px]">temp_preferences_custom</span>
                      <span className="text-xs font-bold text-teal-300">{generatedItinerary.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Gemini Context Engine</span>
                  </div>

                  <div className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto font-sans bg-black/30 p-3 rounded-xl border border-white/5">
                    {generatedItinerary.text}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {onStartQuestOnMap && (
                      <button
                        onClick={() => {
                          onClose();
                          onStartQuestOnMap(generatedItinerary.title);
                          onShowToast('Itinerary plotted on Live Map!', 'near_me');
                        }}
                        className="py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <span className="material-symbols-outlined text-[16px]">map</span>
                        <span>Plot on Map</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onClose();
                        // Assume the user wants to see matches in explore
                        onShowToast('Deep Search archives synced with Radar results', 'auto_awesome');
                      }}
                      className="py-2.5 rounded-xl bg-[#1a1a1e] text-zinc-300 hover:text-white border border-zinc-700 font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">search</span>
                      <span>Explore Lore</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Hub Footer */}
        <div className="p-3.5 bg-[#100f13] border-t border-[#26262b] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-[11px]">DÌ Engine Connected</span>
          </div>

          <button
            onClick={() => {
              onClose();
              if (onStartQuestOnMap) onStartQuestOnMap('Chennai Heritage Corridor');
            }}
            className="text-orange-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Open Live Map</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
