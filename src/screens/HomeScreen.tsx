import React, { useState } from 'react';
import { Discovery } from '../types';
import { mockMysteryDrops } from '../data/mockData';
import { ALL_UNIFIED_MAP_SPOTS, mapSpotToDiscovery } from '../data/allUnifiedSpots';
import { useAuth } from '../context/AuthContext';
import { SpatialAudioBar } from '../components/SpatialAudioBar';
import { triggerHaptic } from '../lib/haptic';

interface HomeScreenProps {
  onOpenDossier: (disc: Discovery) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateTab: (tab: any) => void;
  onOpenLiveLens?: () => void;
  onOpenPassport?: () => void;
  onOpenSecretPass?: () => void;
  onOpenMoodRadar?: () => void;
  onOpenMysteryDrop?: () => void;
  onOpenTerritories?: () => void;
  onOpenDiBlack?: () => void;
  onOpenAiPlanner?: (clusterKey?: string) => void;
  onOpenMasterBrowser?: () => void;
  onOpenQuestGenerator?: (place?: any) => void;
  onOpenDailyChallenge?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenDossier,
  onShowToast,
  onNavigateTab,
  onOpenLiveLens,
  onOpenPassport,
  onOpenSecretPass,
  onOpenMoodRadar,
  onOpenMysteryDrop,
  onOpenTerritories,
  onOpenDiBlack,
  onOpenAiPlanner,
  onOpenMasterBrowser,
  onOpenQuestGenerator,
  onOpenDailyChallenge,
}) => {

  const { user } = useAuth();
  const [hapticOn, setHapticOn] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Daily Streak Check-in State
  const [streakClaimed, setStreakClaimed] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(14);
  const [streakPoints, setStreakPoints] = useState(1280);

  const handleClaimStreak = () => {
    if (!streakClaimed) {
      setStreakClaimed(true);
      setCurrentStreak(prev => prev + 1);
      setStreakPoints(prev => prev + 50);
      onShowToast('+50 Daily Streak Explorer Points Claimed! 🔥', 'local_fire_department');
      triggerHaptic('medium');
    } else {
      onShowToast('Today’s streak bonus already claimed. Come back tomorrow!', 'task_alt');
    }
  };

  // AI Smart Recommendation logic
  const [smartRec, setSmartRec] = useState<{ zone: string; reason: string } | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  React.useEffect(() => {
    async function fetchSmartRec() {
      setLoadingRec(true);
      try {
        const timeOfDay = new Date().getHours();
        const moods = ['curious', 'hungry', 'aesthetic', 'adventurous'];
        const randomMood = moods[Math.floor(Math.random() * moods.length)];

        const res = await fetch('/api/ai/smart-recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeOfDay: timeOfDay < 12 ? 'Morning' : timeOfDay < 17 ? 'Afternoon' : 'Evening',
            mood: randomMood
          }),
        });
        const data = await res.json();
        if (data.text) {
          setSmartRec(JSON.parse(data.text));
        }
      } catch (e) {
        console.warn('Smart Rec Error:', e);
      } finally {
        setLoadingRec(false);
      }
    }
    fetchSmartRec();
  }, []);

  const toggleBookmark = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarks(prev => {
      const next = !prev[title];
      onShowToast(next ? `Saved "${title}" to Field Journal` : `Removed from Field Journal`, next ? 'bookmark_added' : 'bookmark_remove');
      return { ...prev, [title]: next };
    });
  };

  const allDiscoveries = ALL_UNIFIED_MAP_SPOTS.map(mapSpotToDiscovery);
  const heroDiscovery = allDiscoveries[0] || allDiscoveries[1];
  const curatedList = allDiscoveries.slice(1, 9);
  const activeMysteryDrop = mockMysteryDrops[0];

  const filteredCurated = curatedList.filter(d => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'food' && d.categoryKey === 'food') return true;
    if (selectedCategory === 'heritage' && d.categoryKey === 'heritage') return true;
    if (selectedCategory === 'architecture' && d.categoryKey === 'architecture') return true;
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-24 space-y-5 max-w-4xl mx-auto px-4 bg-[#121114] text-zinc-100">
      {/* Top Status & Haptic Bar */}
      <div className="pt-3 pb-1 flex items-center justify-between text-xs text-zinc-500 border-b border-[#26242c]">
        <div className="flex items-center gap-2 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F05423] animate-pulse shadow-[0_0_6px_#F05423]"></span>
          <span className="text-[#A19C9A]">SYS // TACTILE_FEEDBACK: ACTIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDiBlack}
            className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#F05423] bg-[#1A191E] px-2.5 py-1 rounded-lg border border-[#2D2A34] hover:border-[#F05423] hover:shadow-[0_0_8px_rgba(240,84,35,0.25)] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[13px]">diamond</span>
            <span>KAOS VIP PASS</span>
          </button>
          <button
            onClick={() => {
              setHapticOn(!hapticOn);
              onShowToast(hapticOn ? 'Haptic feedback disabled' : 'Haptic feedback enabled', 'vibration');
            }}
            className="text-orange-400 hover:text-orange-300 font-mono font-bold transition-colors cursor-pointer"
          >
            {hapticOn ? '[ MUTE_HAPTICS ]' : '[ ENABLE_HAPTICS ]'}
          </button>
        </div>
      </div>

      {/* AI SMART EXPLORER RECOMMENDATION */}
      {(smartRec || loadingRec) && (
        <section className="bg-gradient-to-br from-teal-900/30 to-[#121214] rounded-2xl p-5 border border-teal-500/30 shadow-md animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-widest">DÌ_EXPLORER_ADVISORY</span>
            </div>
            {loadingRec && <span className="material-symbols-outlined animate-spin text-teal-400 text-[16px]">progress_activity</span>}
          </div>
          
          {loadingRec ? (
            <div className="space-y-2">
              <div className="h-4 bg-zinc-800 rounded-md w-3/4 animate-pulse"></div>
              <div className="h-3 bg-zinc-800 rounded-md w-1/2 animate-pulse"></div>
            </div>
          ) : smartRec && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-white font-bold text-base flex items-center gap-1.5">
                  Recommendation: <span className="text-teal-300">{smartRec.zone}</span>
                </h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed italic">
                  "{smartRec.reason}"
                </p>
              </div>
              <button 
                onClick={() => {
                  onNavigateTab('map');
                  onShowToast(`Exploring ${smartRec.zone}`, 'explore');
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-600/20 text-teal-300 border border-teal-500/40 text-[10px] font-bold hover:bg-teal-600 hover:text-white transition-all shrink-0 cursor-pointer"
              >
                Go There
              </button>
            </div>
          )}
        </section>
      )}

      {/* Chennai Atmospheric Weather & Live Radar Card */}
      <section className="bg-[#1a1a1e] rounded-2xl p-5 border border-[#26262b] flex items-center justify-between gap-4 shadow-sm hover:border-orange-500/30 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              wb_sunny
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-2xl text-white font-extrabold tracking-tight">32°C</span>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 border border-orange-500/20 rounded-md uppercase tracking-wider font-bold">
                MARINA_ZONE_01 // AQI_42
              </span>
            </div>
            <p className="text-xs text-[#9898a0] mt-1.5 font-sans">Optimal Morning Walk Index • Coromandel Coast</p>
          </div>
        </div>
        <button
          onClick={onOpenTerritories}
          className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
        >
          Mayorships
        </button>
      </section>
      {/* 1,000+ MASTER CATALOG & AI EXPEDITION PLANNER BANNER */}
      <section className="bg-gradient-to-r from-orange-950/40 via-[#1a1a1e] to-[#121214] rounded-2xl p-5 border border-orange-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-600/20 text-orange-400 border border-orange-500/40 flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">database</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 border border-orange-500/20 rounded-md uppercase">
                1,000+ VERIFIED PLACES
              </span>
              <span className="text-[#9898a0] text-xs">Chennai & Surrounding Region</span>
            </div>
            <h3 className="font-headline text-lg text-white font-bold mt-1">Master Places & Quest Catalog</h3>
            <p className="text-xs text-[#9898a0] mt-0.5">
              Explore 1,000 heritage sites, food gems, architectural landmarks & hidden trails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={onOpenMasterBrowser}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">travel_explore</span>
            <span>Browse 1,000+ Catalog</span>
          </button>

          {onOpenAiPlanner && (
            <button
              onClick={() => onOpenAiPlanner()}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-orange-400 border border-orange-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>AI Route</span>
            </button>
          )}
        </div>
      </section>

      {/* QUICK LAUNCH POWER DOCK */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onOpenLiveLens}
          className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/40 hover:shadow-lg transition-all active:scale-[0.98] group cursor-pointer text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-3 border border-orange-500/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              photo_camera
            </span>
          </div>
          <span className="text-xs font-bold text-white block">AI Live Lens</span>
          <span className="text-[10px] text-[#9898a0] block mt-0.5">Live Vision Scan</span>
        </button>

        <button
          onClick={onOpenPassport}
          className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/40 hover:shadow-lg transition-all active:scale-[0.98] group cursor-pointer text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-3 border border-orange-500/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              menu_book
            </span>
          </div>
          <span className="text-xs font-bold text-white block">Passport</span>
          <span className="text-[10px] text-[#9898a0] block mt-0.5">4 Stamps Minted</span>
        </button>

        <button
          onClick={onOpenSecretPass}
          className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/40 hover:shadow-lg transition-all active:scale-[0.98] group cursor-pointer text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-3 border border-orange-500/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              stars
            </span>
          </div>
          <span className="text-xs font-bold text-white block">Secret Pass</span>
          <span className="text-[10px] text-[#9898a0] block mt-0.5">Perks Unlocked</span>
        </button>

        <button
          onClick={onOpenMoodRadar}
          className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/40 hover:shadow-lg transition-all active:scale-[0.98] group cursor-pointer text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-3 border border-orange-500/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              cyclone
            </span>
          </div>
          <span className="text-xs font-bold text-white block">Mood Radar</span>
          <span className="text-[10px] text-[#9898a0] block mt-0.5">Fast Trail Route</span>
        </button>
      </section>

      {/* DAILY DISCOVERY CHALLENGE CARD (24-Hour AI Knowledge Quest) */}
      <section className="bg-gradient-to-r from-amber-950/40 via-[#1a1a1e] to-[#121214] rounded-2xl p-5 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-amber-500 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 rounded-md uppercase tracking-wider">
                24-HR DAILY QUEST
              </span>
              <span className="text-emerald-400 text-[11px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active Today</span>
              </span>
            </div>
            <h4 className="font-headline text-lg text-white font-bold mt-1 tracking-tight">
              Daily Discovery Challenge
            </h4>
            <p className="text-xs text-[#9898a0] mt-0.5">
              Generates 1 unique learning quest every 24 hours • +175 XP & Streak Multiplier
            </p>
          </div>
        </div>

        <button
          onClick={onOpenDailyChallenge}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shrink-0 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">quiz</span>
          <span>Launch 24-Hr Quest (+175 XP)</span>
        </button>
      </section>

      {/* Spatial Soundscape Audio Bar */}
      <SpatialAudioBar onShowToast={onShowToast} />

      {/* SUNDAY MYSTERY FLASH DROP CARD */}
      <section className="bg-[#1a1a1e] rounded-2xl p-5 border border-[#26262b] hover:border-orange-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 animate-pulse shadow-md">
            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">LIVE CITY FLASH HUNT</span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-400 text-xs font-mono">
                {activeMysteryDrop.remainingClaims} / {activeMysteryDrop.totalClaims} UNITS AVAILABLE
              </span>
            </div>
            <h4 className="font-headline text-lg text-white font-bold mt-1 tracking-tight">{activeMysteryDrop.title}</h4>
            <p className="text-xs text-[#9898a0] mt-0.5">{activeMysteryDrop.secretReward}</p>
          </div>
        </div>

        <button
          onClick={onOpenMysteryDrop}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shrink-0 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">travel_explore</span>
          <span>Launch Scanner (+300 XP)</span>
        </button>
      </section>

      {/* Daily Explorer Streak Card */}
      <section className="bg-[#1a1a1e] rounded-2xl p-5 border border-[#26262b] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-headline text-xl text-white font-bold tracking-tight">{currentStreak} Day Explorer Streak</span>
              <span className="text-xs text-orange-400 font-mono font-bold tracking-wider">
                +{streakPoints} XP
              </span>
            </div>
            <p className="text-xs text-[#9898a0] mt-1 font-sans">
              {streakClaimed ? 'Streak secured! Walk 1 km today for tomorrow multiplier.' : 'Claim required to lock in +50 XP bonus multipliers.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleClaimStreak}
          disabled={streakClaimed}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
            streakClaimed
              ? 'bg-[#26262b] text-emerald-400 border border-emerald-500/30 cursor-default'
              : 'bg-orange-600 hover:bg-orange-500 text-white active:scale-[0.98]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {streakClaimed ? 'check_circle' : 'bolt'}
          </span>
          <span>{streakClaimed ? 'Secured' : 'Claim XP'}</span>
        </button>
      </section>

      {/* Hero Featured Expedition of the Day */}
      <section className="space-y-3 pt-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs text-orange-400 font-mono font-bold uppercase tracking-widest block">// ARCHITECTURAL_CROWN_JEWEL</span>
            <h2 className="font-headline text-2xl text-white font-extrabold leading-tight max-w-xl text-wrap-balance">Featured Field Dossier</h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">SYS_UPDATED // DAILY_06:00</span>
        </div>

        <div
          onClick={() => onOpenDossier(heroDiscovery)}
          className="relative w-full rounded-3xl overflow-hidden bg-[#1a1a1e] border border-orange-500/25 shadow-2xl cursor-pointer group hover:border-orange-500 transition-all duration-300 flex flex-col"
        >
          <div className="relative h-64 sm:h-72 w-full overflow-hidden">
            {!imgErrors[heroDiscovery.id] ? (
              <img
                src={heroDiscovery.imageUrl}
                alt={heroDiscovery.title}
                referrerPolicy="no-referrer"
                onError={() => setImgErrors(prev => ({ ...prev, [heroDiscovery.id]: true }))}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-950/20 to-zinc-900 flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-orange-400 text-3xl mb-1">image_not_supported</span>
                <span className="text-xs text-[#9898a0] font-semibold">{heroDiscovery.title}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-[#121214]/30 to-transparent"></div>

            {/* Unboxed Metadata Badge Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold shadow-sm text-white">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
              <span>{heroDiscovery.zone}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-emerald-400 font-mono">+{heroDiscovery.xp} XP</span>
            </div>

            <button
              onClick={(e) => toggleBookmark(heroDiscovery.title, e)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:text-orange-400 border border-white/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: bookmarks[heroDiscovery.title] ? "'FILL' 1" : "'FILL' 0" }}>
                {bookmarks[heroDiscovery.title] ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>
          </div>

          <div className="p-6 relative z-10 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-[#9898a0]">
              <span>{heroDiscovery.duration}</span>
              <span className="text-zinc-700">·</span>
              <span>{heroDiscovery.distance}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-orange-400 font-semibold">{heroDiscovery.architecturalStyle || heroDiscovery.category}</span>
            </div>

            <h3 className="font-headline text-2xl text-white font-bold leading-tight group-hover:text-orange-400 transition-colors">
              {heroDiscovery.title}
            </h3>

            <p className="text-xs text-[#9898a0] leading-relaxed line-clamp-2">
              {heroDiscovery.description}
            </p>

            <div className="pt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#26262b] text-[11px] text-[#9898a0]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateTab('map');
                    onShowToast(`Routing to ${heroDiscovery.title}`, 'location_on');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">location_on</span>
                  <span>View on Map</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenLiveLens) onOpenLiveLens();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                  <span>AR Scan</span>
                </button>
              </div>

              <span className="text-xs font-bold text-orange-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform ml-auto">
                <span>Unlock Dossier</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Pills Filter & Curated Feed */}
      <section className="space-y-4 pt-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-headline text-xl text-white font-bold">Curated Chennai Trails</h3>
          <button
            onClick={() => onNavigateTab('explore')}
            className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View All 24 Gems</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        </div>

        {/* Category Pills Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'All Curated', icon: 'auto_stories' },
            { id: 'heritage', label: 'Heritage Lore', icon: 'history_edu' },
            { id: 'food', label: 'Food Lore & Roasters', icon: 'coffee' },
            { id: 'architecture', label: 'Indo-Saracenic Arches', icon: 'domain' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                triggerHaptic('light');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-orange-600 text-white border-orange-500 shadow-md'
                  : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white hover:border-[#32323a]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Discovery Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredCurated.map((disc) => (
            <div
              key={disc.id}
              onClick={() => onOpenDossier(disc)}
              className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/40 transition-all cursor-pointer flex gap-4 shadow-sm group"
            >
              <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-zinc-900 relative">
                {!imgErrors[disc.id] ? (
                  <img
                    src={disc.imageUrl}
                    alt={disc.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors(prev => ({ ...prev, [disc.id]: true }))}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-950/10 to-zinc-900 flex items-center justify-center p-2 text-center">
                    <span className="material-symbols-outlined text-orange-400 text-lg">image_not_supported</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-[11px]">
                    <span className="text-orange-400 font-bold uppercase tracking-wider">{disc.zone}</span>
                    <span className="text-emerald-400 font-mono font-bold">+{disc.xp} XP</span>
                  </div>
                  <h4 className="font-headline text-sm font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                    {disc.title}
                  </h4>
                  <p className="text-[11px] text-[#9898a0] line-clamp-2 mt-1 leading-relaxed">
                    {disc.description}
                  </p>
                </div>

                {/* Integrated Feature Fast-Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-800/60 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateTab('map');
                      onShowToast(`Routing map to ${disc.title}`, 'location_on');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">map</span>
                    <span>Map</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenLiveLens) onOpenLiveLens();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                    <span>AR Lens</span>
                  </button>

                  <span className="ml-auto text-orange-400 font-semibold text-[10px] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Dossier <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
