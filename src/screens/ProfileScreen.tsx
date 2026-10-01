import React, { useState, useEffect } from 'react';
import { KAOS_STAMPS, KAOS_PERKS } from '../data/kaosData';
import { sqlDb } from '../lib/sqlDatabase';
import { GlobalExplorers } from '../components/GlobalExplorers';
import { MasterSpot } from '../types';

interface ProfileScreenProps {
  onShowToast: (msg: string) => void;
  onSpotSelected?: (spot: MasterSpot) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onShowToast,
  onSpotSelected,
}) => {
  const [stats, setStats] = useState(() => sqlDb.getExplorerStats());
  const [savedPlaces, setSavedPlaces] = useState<MasterSpot[]>(() =>
    sqlDb.getSavedPlaces()
  );
  
  // Custom Trail creator popup state
  const [trailPopupOpen, setTrailCreatorOpen] = useState(false);
  const [trailName, setTrailName] = useState('');
  const [trailZone, setTrailZone] = useState('Mylapore');
  const [trailMins, setTrailMins] = useState(60);

  const refreshProfileData = () => {
    setStats(sqlDb.getExplorerStats());
    setSavedPlaces(sqlDb.getSavedPlaces());
  };

  useEffect(() => {
    refreshProfileData();

    // Re-trigger updates on storage syncing or favoriting
    const handleSavedChange = () => {
      refreshProfileData();
    };

    window.addEventListener('kaos-spot-saved-change', handleSavedChange);
    window.addEventListener('kaos-adventures-updated', handleSavedChange);
    return () => {
      window.removeEventListener('kaos-spot-saved-change', handleSavedChange);
      window.removeEventListener('kaos-adventures-updated', handleSavedChange);
    };
  }, []);

  const handleCopyCode = (code: string, perkName: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    onShowToast(`Copied code "${code}" for ${perkName}! 🎁`);
  };

  // Simple, Consumer-facing progress backups (underneath it runs SQL snapshot dumps!)
  const handleBackupProgress = () => {
    try {
      const info = sqlDb.downloadBackupFile();
      onShowToast(`Backup file created: "${info.filename}" (${info.recordsCount} records) 💾`);
    } catch {
      onShowToast('Could not create progress backup.');
    }
  };

  const handleImportProgress = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = sqlDb.restoreDatabaseJson(json);
        if (res.success) {
          onShowToast('Progress successfully restored! ❤️');
          refreshProfileData();
        } else {
          onShowToast(`Failed to restore backup: ${res.message}`);
        }
      } catch {
        onShowToast('Invalid backup file selected.');
      }
    };
    reader.readAsText(file);
  };

  // Handle removing a saved spot from the profile tab
  const handleRemoveSaved = (e: React.MouseEvent, spotId: string) => {
    e.stopPropagation();
    sqlDb.toggleSavePlace(spotId);
    onShowToast('Removed from saved places.');
    refreshProfileData();
  };

  // Create a Custom Trail (underneath seeds SQL adventures)
  const handleCreateTrailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trailName.trim()) {
      onShowToast('Please enter a trail name.');
      return;
    }
    
    const stopsCount = Math.floor(3 + Math.random() * 3);
    const distanceKm = parseFloat((2.0 + Math.random() * 3.5).toFixed(1));
    const xpReward = stopsCount * 50 + 100;

    sqlDb.createCustomTrail(
      trailName.trim(),
      trailZone,
      trailMins,
      distanceKm,
      stopsCount,
      xpReward
    );

    onShowToast(`Custom Trail "${trailName}" successfully saved to your index! 🧭`);
    setTrailName('');
    setTrailCreatorOpen(false);
    refreshProfileData();
  };

  const currentLevel = Math.floor((stats?.xp || 1420) / 300) + 1;

  return (
    <div className="space-y-6 pb-24 p-4 md:p-8 max-w-6xl mx-auto">
      {/* Profile Overview Card */}
      <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F05423] to-[#FF8A00] flex items-center justify-center text-3xl shadow-xl shadow-[#F05423]/25 shrink-0">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Usha Baskar</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F05423]/20 text-[#F05423]">
                  Level {currentLevel} Cartographer
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Chennai Coromandel Sector · {stats?.streak || 5} Days Active Streak
              </p>
            </div>
          </div>

          {/* Simple Data Sync & Backup Action row (Consumer terminology!) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackupProgress}
              className="px-3.5 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all"
              title="Download local progress backup"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Backup Progress</span>
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all">
              <span className="material-symbols-outlined text-[16px]">upload</span>
              <span>Import Progress</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportProgress}
                className="hidden"
              />
            </label>
          </div>

          {/* Tabular Stats Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 shrink-0">
            <div className="p-3 md:px-5 md:py-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-center">
              <p className="text-lg md:text-xl font-bold text-[#F05423] tabular-nums font-mono">
                {(stats?.xp || 1420).toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Total XP</p>
            </div>
            <div className="p-3 md:px-5 md:py-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-center">
              <p className="text-lg md:text-xl font-bold text-amber-400 tabular-nums font-mono">
                {stats?.stamps_count || KAOS_STAMPS.filter((s) => s.unlocked).length}
              </p>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Stamps</p>
            </div>
            <div className="p-3 md:px-5 md:py-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-center">
              <p className="text-lg md:text-xl font-bold text-emerald-400 tabular-nums font-mono">
                {savedPlaces.length}
              </p>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Explorers Leaderboard Component */}
      <GlobalExplorers onShowToast={onShowToast} />

      {/* Saved Places and Custom Trails Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Landmarks & Custom Itineraries */}
        <div className="lg:col-span-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#F05423]">favorite</span>
                <span>My Saved Places</span>
              </h3>
              <p className="text-[11px] text-zinc-400">Landmarks you bookmarked for future exploration</p>
            </div>

            <button
              onClick={() => setTrailCreatorOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#F05423]/10 hover:bg-[#F05423]/20 border border-[#F05423]/40 text-[#F05423] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">hiking</span>
              <span>Create Trail</span>
            </button>
          </div>

          {/* List of Saved Places */}
          {savedPlaces.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#1C1A1F] border border-[#26242C] text-zinc-500">
              <span className="material-symbols-outlined text-3xl text-zinc-600 block mb-1">bookmark_border</span>
              <p className="text-xs font-bold text-zinc-400">No saved landmarks yet</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Click the heart button on any place details to save here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {savedPlaces.map((spot) => (
                <div
                  key={spot.id}
                  onClick={() => onSpotSelected?.(spot)}
                  className="bg-[#1C1A1F] border border-[#26242C] hover:border-[#F05423]/40 rounded-2xl p-3 flex gap-3.5 items-center cursor-pointer group"
                >
                  <img
                    src={spot.imageUrl}
                    alt={spot.title}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-xs font-bold text-white group-hover:text-[#F05423] transition-colors truncate">
                      {spot.title}
                    </h4>
                    <p className="text-[10px] text-zinc-400 truncate">{spot.zone} · {spot.distance}</p>
                    
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (spot.lat && spot.lng) {
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`, '_blank');
                          }
                        }}
                        className="text-[9px] font-mono text-orange-400 hover:text-orange-300 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">directions</span>
                        <span>Navigate</span>
                      </button>

                      <button
                        onClick={(e) => handleRemoveSaved(e, spot.id)}
                        className="text-[9px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">delete</span>
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Walking Trails List */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Passport Stamps Collection</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KAOS_STAMPS.map((stamp) => (
                <div
                  key={stamp.id}
                  onClick={() =>
                    onShowToast(`${stamp.title} (${stamp.rarity}) — ${stamp.description}`)
                  }
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-3.5 items-center ${
                    stamp.unlocked
                      ? 'bg-[#1C1A1F] border-[#26242C] hover:border-[#F05423]/50'
                      : 'bg-[#121114]/50 border-[#26242C]/40 opacity-50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#121114] border border-[#26242C] flex items-center justify-center text-2xl shrink-0">
                    {stamp.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate">{stamp.title}</h4>
                      <span className="text-[10px] text-amber-400 font-semibold">{stamp.rarity}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{stamp.description}</p>
                    <p className="text-[10px] font-mono text-[#F05423] mt-1 tabular-nums">
                      +{stamp.xpValue} XP · {stamp.zone}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unlocked Secret Perks (Coupons & Voucher Claim Panel) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-amber-400">redeem</span>
              <span>Secret Vouchers</span>
            </h3>
            <span className="text-xs text-amber-400 font-semibold">Active Perks</span>
          </div>

          <div className="space-y-3">
            {KAOS_PERKS.map((perk) => (
              <div
                key={perk.id}
                className="bg-gradient-to-br from-[#1C1A1F] to-[#26242C] border border-amber-500/30 rounded-3xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-400 font-bold uppercase">{perk.zone}</span>
                  <span className="text-zinc-300 font-semibold">{perk.perkValue}</span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{perk.placeName}</h4>
                  <p className="text-xs text-zinc-300 mt-0.5">{perk.perkTitle}</p>
                  <p className="text-[11px] text-zinc-400 italic mt-0.5">"{perk.secretMenuDish}"</p>
                </div>

                <div className="p-3 rounded-2xl bg-black/60 border border-[#26242C] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold">Secret Code</p>
                    <p className="text-xs font-mono font-bold text-[#F05423] truncate">
                      {perk.secretCode}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyCode(perk.secretCode, perk.placeName)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#F05423] hover:bg-[#ff6a38] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simplified Custom Trail Builder Modal/Popup */}
      {trailPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#1C1A1F] border border-[#26242C] w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#F05423]">hiking</span>
                <span>Create Custom Trail</span>
              </h3>
              <button
                onClick={() => setTrailCreatorOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Design a personalized discovery walk in Chennai. Your trail will be synthesized and recorded inside your active missions index!
            </p>

            <form onSubmit={handleCreateTrailSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-bold">Trail Name</label>
                <input
                  type="text"
                  required
                  value={trailName}
                  onChange={(e) => setTrailName(e.target.value)}
                  placeholder="e.g. Traditional Food Walk, Mylapore Sunset Trail"
                  className="w-full bg-[#121114] border border-[#26242C] focus:border-[#F05423] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-bold">Zone Sector</label>
                  <select
                    value={trailZone}
                    onChange={(e) => setTrailZone(e.target.value)}
                    className="w-full bg-[#121114] border border-[#26242C] focus:border-[#F05423] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="Mylapore">Mylapore</option>
                    <option value="Chepauk">Chepauk</option>
                    <option value="George Town">George Town</option>
                    <option value="Triplicane">Triplicane</option>
                    <option value="Besant Nagar">Besant Nagar</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-bold">Duration (Mins)</label>
                  <select
                    value={trailMins}
                    onChange={(e) => setTrailMins(Number(e.target.value))}
                    className="w-full bg-[#121114] border border-[#26242C] focus:border-[#F05423] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="45">45 Mins</option>
                    <option value="60">60 Mins</option>
                    <option value="90">90 Mins</option>
                    <option value="120">120 Mins</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTrailCreatorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-zinc-400 hover:text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F05423] hover:bg-[#ff6a38] text-white font-bold cursor-pointer"
                >
                  Synthesize Trail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
