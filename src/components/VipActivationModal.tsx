import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { triggerHaptic } from '../lib/haptic';

interface VipActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const VipActivationModal: React.FC<VipActivationModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const { user, refreshProfile } = useAuth();
  
  // VIP State: default is false (per-user isolation, non-active by default)
  const [isVipActive, setIsVipActive] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('');
  const [activatedAt, setActivatedAt] = useState<string | null>(null);

  // Terms acceptance checkbox state
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<boolean>(false);

  // Active perks toggles for VIP members
  const [doubleXpEnabled, setDoubleXpEnabled] = useState<boolean>(true);
  const [offlineMapsEnabled, setOfflineMapsEnabled] = useState<boolean>(true);

  // Sync authenticated user's real VIP status from Firestore per-user on open/user change
  useEffect(() => {
    if (!isOpen) return;

    setShowDeactivateConfirm(false);

    if (user) {
      // Check user-scoped cache first
      try {
        const userCacheKey = `kaos_vip_active_${user.uid}`;
        const cached = localStorage.getItem(userCacheKey);
        if (cached !== null) {
          setIsVipActive(JSON.parse(cached));
        }
        const cachedMemberId = localStorage.getItem(`kaos_vip_member_id_${user.uid}`);
        if (cachedMemberId) setMemberId(cachedMemberId);
      } catch {
        // Fallback to false
      }

      // Fetch per-user document directly from Firestore
      const fetchVipStatus = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            const active = Boolean(data.isVip);
            setIsVipActive(active);
            if (data.blackMemberId) setMemberId(data.blackMemberId);
            if (data.vipActivatedAt) setActivatedAt(data.vipActivatedAt);
            
            // Scope cache specifically to this authenticated UID
            localStorage.setItem(`kaos_vip_active_${user.uid}`, JSON.stringify(active));
            if (data.blackMemberId) localStorage.setItem(`kaos_vip_member_id_${user.uid}`, data.blackMemberId);
          } else {
            setIsVipActive(false);
          }
        } catch (err) {
          console.warn('Could not sync VIP status from Firestore:', err);
        }
      };
      fetchVipStatus();
    } else {
      // Unauthenticated visitor is strictly non-VIP
      setIsVipActive(false);
      setMemberId('');
      setActivatedAt(null);
      setTermsAccepted(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Handle intentional VIP Activation with user consent
  const handleAcceptAndActivateVip = async () => {
    if (!user) {
      triggerHaptic('medium');
      onShowToast('Please sign in or create an account to activate your VIP Pass.', 'account_circle');
      return;
    }

    if (!termsAccepted) {
      triggerHaptic('light');
      onShowToast('Please read and check the Terms & Conditions to proceed.', 'warning');
      return;
    }

    setIsProcessing(true);
    triggerHaptic('medium');

    const newMemberId = memberId || `KAOS-VIP-${Math.floor(1000 + Math.random() * 9000)}-MAA`;
    const nowIso = new Date().toISOString();

    try {
      // 1. Update component state and user-scoped storage
      setIsVipActive(true);
      setMemberId(newMemberId);
      setActivatedAt(nowIso);
      localStorage.setItem(`kaos_vip_active_${user.uid}`, JSON.stringify(true));
      localStorage.setItem(`kaos_vip_member_id_${user.uid}`, newMemberId);
      localStorage.setItem(`kaos_vip_activated_at_${user.uid}`, nowIso);

      // 2. Persist to Firestore user document only upon intentional interaction
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          isVip: true,
          vipTermsAccepted: true,
          vipTermsVersion: '1.2',
          vipActivatedAt: nowIso,
          blackMemberId: newMemberId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      await refreshProfile();

      triggerHaptic([40, 70, 100]);
      onShowToast('VIP Status Activated! Welcome to KAOS Black 💎 (+500 XP)', 'verified_user');
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error activating VIP status in database:', err);
      setIsProcessing(false);
      onShowToast('VIP activated for session (Cloud sync deferred)', 'cloud_off');
    }
  };

  // Handle intentional VIP Deactivation / Revocation
  const handleDeactivateVip = async () => {
    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      setIsVipActive(false);
      if (user) {
        localStorage.setItem(`kaos_vip_active_${user.uid}`, JSON.stringify(false));
      }

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            isVip: false,
            vipTermsAccepted: false,
            vipDeactivatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        await refreshProfile();
      }

      setShowDeactivateConfirm(false);
      setIsProcessing(false);
      triggerHaptic('light');
      onShowToast('VIP status deactivated. You can reactivate anytime.', 'info');
    } catch (err) {
      console.error('Error deactivating VIP status:', err);
      setIsProcessing(false);
      setIsVipActive(false);
      setShowDeactivateConfirm(false);
    }
  };

  const handleCancel = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#141418] rounded-3xl w-full max-w-lg shadow-2xl border border-[#32323a] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-black via-[#18171d] to-black border-b border-[#2d2a34] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F05423] to-black text-white border border-[#F05423]/40 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-[26px]">diamond</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#A19C9A] font-mono tracking-widest uppercase font-bold">
                  Explorer Tier
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isVipActive
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {isVipActive ? 'VIP ACTIVE' : 'NON-ACTIVE (OPTIONAL)'}
                </span>
              </div>
              <h3 className="font-headline text-xl text-white font-bold">KAOS Black VIP Membership</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e1e24] text-[#9898a0] flex items-center justify-center hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {isVipActive ? (
            /* ================= ACTIVE VIP PASS CARD VIEW ================= */
            <>
              {/* Obsidian Metallic Matte VIP Card */}
              <div className="relative w-full h-52 rounded-3xl p-6 bg-gradient-to-br from-[#1d1b22] via-[#0e0d10] to-[#18171c] border border-[#F05423]/40 shadow-2xl flex flex-col justify-between overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(240,84,35,0.18)_0%,transparent_60%)] pointer-events-none"></div>

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-lg bg-[#F05423] text-white font-extrabold text-sm tracking-wider">
                      KAOS
                    </div>
                    <span className="font-headline text-lg font-bold text-white tracking-widest">BLACK</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/30">
                      ACTIVE
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[#F05423] text-[24px]">contactless</span>
                </div>

                <div className="z-10">
                  <div className="font-mono text-xs tracking-widest text-zinc-300 mb-1">
                    {memberId || 'KAOS-VIP-0882-MAA'}
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[9px] text-[#A19C9A] uppercase block font-mono">Passholder</span>
                      <span className="font-headline text-sm font-bold text-white">
                        {user?.displayName || 'Coromandel Chronicler'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#A19C9A] uppercase block font-mono">Status</span>
                      <span className="font-mono text-xs text-emerald-400 font-bold">Lifetime Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Perks List */}
              <div className="space-y-2.5">
                <span className="text-[10px] text-[#A19C9A] uppercase font-bold tracking-wider block">
                  Active VIP Privileges
                </span>

                <div className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">bolt</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">2x Explorer XP Multiplier</h4>
                      <p className="text-[11px] text-[#9898a0]">Double progression on every verified walk</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDoubleXpEnabled(!doubleXpEnabled);
                      triggerHaptic('light');
                      onShowToast(doubleXpEnabled ? '2x XP booster paused' : '2x XP booster active!', 'bolt');
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      doubleXpEnabled
                        ? 'bg-orange-600 text-white border-orange-500'
                        : 'bg-[#121214] text-[#9898a0] border-[#26262b]'
                    }`}
                  >
                    {doubleXpEnabled ? 'Active' : 'Off'}
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-600/20 text-teal-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">download_for_offline</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Offline 3D Vector Topo Maps</h4>
                      <p className="text-[11px] text-[#9898a0]">Zero data connectivity needed in back alleys</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setOfflineMapsEnabled(!offlineMapsEnabled);
                      triggerHaptic('light');
                      onShowToast(offlineMapsEnabled ? 'Offline cache disabled' : 'Offline 3D Map cached (48 MB)', 'check');
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      offlineMapsEnabled
                        ? 'bg-teal-600 text-white border-teal-500'
                        : 'bg-[#121214] text-[#9898a0] border-[#26262b]'
                    }`}
                  >
                    {offlineMapsEnabled ? 'Cached' : 'Download'}
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">key</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Restricted Estate Invitations</h4>
                    <p className="text-[11px] text-[#9898a0]">Private access to 19th-century colonial private archives</p>
                  </div>
                </div>
              </div>

              {/* Deactivation Management */}
              <div className="pt-2">
                {showDeactivateConfirm ? (
                  <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 space-y-3">
                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                      <span>Are you sure you want to deactivate VIP?</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Your VIP perks will be revoked. You may reactivate at any time by accepting terms again.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeactivateVip}
                        disabled={isProcessing}
                        className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                      >
                        {isProcessing ? 'Deactivating...' : 'Confirm Deactivation'}
                      </button>
                      <button
                        onClick={() => setShowDeactivateConfirm(false)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
                      >
                        Keep VIP
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeactivateConfirm(true)}
                    className="w-full py-2.5 rounded-xl bg-[#1a1a1e] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold border border-[#26262b] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    <span>Deactivate VIP Status</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* ================= NON-ACTIVE VIP ACTIVATION FLOW ================= */
            <>
              {/* VIP Benefits Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/30 via-[#1c1a22] to-[#141418] border border-orange-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-400 text-[20px]">stars</span>
                  <h4 className="text-sm font-bold text-white">Unlock Exclusive Explorer Privileges</h4>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  KAOS Black is a specialized VIP Tier for explorers mapping Chennai heritage. Activation is voluntary and requires explicit agreement to our field protocols.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-[#121114] border border-[#26242c] flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-orange-400 text-[18px]">bolt</span>
                    <span className="text-xs text-zinc-200 font-semibold">2x Explorer XP Boost</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#121114] border border-[#26242c] flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-teal-400 text-[18px]">download_for_offline</span>
                    <span className="text-xs text-zinc-200 font-semibold">Offline Topo Maps</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#121114] border border-[#26242c] flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-purple-400 text-[18px]">key</span>
                    <span className="text-xs text-zinc-200 font-semibold">Private Estate Invites</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#121114] border border-[#26242c] flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">military_tech</span>
                    <span className="text-xs text-zinc-200 font-semibold">VIP Identity Badge</span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-[16px] text-orange-400">gavel</span>
                    <span>VIP Terms & Conditions (v1.2)</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Required for Activation</span>
                </div>

                <div className="h-44 p-3.5 rounded-2xl bg-[#0e0d11] border border-[#26242c] overflow-y-auto space-y-3 text-xs text-zinc-400 leading-relaxed font-sans scrollbar-thin">
                  <p className="font-semibold text-zinc-200">
                    Please review the following binding guidelines before joining the KAOS Black VIP Tier:
                  </p>
                  
                  <div className="space-y-2">
                    <div>
                      <h5 className="font-bold text-orange-400">1. Voluntary Opt-In & Independent Choice</h5>
                      <p className="text-[11px]">
                        VIP status is 100% voluntary and never auto-assigned or granted without your explicit opt-in. Basic city navigation and standard quests remain permanently available to all registered users regardless of VIP status.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-bold text-orange-400">2. Heritage Code of Field Conduct</h5>
                      <p className="text-[11px]">
                        VIP Passholders agree to preserve physical monuments, strictly respect photography regulations in sacred temples and gopurams, and avoid trespassing on private residential courtyards during field walks.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-bold text-orange-400">3. On-Device Telemetry & Privacy</h5>
                      <p className="text-[11px]">
                        GPS proximity features and trail milestone verification are computed locally on your device. Your precise coordinates are never sold, rented, or broadcasted to third parties.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-bold text-orange-400">4. Instant Revocation & Zero Penalty</h5>
                      <p className="text-[11px]">
                        You retain the sovereign right to deactivate your VIP membership at any moment with a single tap in your Identity Dossier, immediately restoring standard tier status with zero data loss.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <label
                onClick={() => {
                  triggerHaptic('light');
                  setTermsAccepted(!termsAccepted);
                }}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all select-none ${
                  termsAccepted
                    ? 'bg-orange-950/20 border-orange-500/50 text-white'
                    : 'bg-[#1a1a1e] border-[#26262b] text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-lg mt-0.5 flex items-center justify-center border transition-all ${
                    termsAccepted
                      ? 'bg-orange-600 border-orange-500 text-white'
                      : 'bg-[#121114] border-zinc-700'
                  }`}
                >
                  {termsAccepted && (
                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                  )}
                </div>
                <div className="text-xs leading-snug">
                  <span className="font-bold text-zinc-200">
                    I have read, understood, and accept the VIP Terms & Conditions
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    I confirm that I am intentionally choosing to activate VIP Pass privileges for my account.
                  </p>
                </div>
              </label>

              {/* Explicit Action Buttons */}
              <div className="pt-2 space-y-2.5">
                {/* YES - I ACCEPT & WANT VIP */}
                <button
                  type="button"
                  onClick={handleAcceptAndActivateVip}
                  disabled={!termsAccepted || isProcessing}
                  className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg active:scale-98 transition-all cursor-pointer ${
                    termsAccepted && !isProcessing
                      ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-600/30'
                      : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isProcessing ? (
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified_user
                      </span>
                      <span>YES — I ACCEPT & WANT VIP</span>
                    </>
                  )}
                </button>

                {/* NO - CANCEL */}
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-2xl bg-[#1a1a1e] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold text-xs border border-[#26262b] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>NO — CANCEL</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#121214] border-t border-[#26262b] flex items-center justify-between text-xs text-[#9898a0]">
          <span className="font-mono text-[11px]">KAOS Black Explorer Protocol</span>
          <button
            onClick={() => {
              onShowToast('VIP Concierge connected on WhatsApp! 👑', 'support_agent');
              triggerHaptic('light');
            }}
            className="text-orange-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">headset_mic</span>
            <span>VIP Support</span>
          </button>
        </div>
      </div>
    </div>
  );
};
