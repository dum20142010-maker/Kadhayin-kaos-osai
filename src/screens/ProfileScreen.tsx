import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserAccount } from '../hooks/useUserAccount';
import { mockPassportStamps } from '../data/mockData';
import { triggerHaptic } from '../lib/haptic';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProfileScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPassport?: () => void;
  onOpenSecretPass?: () => void;
  onOpenDiBlack?: () => void;
  onOpenTerritories?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onShowToast,
  onOpenPassport,
  onOpenSecretPass,
  onOpenDiBlack,
  onOpenTerritories,
}) => {
  const { user, userProfile: authUserProfile, isVip: authIsVip, logout, refreshProfile } = useAuth();
  const { profile: liveProfile, updateProfile } = useUserAccount();
  
  const activeProfile = liveProfile || authUserProfile;
  
  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [displayName, setDisplayName] = useState(activeProfile?.displayName || user?.displayName || '');
  const [username, setUsername] = useState(activeProfile?.username || '');
  const [bio, setBio] = useState(activeProfile?.bio || '');
  const [pronouns, setPronouns] = useState(activeProfile?.pronouns || '');
  const [location, setLocation] = useState(activeProfile?.location || 'Chennai, India');
  const [website, setWebsite] = useState(activeProfile?.website || '');
  const [interests, setInterests] = useState<string[]>(activeProfile?.interests || ['Heritage', 'Architecture', 'Filter Coffee']);
  const [newInterestInput, setNewInterestInput] = useState('');
  const [photoURL, setPhotoURL] = useState(activeProfile?.photoURL || user?.photoURL || '');
  const [coverUrl, setCoverUrl] = useState(activeProfile?.coverUrl || '');

  // Username availability feedback
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // File input refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Set Status state: 'Available Now' vs 'Away'
  const [availabilityStatus, setAvailabilityStatus] = useState<'Available Now' | 'Away'>(
    (activeProfile?.availabilityStatus as 'Available Now' | 'Away') || 'Available Now'
  );
  const [statusUpdating, setStatusUpdating] = useState(false);

  // VIP Status state
  const isVip = authIsVip;
  const blackMemberId = activeProfile?.blackMemberId || (user ? localStorage.getItem(`kaos_vip_member_id_${user.uid}`) || '' : '');

  // Haptic Intensity state: 'Low' | 'Medium' | 'High'
  const [hapticIntensity, setHapticIntensity] = useState<'Low' | 'Medium' | 'High'>(() => {
    return (activeProfile?.hapticIntensity as 'Low' | 'Medium' | 'High') || 
           (localStorage.getItem('kaos_haptic_intensity') as 'Low' | 'Medium' | 'High') || 
           'Medium';
  });

  useEffect(() => {
    if (activeProfile?.hapticIntensity) {
      setHapticIntensity(activeProfile.hapticIntensity as 'Low' | 'Medium' | 'High');
      localStorage.setItem('kaos_haptic_intensity', activeProfile.hapticIntensity);
    }
  }, [activeProfile]);

  const handleUpdateHapticIntensity = async (level: 'Low' | 'Medium' | 'High') => {
    setHapticIntensity(level);
    localStorage.setItem('kaos_haptic_intensity', level);
    triggerHaptic('medium');

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { hapticIntensity: level }, { merge: true });
        await refreshProfile();
      } catch (err) {
        console.warn('Firestore haptic intensity save deferred:', err);
      }
    }

    onShowToast(`Haptic intensity set to ${level} 📳`, 'vibration');
  };

  // Keep local fields in sync with activeProfile updates
  useEffect(() => {
    if (activeProfile) {
      if (activeProfile.displayName !== undefined) setDisplayName(activeProfile.displayName);
      if (activeProfile.username !== undefined) setUsername(activeProfile.username);
      if (activeProfile.bio !== undefined) setBio(activeProfile.bio);
      if (activeProfile.pronouns !== undefined) setPronouns(activeProfile.pronouns);
      if (activeProfile.location !== undefined) setLocation(activeProfile.location);
      if (activeProfile.website !== undefined) setWebsite(activeProfile.website);
      if (activeProfile.interests !== undefined) setInterests(activeProfile.interests);
      if (activeProfile.photoURL !== undefined) setPhotoURL(activeProfile.photoURL);
      if (activeProfile.coverUrl !== undefined) setCoverUrl(activeProfile.coverUrl);
      if (activeProfile.availabilityStatus) setAvailabilityStatus(activeProfile.availabilityStatus as 'Available Now' | 'Away');
    }
  }, [activeProfile]);

  // Handle Set Status toggle: 'Available Now' <=> 'Away'
  const handleToggleStatus = async () => {
    const nextStatus: 'Available Now' | 'Away' =
      availabilityStatus === 'Available Now' ? 'Away' : 'Available Now';
    
    setAvailabilityStatus(nextStatus);
    triggerHaptic('medium');
    setStatusUpdating(true);

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            availabilityStatus: nextStatus,
            isOnline: nextStatus === 'Available Now',
            lastStatusUpdate: new Date().toISOString(),
          },
          { merge: true }
        );
        await refreshProfile();
      } catch (err: any) {
        console.warn('Firestore status update deferred:', err?.message || err);
      } finally {
        setStatusUpdating(false);
      }
    } else {
      setStatusUpdating(false);
    }

    onShowToast(
      nextStatus === 'Available Now'
        ? 'Status set to Available Now 🟢'
        : 'Status set to Away ⚪',
      nextStatus === 'Available Now' ? 'check_circle' : 'do_not_disturb_on'
    );
  };

  // Validate and check username availability
  const handleUsernameChange = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(clean);

    if (!clean || clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    if (clean === activeProfile?.username) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    try {
      const q = query(collection(db, 'users'), where('username', '==', clean));
      const snap = await getDocs(q);
      let taken = false;
      snap.forEach((docSnap) => {
        if (docSnap.id !== user?.uid) taken = true;
      });

      if (taken) {
        setUsernameStatus('taken');
      } else {
        setUsernameStatus('available');
      }
    } catch {
      setUsernameStatus('available');
    }
  };

  // Handle Image Upload with validation (< 5MB, image/*)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('Unsupported image format. Please use JPG, PNG, or WebP.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onShowToast('Image is too large. Maximum size is 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      if (type === 'avatar') {
        setPhotoURL(dataUrl);
        onShowToast('Profile picture loaded for preview 📸', 'photo_camera');
      } else {
        setCoverUrl(dataUrl);
        onShowToast('Cover banner loaded for preview 🌅', 'image');
      }
      triggerHaptic('medium');
    };
    reader.readAsDataURL(file);
  };

  // Add Interest
  const handleAddInterest = () => {
    const trimmed = newInterestInput.trim();
    if (!trimmed) return;
    if (interests.length >= 8) {
      onShowToast('Maximum 8 interests allowed.', 'warning');
      return;
    }
    if (interests.map(i => i.toLowerCase()).includes(trimmed.toLowerCase())) {
      onShowToast('Interest already added.', 'warning');
      return;
    }
    setInterests([...interests, trimmed]);
    setNewInterestInput('');
    triggerHaptic('light');
  };

  // Remove Interest
  const handleRemoveInterest = (idx: number) => {
    setInterests(interests.filter((_, i) => i !== idx));
    triggerHaptic('light');
  };

  // Save Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      onShowToast('Display name cannot be empty.', 'error');
      return;
    }

    if (usernameStatus === 'taken') {
      onShowToast('Username is already taken. Please choose another.', 'error');
      return;
    }

    if (website.trim() && !website.startsWith('http://') && !website.startsWith('https://')) {
      onShowToast('Website must be a valid URL starting with http:// or https://', 'error');
      return;
    }

    setIsSaving(true);
    triggerHaptic('medium');

    if (user) {
      try {
        const payload = {
          displayName: displayName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          pronouns: pronouns.trim(),
          location: location.trim(),
          website: website.trim(),
          interests,
          photoURL: photoURL.trim(),
          coverUrl: coverUrl.trim(),
          updatedAt: new Date().toISOString(),
        };

        const success = await updateProfile(payload);
        if (success) {
          setIsEditing(false);
          onShowToast('Profile updated successfully! 🎖️', 'check_circle');
          triggerHaptic([50, 100, 150]);
        } else {
          onShowToast('Unable to save profile. Please try again.', 'error');
        }
      } catch (err: any) {
        console.warn('Profile save error:', err);
        onShowToast('Unable to save profile. Please try again.', 'error');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsSaving(false);
      onShowToast('No authenticated user found.', 'error');
    }
  };

  // Cancel with unsaved changes check
  const handleCancelEdit = () => {
    if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
      // Revert local state to activeProfile
      if (activeProfile) {
        setDisplayName(activeProfile.displayName || '');
        setUsername(activeProfile.username || '');
        setBio(activeProfile.bio || '');
        setPronouns(activeProfile.pronouns || '');
        setLocation(activeProfile.location || 'Chennai, India');
        setWebsite(activeProfile.website || '');
        setInterests(activeProfile.interests || ['Heritage', 'Architecture']);
        setPhotoURL(activeProfile.photoURL || '');
        setCoverUrl(activeProfile.coverUrl || '');
      }
      setIsEditing(false);
      triggerHaptic('light');
      onShowToast('Changes discarded.', 'info');
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      onShowToast('Signed out successfully', 'logout');
      triggerHaptic('light');
    } catch {
      onShowToast('Sign out failed', 'error');
    }
  };

  const unlockedStamps = mockPassportStamps.filter((s) => s.unlocked).length;

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-4 space-y-6">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={avatarInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleImageUpload(e, 'avatar')}
      />
      <input
        type="file"
        ref={coverInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleImageUpload(e, 'cover')}
      />

      {/* Header */}
      <div className="pt-4 pb-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="material-symbols-outlined text-[16px] text-[#F05423]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            account_circle
          </span>
          <span className="text-xs text-[#F05423] uppercase tracking-widest font-bold">
            KAOS Explorer Credentials & Vault
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-headline text-3xl text-white">Identity Dossier</h1>
          {!isEditing ? (
            <button
              onClick={() => {
                setIsEditing(true);
                triggerHaptic('medium');
              }}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer border border-orange-400/40"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit Profile</span>
            </button>
          ) : (
            <button
              onClick={handleCancelEdit}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* EDIT PROFILE MODAL / VIEW */}
      {isEditing ? (
        <form onSubmit={handleSaveProfile} className="space-y-6 bg-[#18181c] rounded-3xl border-2 border-orange-500/60 p-5 sm:p-7 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/40">
                <span className="material-symbols-outlined text-[22px]">badge</span>
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-white">Edit Your Explorer Profile</h3>
                <p className="text-xs text-zinc-400">Customize how you appear across the KAOS DiscoverIt network</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-mono font-bold">
              SECURE PERSISTENCE
            </span>
          </div>

          {/* 1. Profile Picture & Cover Image */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">image</span>
              <span>Visual Branding & Cover</span>
            </h4>

            {/* Cover Banner Preview */}
            <div className="relative h-36 sm:h-44 rounded-2xl overflow-hidden bg-[#121214] border border-zinc-700 group">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-orange-950/60 via-zinc-900 to-amber-950/40 flex items-center justify-center text-zinc-500 text-xs">
                  <span>No cover banner uploaded</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold flex items-center gap-1 cursor-pointer border border-white/20 shadow"
                >
                  <span className="material-symbols-outlined text-[14px]">add_a_photo</span>
                  <span>Change Cover</span>
                </button>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverUrl('');
                      triggerHaptic('light');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer border border-red-500/30"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* Avatar Row */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-600 to-amber-600 text-white flex items-center justify-center font-bold text-2xl border-2 border-orange-500/50 shadow-xl shrink-0">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{displayName ? displayName.charAt(0).toUpperCase() : 'E'}</span>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <span className="text-xs font-bold text-white block">Profile Picture (Avatar)</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    <span>Upload New Photo</span>
                  </button>
                  {photoURL && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoURL('');
                        triggerHaptic('light');
                        onShowToast('Profile picture removed. Default avatar restored.', 'info');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-zinc-700"
                    >
                      <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                      <span>Remove Profile Picture</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500">Supports JPG, PNG, WebP up to 5MB.</p>
              </div>
            </div>
          </div>

          {/* 2. Basic Information (Display Name & Username) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#26262b]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                <span>Display Name</span>
                <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                required
                placeholder="e.g. Maya Explorer"
                className="w-full bg-[#121214] text-white text-xs px-3.5 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
              />
              <p className="text-[10px] text-zinc-500">Publicly visible name across your profile and quests.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>Username (@handle)</span>
                {usernameStatus === 'available' && (
                  <span className="text-[10px] text-emerald-400 font-bold">✓ Username available</span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-[10px] text-red-400 font-bold">✕ Username already taken</span>
                )}
                {usernameStatus === 'checking' && (
                  <span className="text-[10px] text-orange-400 font-mono">Checking...</span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  maxLength={20}
                  placeholder="chennai_explorer"
                  className="w-full bg-[#121214] text-white text-xs pl-8 pr-3.5 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500 transition-all font-mono"
                />
              </div>
              <p className="text-[10px] text-zinc-500">Unique identifier for social discovery and mentions.</p>
            </div>
          </div>

          {/* 3. About / Bio & Pronouns / Location */}
          <div className="space-y-4 pt-2 border-t border-[#26262b]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-zinc-300">Bio / About Me</label>
                <span className={`text-[10px] font-mono ${bio.length > 250 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {bio.length}/300 chars
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Tell people something about yourself, your heritage passion, or favorite spots in Chennai..."
                className="w-full bg-[#121214] text-white text-xs p-3.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500 transition-all leading-relaxed resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Pronouns</label>
                <input
                  type="text"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  maxLength={30}
                  placeholder="e.g. she/her, he/him"
                  className="w-full bg-[#121214] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Location / Neighborhood</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Mylapore, Chennai"
                  className="w-full bg-[#121214] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Website / Personal Link</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://explorer.in"
                  className="w-full bg-[#121214] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 4. Interests / Hobbies Tag Manager */}
          <div className="space-y-2.5 pt-2 border-t border-[#26262b]">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span>Interests & Hobbies</span>
              <span className="text-[10px] text-zinc-500">{interests.length}/8 tags</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newInterestInput}
                onChange={(e) => setNewInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInterest();
                  }
                }}
                maxLength={25}
                placeholder="Add interest (e.g. Photography, Temples) & press Enter"
                className="flex-1 bg-[#121214] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={handleAddInterest}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700 active:scale-95 transition-all"
              >
                Add Tag
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium"
                >
                  <span>{interest}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(idx)}
                    className="w-4 h-4 rounded-full hover:bg-orange-500/30 flex items-center justify-center text-orange-400 hover:text-white transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 5. Live Profile Preview */}
          <div className="space-y-2 pt-2 border-t border-[#26262b]">
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">
              Live Profile Preview
            </span>
            <div className="rounded-2xl bg-[#121214] border border-zinc-700 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-orange-600 to-amber-600 text-white flex items-center justify-center font-bold text-base shrink-0 border border-orange-400/40 shadow">
                  {photoURL ? (
                    <img src={photoURL} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span>{displayName ? displayName.charAt(0).toUpperCase() : 'E'}</span>
                  )}
                </div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{displayName || 'Explorer Name'}</span>
                    {pronouns && <span className="text-[10px] text-zinc-400 font-mono font-normal">({pronouns})</span>}
                  </h4>
                  <span className="text-[11px] font-mono text-orange-400">
                    @{username || 'username'} {location ? `• ${location}` : ''}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-300 italic">
                "{bio || 'No bio added yet...'}"
              </p>
              {interests.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {interests.map((i, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px]">
                      {i}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save / Cancel Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#26262b]">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition-all active:scale-95"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border border-orange-400/40"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isSaving ? 'sync' : 'save'}
              </span>
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* NORMAL PROFILE VIEW */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KAOS BLACK VIP MEMBERSHIP CARD */}
          {isVip ? (
            <div
              onClick={onOpenDiBlack}
              className="relative w-full rounded-3xl p-6 bg-gradient-to-br from-[#1d1b22] via-[#0e0d10] to-[#18171c] border border-[#F05423]/50 shadow-2xl cursor-pointer group hover:border-[#F05423] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(240,84,35,0.15)_0%,transparent_60%)] pointer-events-none"></div>

              <div className="flex justify-between items-start z-10 relative">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-[#F05423] text-white font-extrabold text-sm tracking-wider">
                    KAOS
                  </div>
                  <span className="font-headline text-lg font-bold text-white tracking-widest">BLACK</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold font-mono border border-emerald-500/30">
                    VIP ACTIVE
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#F05423] text-[22px] group-hover:scale-110 transition-transform">
                  diamond
                </span>
              </div>

              <div className="mt-8 z-10 relative flex justify-between items-end">
                <div>
                  <span className="font-mono text-xs text-zinc-400 tracking-wider block mb-0.5">
                    {blackMemberId || 'KAOS-VIP-0882-MAA'}
                  </span>
                  <div className="flex items-center gap-2">
                      <span className="font-headline text-base font-bold text-white">
                        {activeProfile?.displayName || displayName}
                      </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        availabilityStatus === 'Available Now'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : 'bg-zinc-500'
                      }`}
                      title={`Status: ${availabilityStatus}`}
                    ></span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-zinc-500 uppercase block font-mono">Perks Active</span>
                  <span className="text-xs font-bold text-emerald-400">2x XP • Offline Topo</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={onOpenDiBlack}
              className="relative w-full rounded-3xl p-5 bg-gradient-to-r from-[#1a171f] via-[#141418] to-[#121114] border border-[#2d2a34] hover:border-orange-500/50 shadow-xl cursor-pointer group transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block font-mono">
                      KAOS Explorer Tier
                    </span>
                    <h3 className="font-headline text-base font-bold text-white">
                      Unlock KAOS Black VIP Status
                    </h3>
                  </div>
                </div>

                <button className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-bold shadow group-hover:scale-105 transition-all">
                  Upgrade Tier
                </button>
              </div>
            </div>
          )}

          {/* Profile Card & Bio / Details */}
          <div className="bg-[#18181c] rounded-3xl border border-[#26262b] p-6 shadow-xl space-y-5">
            {/* Cover & Avatar Header */}
            <div className="relative rounded-2xl overflow-hidden bg-[#121214] border border-zinc-800">
              <div className="h-28 sm:h-36 w-full">
                {activeProfile?.coverUrl ? (
                  <img src={activeProfile.coverUrl} alt="Cover Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-orange-950/40 via-zinc-900 to-amber-950/30" />
                )}
              </div>

              <div className="px-5 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12">
                <div className="flex items-end gap-4">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-600 to-amber-600 text-white flex items-center justify-center font-bold text-3xl border-4 border-[#18181c] shadow-2xl shrink-0">
                    {activeProfile?.photoURL ? (
                      <img src={activeProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(activeProfile?.displayName || displayName || 'E').charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="space-y-0.5 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-headline text-xl sm:text-2xl font-bold text-white">
                        {activeProfile?.displayName || displayName || 'Explorer'}
                      </h2>
                      {activeProfile?.pronouns && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                          {activeProfile.pronouns}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-orange-400 block">
                      @{activeProfile?.username || 'explorer'} {activeProfile?.location ? `• ${activeProfile.location}` : ''}
                    </span>
                  </div>
                </div>

                {/* Status Toggle Button */}
                <button
                  onClick={handleToggleStatus}
                  disabled={statusUpdating}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow transition-all cursor-pointer ${
                    availabilityStatus === 'Available Now'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                  }`}
                  title="Toggle Online Status"
                >
                  <span className={`w-2 h-2 rounded-full ${availabilityStatus === 'Available Now' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  <span>{availabilityStatus}</span>
                </button>
              </div>
            </div>

            {/* Bio section */}
            <div className="bg-[#121214] p-4 rounded-2xl border border-[#26262b] space-y-1.5">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block font-mono">
                About / Bio
              </span>
              <p className="text-sm text-zinc-200 leading-relaxed">
                {activeProfile?.bio || 'Exploring heritage trails across Chennai. Tap Edit Profile to add your personal bio.'}
              </p>
              {activeProfile?.website && (
                <div className="pt-1">
                  <a
                    href={activeProfile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1 font-mono"
                  >
                    <span className="material-symbols-outlined text-[14px]">link</span>
                    <span>{activeProfile.website}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Interests tags */}
            {activeProfile?.interests && activeProfile.interests.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                  Interests & Hobbies
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeProfile.interests.map((interest: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300 text-xs font-semibold"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Haptic Feedback Intensity Settings Card */}
          <div className="bg-[#121214] p-4 rounded-2xl border border-[#26262b] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-400 text-[20px]">vibration</span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Haptic Feedback Intensity</h4>
                  <p className="text-[11px] text-zinc-400">Adjust tactile vibration feedback level for app interactions.</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/25 px-2.5 py-1 rounded-lg">
                {hapticIntensity}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['Low', 'Medium', 'High'] as const).map((level) => {
                const isSelected = hapticIntensity === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleUpdateHapticIntensity(level)}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-500 shadow-md'
                        : 'bg-[#18181c] text-zinc-300 border-[#26262b] hover:border-orange-500/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {level === 'Low' ? 'wifi_1_bar' : level === 'Medium' ? 'wifi_2_bar' : 'wifi_3_bar'}
                    </span>
                    <span>{level}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Action Hub: Passport, Secret Pass, Territories */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={onOpenPassport}
              className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b] hover:border-orange-500/50 flex items-center justify-between group cursor-pointer transition-all shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">passport</span>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-white block">Passport Vault</span>
                  <span className="text-[10px] text-zinc-400">{unlockedStamps} Stamps Unlocked</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-zinc-600 group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
            </button>

            <button
              onClick={onOpenSecretPass}
              className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b] hover:border-orange-500/50 flex items-center justify-between group cursor-pointer transition-all shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-white block">Secret Pass</span>
                  <span className="text-[10px] text-zinc-400">Hidden Heritage Perks</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-zinc-600 group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
            </button>

            <button
              onClick={onOpenTerritories}
              className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b] hover:border-orange-500/50 flex items-center justify-between group cursor-pointer transition-all shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">public</span>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-white block">Territories</span>
                  <span className="text-[10px] text-zinc-400">District Leaderboards</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-zinc-600 group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
            </button>
          </div>

          {/* Account / Session Sign Out */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign Out ({user?.email || 'Explorer'})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
