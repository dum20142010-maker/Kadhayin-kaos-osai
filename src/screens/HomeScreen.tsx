import React, { useState } from 'react';
import { MasterSpot } from '../types';
import { KAOS_SPOTS } from '../data/kaosData';
import { MobileBottomSheet } from '../components/MobileBottomSheet';

interface HomeScreenProps {
  onShowToast: (msg: string) => void;
  onNavigateTab: (tab: 'explore' | 'map' | 'assistant' | 'messages' | 'friends' | 'profile') => void;
  onSelectSpot: (spot: MasterSpot) => void;
  onStartQuest: (quest: any) => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
  userLevel?: number;
  userXp?: number;
  userName?: string;
  userAvatar?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onShowToast,
  onNavigateTab,
  onSelectSpot,
  onStartQuest,
  onOpenNotifications,
  unreadNotificationsCount = 2,
  userLevel = 12,
  userXp = 3400,
  userName = 'Usha Baskar',
  userAvatar = '🛡️',
}) => {
  const [selectedSpotForSheet, setSelectedSpotForSheet] = useState<MasterSpot | null>(null);

  // Featured Daily Hero Quest
  const featuredQuest = {
    id: 'hero-quest-1',
    title: 'Mylapore Sacred Geometry & Tank Alignment',
    zone: 'Mylapore',
    difficulty: 'Moderate',
    xpReward: 350,
    estimatedMins: 30,
    description: 'Decipher 7th-century acoustic gopuram shadows at Kapaleeshwarar temple tank before the evening aarti.',
    spot: KAOS_SPOTS[0],
  };

  // Recent in-progress exploration spots
  const continueSpots = [KAOS_SPOTS[0], KAOS_SPOTS[1]];
  // Recommended spots
  const recommendedSpots = [KAOS_SPOTS[2], KAOS_SPOTS[3] || KAOS_SPOTS[0]];

  const nextLevelXp = (userLevel + 1) * 300;
  const currentLevelMinXp = userLevel * 300;
  const xpInCurrentLevel = Math.max(0, userXp - currentLevelMinXp);
  const xpNeeded = 300;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeeded) * 100));

  return (
    <div className="space-y-6 pb-24 p-4 md:p-8 max-w-xl mx-auto md:max-w-4xl font-sans">
      {/* 1. Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('profile')}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F05423] to-[#FF8A00] flex items-center justify-center text-2xl shadow-md shadow-[#F05423]/25 shrink-0 cursor-pointer"
          >
            {userAvatar}
          </button>
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
              Vanakkam • Welcome Back
            </span>
            <h2 className="text-lg font-extrabold text-white tracking-tight leading-none mt-0.5">
              {userName}
            </h2>
          </div>
        </div>

        <button
          onClick={onOpenNotifications}
          className="relative w-10 h-10 rounded-2xl bg-[#1C1A1F] border border-[#26242C] hover:border-[#F05423]/50 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-all shadow-sm"
          title="Notifications"
        >
          <span className="material-symbols-outlined text-xl">notifications</span>
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F05423] text-white text-[9px] font-mono font-bold flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. Main Hero Quest Card (Prominent & Actionable) */}
      <div className="bg-gradient-to-br from-[#1C1A1F] via-[#241F28] to-[#121114] border border-[#F05423]/40 rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#F05423]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <span className="px-3 py-1 rounded-full bg-[#F05423]/20 border border-[#F05423]/40 text-[#F05423] text-[10px] font-mono font-extrabold uppercase tracking-wider">
            Featured Quest • {featuredQuest.zone}
          </span>
          <span className="text-amber-400 font-extrabold text-xs font-mono bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            +{featuredQuest.xpReward} XP
          </span>
        </div>

        <div className="space-y-1.5 relative z-10">
          <h3 className="text-lg md:text-xl font-black text-white tracking-tight leading-snug">
            {featuredQuest.title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {featuredQuest.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#26242C]/80 relative z-10">
          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
            <span>⏱️ {featuredQuest.estimatedMins} mins</span>
            <span>⚡ {featuredQuest.difficulty}</span>
          </div>

          <button
            onClick={() => onStartQuest(featuredQuest)}
            className="px-5 py-2.5 rounded-2xl bg-[#F05423] hover:bg-[#ff6a38] text-white font-extrabold text-xs cursor-pointer transition-all shadow-lg shadow-[#F05423]/30 flex items-center gap-1.5"
          >
            <span>Start Quest</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* 3. Continue Exploring Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-zinc-400 font-bold tracking-wider">
            Continue Exploring
          </h3>
          <button
            onClick={() => onNavigateTab('explore')}
            className="text-[11px] text-[#F05423] font-bold hover:underline cursor-pointer"
          >
            View Map →
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
          {continueSpots.map((spot) => (
            <div
              key={spot.id}
              onClick={() => setSelectedSpotForSheet(spot)}
              className="snap-start shrink-0 w-64 bg-[#1C1A1F] border border-[#26242C] hover:border-[#F05423]/40 rounded-2xl p-3.5 space-y-2 cursor-pointer transition-all shadow-lg"
            >
              <div className="relative h-28 rounded-xl overflow-hidden bg-[#121114]">
                <img
                  src={spot.imageUrl}
                  alt={spot.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-mono font-bold text-amber-400">
                  +{spot.xp} XP
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white truncate">{spot.title}</h4>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{spot.zone} • {spot.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Discover Something New */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase text-zinc-400 font-bold tracking-wider">
          Discover Something New
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendedSpots.map((spot) => (
            <div
              key={spot.id}
              onClick={() => setSelectedSpotForSheet(spot)}
              className="p-3.5 rounded-2xl bg-[#1C1A1F] border border-[#26242C] hover:border-[#F05423]/40 transition-all flex items-center gap-3 cursor-pointer shadow-md"
            >
              <img
                src={spot.imageUrl}
                alt={spot.title}
                className="w-14 h-14 rounded-xl object-cover border border-[#26242C] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">{spot.title}</h4>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">{spot.zone} • {spot.category}</p>
                <span className="text-[9px] font-mono text-[#F05423] font-bold mt-1 inline-block">
                  +{spot.xp} XP Available
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Compact Level & XP Progress */}
      <div className="bg-[#1C1A1F] border border-[#26242C] rounded-2xl p-4 space-y-2 shadow-md">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#F05423] text-sm">workspace_premium</span>
            <span>Level {userLevel} Cartographer</span>
          </span>
          <span className="font-mono text-zinc-400 text-[11px]">
            {userXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#121114] overflow-hidden border border-[#26242C]">
          <div
            className="h-full bg-gradient-to-r from-[#F05423] to-amber-400 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 6. Friends Activity Snapshot */}
      <div className="bg-[#1C1A1F] border border-[#26242C] rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-zinc-400 font-bold tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-emerald-400 text-sm">groups</span>
            <span>Squad Activity</span>
          </h3>
          <button
            onClick={() => onNavigateTab('friends')}
            className="text-[11px] text-[#F05423] font-bold hover:underline cursor-pointer"
          >
            Find Friends →
          </button>
        </div>

        <div className="p-3 rounded-xl bg-[#121114] border border-[#26242C] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1C1A1F] border border-[#26242C] flex items-center justify-center text-lg shrink-0">
            🏛️
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white font-bold truncate">Priya Raj</p>
            <p className="text-[10px] text-zinc-400 truncate">Unlocked <span className="text-amber-400">Sacred Tank Specialist</span> badge</p>
          </div>
          <span className="text-[9px] font-mono text-zinc-500 shrink-0">1h ago</span>
        </div>
      </div>

      {/* 7. AI Companion Quick Entry Point */}
      <div
        onClick={() => onNavigateTab('assistant')}
        className="p-4 rounded-2xl bg-gradient-to-r from-[#F05423]/15 via-[#1C1A1F] to-[#1C1A1F] border border-[#F05423]/40 flex items-center justify-between gap-3 cursor-pointer shadow-xl hover:border-[#F05423] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F05423] text-white flex items-center justify-center text-xl shadow-md shadow-[#F05423]/30">
            🤖
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Ask KAOS AI Companion</h4>
            <p className="text-[10px] text-zinc-400">Instant story context & landmark clues</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-zinc-400 text-sm">chevron_right</span>
      </div>

      {/* Spot Detail Mobile Bottom Sheet */}
      <MobileBottomSheet
        isOpen={!!selectedSpotForSheet}
        onClose={() => setSelectedSpotForSheet(null)}
        title={selectedSpotForSheet?.title}
        subtitle={`${selectedSpotForSheet?.zone} • ${selectedSpotForSheet?.category}`}
      >
        {selectedSpotForSheet && (
          <div className="space-y-4">
            <img
              src={selectedSpotForSheet.imageUrl}
              alt={selectedSpotForSheet.title}
              className="w-full h-44 object-cover rounded-2xl border border-[#26242C]"
            />
            <p className="text-xs text-zinc-300 leading-relaxed italic">
              "{selectedSpotForSheet.fullStory || selectedSpotForSheet.description}"
            </p>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-[#121114] border border-[#26242C]">
                <p className="text-[9px] font-mono text-zinc-500 uppercase font-bold">Reward</p>
                <p className="text-xs font-extrabold text-amber-400">+{selectedSpotForSheet.xp} XP</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#121114] border border-[#26242C]">
                <p className="text-[9px] font-mono text-zinc-500 uppercase font-bold">Category</p>
                <p className="text-xs font-extrabold text-white">{selectedSpotForSheet.category}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const spot = selectedSpotForSheet;
                setSelectedSpotForSheet(null);
                onSelectSpot(spot);
              }}
              className="w-full py-3 rounded-2xl bg-[#F05423] hover:bg-[#ff6a38] text-white font-extrabold text-xs cursor-pointer shadow-lg shadow-[#F05423]/25 flex items-center justify-center gap-2"
            >
              <span>Explore Landmark Details</span>
              <span className="material-symbols-outlined text-sm">near_me</span>
            </button>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
};
