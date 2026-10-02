import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, performSecureSignOut } from '../lib/firebase';
import { motion } from 'framer-motion';
import { KAOS_STAMPS, KAOS_PERKS } from '../data/kaosData';
import { sqlDb } from '../lib/sqlDatabase';
import { GlobalExplorers } from '../components/GlobalExplorers';
import { MasterSpot } from '../types';
import { validateHandle } from '../utils/handleValidation';
import { fetchBlockedUsers, unblockUser, BlockRecord, getActiveUserId } from '../services/socialService';
import { KaosAppIcon } from '../components/KaosAppIcon';

const AVAILABLE_INTERESTS = [
  'Heritage',
  'Architecture',
  'Food Lore',
  'Temple Tanks',
  'Colonial History',
  'Soundscapes',
  'Hidden Gems',
  'Photography',
  'Coffee Roasteries',
  'Sacred Cosmology',
];

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

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('kaos_user_full_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      displayName: 'Usha Baskar',
      username: 'usha_explorer',
      bio: 'Chennai heritage explorer & cartographer',
      avatar: '🛡️',
      availabilityStatus: 'Available Now',
      interests: ['Heritage', 'Architecture', 'Temple Tanks'],
    };
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(profile.displayName);
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editAvatar, setEditAvatar] = useState(profile.avatar);
  const [editStatus, setEditStatus] = useState(profile.availabilityStatus);
  const [editInterests, setEditInterests] = useState<string[]>(profile.interests || ['Heritage', 'Architecture', 'Temple Tanks']);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'favorites' | 'stamps'>('overview');
  
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

    async function loadFirestoreProfile() {
      if (!auth.currentUser) return;
      try {
        const userId = auth.currentUser.uid;
        const docRef = doc(db, 'users', userId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const loadedProfile = {
            displayName: data.displayName || data.name || auth.currentUser.displayName || profile.displayName,
            username: data.username || profile.username,
            bio: data.bio || profile.bio,
            avatar: data.avatar || profile.avatar,
            availabilityStatus: data.availabilityStatus || profile.availabilityStatus,
            interests: Array.isArray(data.interests) ? data.interests : (profile.interests || ['Heritage', 'Architecture']),
          };
          setProfile(loadedProfile);
        } else {
          // If no doc exists yet, use auth data
          const initialProfile = {
            ...profile,
            displayName: auth.currentUser.displayName || profile.displayName,
            username: auth.currentUser.email?.split('@')[0] || profile.username,
          };
          setProfile(initialProfile);
          // Auto-persist initial profile to Firestore
          await setDoc(docRef, {
            ...initialProfile,
            email: auth.currentUser.email,
            uid: userId,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Firestore profile fetch notice:', err);
      }
    }
    loadFirestoreProfile();

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

  const [handleError, setHandleError] = useState<string | null>(null);
  const [blockedList, setBlockedList] = useState<BlockRecord[]>([]);

  useEffect(() => {
    async function loadBlocked() {
      const list = await fetchBlockedUsers(getActiveUserId());
      setBlockedList(list);
    }
    loadBlocked();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const handleCheck = validateHandle(editUsername);
    if (!handleCheck.isValid) {
      setHandleError(handleCheck.error || 'Invalid handle');
      onShowToast(handleCheck.error || 'Please fix handle validation errors.');
      return;
    }

    setIsSavingFirestore(true);

    const updated = {
      displayName: editName.trim() || 'Explorer',
      username: handleCheck.normalizedHandle,
      bio: editBio.trim(),
      avatar: editAvatar || '🛡️',
      availabilityStatus: editStatus,
      interests: editInterests,
      updatedAt: new Date().toISOString(),
    };

    setProfile(updated);
    try {
      localStorage.setItem('kaos_user_full_profile', JSON.stringify(updated));
    } catch {}

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('No authenticated user found');
      
      const userDocRef = doc(db, 'users', userId);
      await setDoc(
        userDocRef,
        {
          displayName: updated.displayName,
          name: updated.displayName,
          username: updated.username,
          bio: updated.bio,
          avatar: updated.avatar,
          availabilityStatus: updated.availabilityStatus,
          interests: updated.interests,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      onShowToast('Profile & interests persisted to Firestore! 🔥');
    } catch (err: any) {
      console.warn('Firestore profile write notice:', err);
      onShowToast('Profile updated locally!');
    } finally {
      setIsSavingFirestore(false);
      setIsEditModalOpen(false);
    }
  };

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const currentLevel = Math.floor((stats?.xp || 1420) / 300) + 1;

  const handleSignOut = async () => {
    try {
      await performSecureSignOut();
    } catch (err) {
      onShowToast('Failed to disconnect signal. Please try again.');
      setShowSignOutConfirm(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 p-4 md:p-8 max-w-6xl mx-auto">
      {/* Profile Overview Card */}
      <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-[#121114] flex items-center justify-center text-3xl shadow-xl shadow-kaos-pink/20 shrink-0 overflow-hidden border border-white/10">
                {profile.avatar && (profile.avatar.startsWith('data:') || profile.avatar.startsWith('http') || profile.avatar.includes('svg')) ? (
                  <img src={profile.avatar} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{profile.avatar || '🛡️'}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 pointer-events-none">
                <KaosAppIcon size={20} withGlow={false} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{profile.displayName}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F05423]/20 text-[#F05423]">
                  Level {currentLevel} Cartographer
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {profile.availabilityStatus}
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-[#F05423] mt-0.5">
                @{profile.username.replace(/^@/, '')}
              </p>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed max-w-xl">
                {profile.bio}
              </p>
              {profile.interests && profile.interests.length > 0 && (
                <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1">
                  <span className="text-amber-400 font-bold">✨ Interests:</span>
                  <span>{profile.interests.join(' · ')}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditName(profile.displayName);
                setEditUsername(profile.username);
                setEditBio(profile.bio);
                setEditAvatar(profile.avatar);
                setEditStatus(profile.availabilityStatus);
                setEditInterests(profile.interests || ['Heritage', 'Architecture', 'Temple Tanks']);
                setIsEditModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#F05423] hover:bg-[#ff6a38] text-white font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-[#F05423]/25"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="px-3.5 py-2 rounded-xl bg-[#121114] hover:bg-rose-500/10 border border-[#26242C] text-rose-400 hover:text-rose-300 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 pt-6 border-t border-[#26242C]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackupProgress}
              className="px-3.5 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all"
              title="Download local progress backup"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Backup</span>
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all">
              <span className="material-symbols-outlined text-[16px]">upload</span>
              <span>Import</span>
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
            <div className="p-3 md:px-5 md:py-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-center min-w-[80px]">
              <p className="text-lg md:text-xl font-bold text-[#F05423] tabular-nums font-mono">
                {(stats?.xp || 1420).toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Total XP</p>
            </div>
            <div className="p-3 md:px-5 md:py-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-center min-w-[80px]">
              <p className="text-lg md:text-xl font-bold text-amber-400 tabular-nums font-mono">
                {stats?.stamps_count || KAOS_STAMPS.filter((s) => s.unlocked).length}
              </p>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Stamps</p>
            </div>
            <div className="p-3 md:px-5 md:py-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-center min-w-[80px]">
              <p className="text-lg md:text-xl font-bold text-emerald-400 tabular-nums font-mono">
                {savedPlaces.length}
              </p>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-[#26242C]">
        {[
          { id: 'overview', label: 'Overview', icon: 'person' },
          { id: 'favorites', label: 'Favorites', icon: 'favorite' },
          { id: 'stamps', label: 'Archive', icon: 'inventory_2' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-4 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 cursor-pointer flex items-center gap-2 border-b-2 ${
              activeSubTab === tab.id
                ? 'border-[#F05423] text-[#F05423] bg-[#F05423]/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {/* Global Explorers Leaderboard Component */}
            <GlobalExplorers onShowToast={onShowToast} />

            {/* Privacy & Safety Settings Section (Moved to bottom of overview) */}
            <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-[#26242C] pb-3">
                <span className="material-symbols-outlined text-[#F05423] text-lg">shield</span>
                <div>
                  <h3 className="text-base font-bold text-white">Privacy & Safety</h3>
                  <p className="text-xs text-zinc-400">Manage blocked players and social interaction safety controls</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-mono text-zinc-400 uppercase font-bold">Blocked Users ({blockedList.length})</h4>
                {blockedList.length === 0 ? (
                  <p className="text-xs text-zinc-500 bg-[#121114] border border-[#26242C] p-4 rounded-2xl text-center">
                    You haven't blocked any players.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blockedList.map((block) => (
                      <div
                        key={block.id}
                        className="p-3.5 rounded-2xl bg-[#121114] border border-[#26242C] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#1C1A1F] border border-[#26242C] flex items-center justify-center text-lg shrink-0">
                            {block.blockedAvatar || '🛡️'}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white truncate">{block.blockedName || 'Blocked Explorer'}</h5>
                            <p className="text-[10px] text-zinc-500 font-mono truncate">@{block.blockedUsername || 'blocked'}</p>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            await unblockUser(getActiveUserId(), block.blockedUserId);
                            setBlockedList((prev) => prev.filter((b) => b.blockedUserId !== block.blockedUserId));
                            onShowToast('Unblocked user. Friendship is not automatically restored.');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors shrink-0"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'favorites' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-rose-500">favorite</span>
                  <span>My Favorites</span>
                </h3>
                <p className="text-[11px] text-zinc-400">Archived heritage landmarks for your next expedition</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full font-bold">
                  {savedPlaces.length} Spots Locked
                </span>
              </div>
            </div>

            {/* List of Saved Places */}
            {savedPlaces.length === 0 ? (
              <div className="py-20 text-center rounded-3xl bg-[#1C1A1F] border border-dashed border-[#26242C] text-zinc-500">
                <span className="material-symbols-outlined text-5xl text-zinc-700 block mb-4">favorite_border</span>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No Favorites Synchronized</p>
                <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto">Tap the heart icon on any landmark dossier to archive it in your personal heritage grid.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedPlaces.map((spot) => (
                  <motion.div
                    key={spot.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => onSpotSelected?.(spot)}
                    className="bg-[#1C1A1F] border border-[#26242C] hover:border-rose-500/40 rounded-3xl overflow-hidden cursor-pointer group transition-all shadow-lg hover:shadow-rose-500/5"
                  >
                    <div className="relative h-32 w-full">
                      <img
                        src={spot.imageUrl}
                        alt={spot.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1C1A1F] to-transparent opacity-60" />
                      <button
                        onClick={(e) => handleRemoveSaved(e, spot.id)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                        title="Remove from Favorites"
                      >
                        <span className="material-symbols-outlined text-sm">favorite</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-1">
                      <h4 className="text-xs font-black text-white group-hover:text-rose-400 transition-colors truncate uppercase tracking-tight">
                        {spot.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{spot.zone} · {spot.category}</p>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                        <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                          <span className="material-symbols-outlined text-[10px]">speed</span>
                          <span>{spot.duration}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (spot.lat && spot.lng) {
                              window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`, '_blank');
                            }
                          }}
                          className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-tighter text-zinc-300 transition-all border border-white/5"
                        >
                          Navigate
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'stamps' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-400">history_edu</span>
                    <span>Stamps & Trails</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">Your documented history across the Chennai corridor</p>
                </div>
                <button
                  onClick={() => setTrailCreatorOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#F05423]/10 hover:bg-[#F05423]/20 border border-[#F05423]/40 text-[#F05423] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">hiking</span>
                  <span>Create Trail</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {KAOS_STAMPS.map((stamp) => (
                  <div
                    key={stamp.id}
                    onClick={() =>
                      onShowToast(`${stamp.title} (${stamp.rarity}) — ${stamp.description}`)
                    }
                    className={`p-4 rounded-3xl border transition-all cursor-pointer flex gap-3.5 items-center ${
                      stamp.unlocked
                        ? 'bg-[#1C1A1F] border-[#26242C] hover:border-[#F05423]/50 shadow-lg'
                        : 'bg-[#121114]/50 border-[#26242C]/40 opacity-50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#121114] border border-[#26242C] flex items-center justify-center text-2xl shrink-0">
                      {stamp.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-white truncate uppercase tracking-tighter">{stamp.title}</h4>
                        <span className="text-[8px] text-amber-400 font-black uppercase bg-amber-400/10 px-1.5 py-0.5 rounded">{stamp.rarity}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5 font-medium uppercase tracking-tight">{stamp.description}</p>
                      <p className="text-[9px] font-mono text-[#F05423] mt-1 tabular-nums font-bold">
                        +{stamp.xpValue} XP · {stamp.zone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
        )}
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

      {/* Privacy & Safety Settings Section */}
      <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-[#26242C] pb-3">
          <span className="material-symbols-outlined text-[#F05423] text-lg">shield</span>
          <div>
            <h3 className="text-base font-bold text-white">Privacy & Safety</h3>
            <p className="text-xs text-zinc-400">Manage blocked players and social interaction safety controls</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-mono text-zinc-400 uppercase font-bold">Blocked Users ({blockedList.length})</h4>
          {blockedList.length === 0 ? (
            <p className="text-xs text-zinc-500 bg-[#121114] border border-[#26242C] p-4 rounded-2xl text-center">
              You haven't blocked any players.
            </p>
          ) : (
            <div className="space-y-2">
              {blockedList.map((block) => (
                <div
                  key={block.id}
                  className="p-3.5 rounded-2xl bg-[#121114] border border-[#26242C] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#1C1A1F] border border-[#26242C] flex items-center justify-center text-lg shrink-0">
                      {block.blockedAvatar || '🛡️'}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-white truncate">{block.blockedName || 'Blocked Explorer'}</h5>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">@{block.blockedUsername || 'blocked'}</p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      await unblockUser(getActiveUserId(), block.blockedUserId);
                      setBlockedList((prev) => prev.filter((b) => b.blockedUserId !== block.blockedUserId));
                      onShowToast('Unblocked user. Friendship is not automatically restored.');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors shrink-0"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal Dialog */}
      {isEditModalOpen && (
        <div
          onClick={() => setIsEditModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F05423]">manage_accounts</span>
                <span>Edit Explorer Profile</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-bold">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#121114] border border-[#26242C] focus:border-[#F05423] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-bold">Username (@handle)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-500 font-mono text-xs">@</span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditUsername(val);
                      const res = validateHandle(val);
                      if (!res.isValid) {
                        setHandleError(res.error || null);
                      } else {
                        setHandleError(null);
                      }
                    }}
                    className={`w-full bg-[#121114] border rounded-xl pl-7 pr-3 py-2.5 text-xs text-zinc-200 focus:outline-none ${
                      handleError ? 'border-rose-500 focus:border-rose-500' : 'border-[#26242C] focus:border-[#F05423]'
                    }`}
                  />
                </div>
                {handleError && (
                  <p className="text-[11px] text-rose-400 font-medium pt-0.5 animate-in fade-in duration-150 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">error</span>
                    <span>{handleError}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-bold">Bio</label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-[#121114] border border-[#26242C] focus:border-[#F05423] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none resize-none"
                />
              </div>

              {/* Profile Picture Upload & Presets */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-bold flex items-center justify-between">
                  <span>Profile Picture / Avatar</span>
                  <span className="text-[9px] text-[#F05423] font-bold">Upload or Select</span>
                </label>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#121114] border border-[#26242C] overflow-hidden flex items-center justify-center shrink-0">
                    {editAvatar && (editAvatar.startsWith('data:') || editAvatar.startsWith('http')) ? (
                      <img src={editAvatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{editAvatar || '🛡️'}</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="px-3 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5 transition-all w-full">
                      <span className="material-symbols-outlined text-sm text-[#F05423]">add_a_photo</span>
                      <span>Upload Custom Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setEditAvatar(reader.result as string);
                              onShowToast('Updated profile photo preview!');
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Preset Avatar Photo & Emoji Row */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                  {[
                    '/app-icon.svg',
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                    '🛡️',
                    '🧭',
                    '🏛️',
                    '☕',
                    '👑',
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setEditAvatar(preset)}
                      className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                        editAvatar === preset ? 'border-[#F05423] ring-2 ring-[#F05423]/40' : 'border-[#26242C] bg-[#121114]'
                      }`}
                    >
                      {preset.startsWith('http') ? (
                        <img src={preset} alt="preset" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm">{preset}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-bold">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-[#121114] border border-[#26242C] focus:border-[#F05423] rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="Available Now">Available Now</option>
                  <option value="Away">Away</option>
                  <option value="Exploring">Exploring</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-bold flex items-center justify-between">
                  <span>Explorer Interests</span>
                  <span className="text-[9px] font-mono text-[#F05423]">Tap to toggle</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#121114] border border-[#26242C] rounded-xl max-h-32 overflow-y-auto scrollbar-thin">
                  {AVAILABLE_INTERESTS.map((interest) => {
                    const isSelected = editInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => {
                          setEditInterests((prev) =>
                            isSelected
                              ? prev.filter((i) => i !== interest)
                              : [...prev, interest]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#F05423] text-white border border-[#F05423] shadow-sm'
                            : 'bg-[#1C1A1F] text-zinc-400 border border-[#26242C] hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-zinc-400 hover:text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFirestore}
                  className="px-4 py-2 rounded-xl bg-[#F05423] hover:bg-[#ff6a38] text-white font-bold cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#F05423]/25 disabled:opacity-50"
                >
                  {isSavingFirestore && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                  <span>{isSavingFirestore ? 'Saving Firestore...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1C1A1F] border border-white/5 w-full max-w-sm rounded-3xl p-8 shadow-2xl space-y-6 text-center"
          >
            <div className="w-16 h-16 bg-rose-500/10 rounded-full mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-rose-500">logout</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Disconnect Signal?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Are you sure you want to terminate your current session? Your explorer progress is safely archived in the KAOS grid.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
