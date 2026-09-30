import React, { useState, useEffect } from 'react';
import { Discovery, TabType, MysteryDrop, SavedLocationPin, PinSyncStatus } from './types';
import { useGeofencing } from './services/geofenceService';
import { HomeScreen } from './screens/HomeScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { MapScreen } from './screens/MapScreen';
import { AdventuresScreen } from './screens/AdventuresScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { JournalScreen } from './screens/JournalScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ArQuestAssistantScreen } from './screens/ArQuestAssistantScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { KaosLogo } from './components/KaosLogo';
import { DossierModal } from './components/DossierModal';
import { AiGeneratorModal } from './components/AiGeneratorModal';
import { LiveLensModal } from './components/LiveLensModal';
import { MysteryDropModal } from './components/MysteryDropModal';
import { TerritoryLeaderboardModal } from './components/TerritoryLeaderboardModal';
import { VipActivationModal } from './components/VipActivationModal';
import { ZomatoNotificationBanner } from './components/ZomatoNotificationBanner';
import { AiExpeditionPlannerModal } from './components/AiExpeditionPlannerModal';
import { AiQuestGeneratorModal } from './components/AiQuestGeneratorModal';
import { MasterPlacesBrowserModal } from './components/MasterPlacesBrowserModal';
import { DailyDiscoveryChallengeModal } from './components/DailyDiscoveryChallengeModal';
import { ActionHubModal, ActionHubTab } from './components/ActionHubModal';
import { AcousticLorePlayer } from './components/AcousticLorePlayer';
import { MasterPlace } from './types';
import { UnifiedMapSpot, ALL_UNIFIED_MAP_SPOTS } from './data/allUnifiedSpots';
import { useAuth } from './context/AuthContext';
import { triggerHaptic } from './lib/haptic';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { MoodMorphOverlay } from './components/MoodMorphOverlay';
import { VisualHapticOverlay } from './components/VisualHapticOverlay';

export function App() {
  const { user, loading, isGuest, signInWithEmail, signUpWithEmail, signInWithGoogle, continueAsGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedDiscovery, setSelectedDiscovery] = useState<Discovery | null>(null);
  const [activeNavSpot, setActiveNavSpot] = useState<UnifiedMapSpot | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [liveLensOpen, setLiveLensOpen] = useState(false);
  const [liveLensFilter, setLiveLensFilter] = useState<string>('peaberry-1924');
  const [liveLensTargetSpot, setLiveLensTargetSpot] = useState<UnifiedMapSpot | null>(null);
  // Unified Action Hub (Passport + Secret Pass + Mood Radar)
  const [actionHubOpen, setActionHubOpen] = useState(false);
  const [actionHubTab, setActionHubTab] = useState<ActionHubTab>('passport');

  const openActionHub = (tab: ActionHubTab = 'passport') => {
    setActionHubTab(tab);
    setActionHubOpen(true);
  };

  const [mysteryDropOpen, setMysteryDropOpen] = useState(false);
  const [territoriesOpen, setTerritoriesOpen] = useState(false);
  const [diBlackOpen, setDiBlackOpen] = useState(false);
  
  // Master Places, AI Route Architect & AI Quest Modals
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);
  const [plannerInitialCluster, setPlannerInitialCluster] = useState<string>('fort-george-town');
  const [questGeneratorOpen, setQuestGeneratorOpen] = useState(false);
  const [selectedQuestPlace, setSelectedQuestPlace] = useState<MasterPlace | null>(null);
  const [masterBrowserOpen, setMasterBrowserOpen] = useState(false);
  const [dailyChallengeOpen, setDailyChallengeOpen] = useState(false);

  const [toast, setToast] = useState<{ message: string; icon: string } | null>(null);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Dynamic Mood Radar Background State & Listener
  const [activeMoodCategory, setActiveMoodCategory] = useState<string>(() => {
    return localStorage.getItem('kaos_active_mood') || 'balanced';
  });

  useEffect(() => {
    const handleMoodChange = () => {
      const mood = localStorage.getItem('kaos_active_mood') || 'balanced';
      setActiveMoodCategory(mood);
    };
    window.addEventListener('kaos-mood-changed', handleMoodChange);
    return () => window.removeEventListener('kaos-mood-changed', handleMoodChange);
  }, []);

  const getMoodBackgroundGradient = (mood: string) => {
    switch (mood) {
      case 'heritage':
        return 'radial-gradient(circle at 50% 12%, rgba(249, 115, 22, 0.22) 0%, rgba(20, 15, 12, 0.96) 60%, #121114 100%)';
      case 'coastal':
        return 'radial-gradient(circle at 50% 12%, rgba(14, 165, 233, 0.22) 0%, rgba(12, 20, 25, 0.96) 60%, #121114 100%)';
      case 'coffee':
        return 'radial-gradient(circle at 50% 12%, rgba(217, 119, 6, 0.22) 0%, rgba(20, 16, 10, 0.96) 60%, #121114 100%)';
      case 'cyber':
        return 'radial-gradient(circle at 50% 12%, rgba(168, 85, 247, 0.25) 0%, rgba(18, 12, 25, 0.96) 60%, #121114 100%)';
      default:
        return 'radial-gradient(circle at 50% 12%, rgba(249, 115, 22, 0.14) 0%, rgba(16, 15, 18, 0.96) 60%, #121114 100%)';
    }
  };

  // Real-time unread messages badge for Squad & Feed module (Instagram Activity Style)
  const [unreadGroupsBadgeCount, setUnreadGroupsBadgeCount] = useState<number>(3);

  // --- GEOFENCING & PERSISTENCE & CLOUD SYNC ---
  const [pinSyncStatus, setPinSyncStatus] = useState<PinSyncStatus>(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle';
  });

  const [savedPins, setSavedPins] = useState<SavedLocationPin[]>(() => {
    try {
      const saved = localStorage.getItem('kaos_custom_map_pins');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reconcile and synchronize local pins with Firestore
  const syncPinsWithFirestore = React.useCallback(async (isNetworkReconnection = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setPinSyncStatus('offline');
      if (isNetworkReconnection) {
        showToast('Offline Mode: Custom pins cached locally', 'cloud_off');
      }
      return;
    }

    if (!user) {
      setPinSyncStatus('idle');
      return;
    }

    setPinSyncStatus('syncing');

    try {
      const pinsCol = collection(db, 'users', user.uid, 'savedPins');
      const querySnap = await getDocs(pinsCol);
      const remotePins: SavedLocationPin[] = [];
      querySnap.forEach((docSnap) => {
        remotePins.push(docSnap.data() as SavedLocationPin);
      });

      let localPins: SavedLocationPin[] = [];
      try {
        const stored = localStorage.getItem('kaos_custom_map_pins');
        localPins = stored ? JSON.parse(stored) : [];
      } catch {
        localPins = [];
      }

      // Merge local pins that are missing or newer in Firestore
      for (const localPin of localPins) {
        const remoteMatch = remotePins.find(rp => rp.id === localPin.id);
        if (!remoteMatch || JSON.stringify(remoteMatch) !== JSON.stringify(localPin)) {
          await setDoc(doc(db, 'users', user.uid, 'savedPins', localPin.id), localPin);
        }
      }

      // Combine pins into unified state
      const mergedMap = new Map<string, SavedLocationPin>();
      localPins.forEach(p => mergedMap.set(p.id, p));
      remotePins.forEach(p => {
        if (!mergedMap.has(p.id)) {
          mergedMap.set(p.id, p);
        }
      });

      const finalPins = Array.from(mergedMap.values());
      setSavedPins(finalPins);
      localStorage.setItem('kaos_custom_map_pins', JSON.stringify(finalPins));

      setPinSyncStatus('synced');
      triggerHaptic('medium');
      
      if (isNetworkReconnection) {
        showToast('Network restored: Custom pins synced to cloud! ☁️✨', 'cloud_done');
      }

      // Briefly pulse the SYNCED indicator for 3.5 seconds
      setTimeout(() => {
        setPinSyncStatus('idle');
      }, 3500);
    } catch (err) {
      console.error('Failed to sync pins with Firestore:', err);
      setPinSyncStatus('error');
      setTimeout(() => {
        setPinSyncStatus('idle');
      }, 3500);
    }
  }, [user]);

  // Network Change Listener (Online / Offline)
  useEffect(() => {
    const handleOnline = () => {
      syncPinsWithFirestore(true);
    };

    const handleOffline = () => {
      setPinSyncStatus('offline');
      showToast('Network disconnected: Custom pins cached locally', 'cloud_off');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPinsWithFirestore]);

  // Sync saved pins to localStorage and subscribe to Firestore if logged in
  React.useEffect(() => {
    if (!user) {
      localStorage.setItem('kaos_custom_map_pins', JSON.stringify(savedPins));
      return;
    }

    // Subscribe to Firestore pins
    const pinsCol = collection(db, 'users', user.uid, 'savedPins');
    const unsubscribe = onSnapshot(pinsCol, (snapshot) => {
      const pins: SavedLocationPin[] = [];
      snapshot.forEach((docSnap) => {
        pins.push(docSnap.data() as SavedLocationPin);
      });
      if (pins.length > 0) {
        setSavedPins(pins);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, pinsCol.path);
    });

    return () => unsubscribe();
  }, [user]);

  // Logic to save/remove/update a pin to Firestore
  const handleUpdatePins = async (newPins: SavedLocationPin[]) => {
    const oldPins = savedPins;
    setSavedPins(newPins);
    localStorage.setItem('kaos_custom_map_pins', JSON.stringify(newPins));

    if (!user) return;

    try {
      if (newPins.length > oldPins.length) {
        // Addition
        const added = newPins.find(p => !oldPins.find(o => o.id === p.id));
        if (added) {
          await setDoc(doc(db, 'users', user.uid, 'savedPins', added.id), added);
          setPinSyncStatus('synced');
          setTimeout(() => setPinSyncStatus('idle'), 2500);
        }
      } else if (newPins.length < oldPins.length) {
        // Deletion
        const removed = oldPins.find(p => !newPins.find(n => n.id === p.id));
        if (removed) {
          await deleteDoc(doc(db, 'users', user.uid, 'savedPins', removed.id));
          setPinSyncStatus('synced');
          setTimeout(() => setPinSyncStatus('idle'), 2500);
        }
      } else {
        // Modifications (e.g. moved collection, edited note)
        for (const pin of newPins) {
          const prev = oldPins.find(o => o.id === pin.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(pin)) {
            await setDoc(doc(db, 'users', user.uid, 'savedPins', pin.id), pin);
          }
        }
        setPinSyncStatus('synced');
        setTimeout(() => setPinSyncStatus('idle'), 2500);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/savedPins`);
    }
  };

  // Initialize Geofencing Service
  useGeofencing({
    curatedSpots: ALL_UNIFIED_MAP_SPOTS,
    customPins: savedPins,
    proximityThresholdMeters: 100,
    onEnter: async (event) => {
      triggerHaptic('legendary');
      
      // Default notification
      let alertMsg = `Nearby: ${event.name} (${event.distanceMeters}m)`;
      
      // Try to get AI enhanced notification
      try {
        const res = await fetch('/api/ai/smart-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            landmarkName: event.name,
            landmarkLore: event.lore || '',
            distance: event.distanceMeters
          }),
        });
        const data = await res.json();
        if (data.text) {
          alertMsg = data.text;
        }
      } catch (e) {
        console.warn('AI Notify Error:', e);
      }

      showToast(alertMsg, event.type === 'heritage' ? 'account_balance' : 'push_pin');
      
      // Attempt real browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`KAOS Proximity Alert`, {
          body: alertMsg,
          icon: '/favicon.ico'
        });
      }
    }
  });

  // Listen for Google Maps quota exceeded event
  React.useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);


  // Auth gate form state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const showToast = (message: string, icon: string = 'info') => {
    setToast({ message, icon });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) return;

    setAuthLoading(true);
    triggerHaptic('medium');

    try {
      if (isSignUp) {
        await signUpWithEmail(emailInput, passwordInput, displayNameInput || 'Explorer');
        showToast(`Account created successfully for ${emailInput}`, 'person_add');
      } else {
        await signInWithEmail(emailInput, passwordInput);
        showToast(`Welcome back, ${emailInput}!`, 'login');
      }
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    triggerHaptic('medium');
    try {
      await signInWithGoogle();
      showToast('Signed in with Google successfully', 'login');
    } catch (err: any) {
      const code = err?.code;
      const msg = err?.message || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('popup-closed-by-user')
      ) {
        showToast('Google sign-in popup was closed', 'info');
      } else if (code === 'auth/popup-blocked') {
        showToast('Sign-in popup was blocked by browser', 'warning');
      } else {
        showToast(msg || 'Google sign-in failed', 'error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121214] flex flex-col items-center justify-center space-y-3">
        <span className="material-symbols-outlined text-[#F05423] animate-spin text-4xl">progress_activity</span>
        <span className="text-xs text-[#9898a0] font-medium tracking-wide">Loading KAOS...</span>
      </div>
    );
  }

  // Mandatory Sign Up / Sign In gate before entering the app
  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6] font-sans flex items-center justify-center px-4 py-8 overflow-y-auto font-sans">
        <div className="max-w-md w-full bg-[#16151a] rounded-[2.5rem] p-8 border border-[#26252c] shadow-2xl space-y-8 text-center relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-orange-600/10 rounded-full blur-[80px]"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-600/10 rounded-full blur-[80px]"></div>

          <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
            <KaosLogo size="xl" showTagline={true} taglinePosition="top" />
            <p className="text-[13px] text-zinc-400 leading-relaxed max-w-[280px]">
              Discover urban secrets, heritage trails, live AR lenses, and digital passports.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5 relative z-10 text-left">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">Explorer Name</label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="e.g., Mylapore Chronicler"
                  required
                  className="w-full bg-[#0a0a0c] text-white p-4 rounded-2xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">Email Address</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="explorer@example.com"
                required
                className="w-full bg-[#0a0a0c] text-white p-4 rounded-2xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0a0a0c] text-white p-4 pr-12 rounded-2xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(!showPassword);
                    triggerHaptic('light');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isSignUp ? 'person_add' : 'login'}
                  </span>
                  <span>{isSignUp ? 'Launch My Journey' : 'Enter Archive'}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex py-1 items-center z-10">
            <div className="flex-grow border-t border-[#26262b]"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">Secure Methods</span>
            <div className="flex-grow border-t border-[#26262b]"></div>
          </div>

          <div className="grid grid-cols-2 gap-3 relative z-10">
            <button
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="flex-1 py-3.5 rounded-2xl bg-[#1c1b21] hover:bg-[#26252c] text-white font-bold text-xs flex items-center justify-center gap-2 border border-[#26252c] active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Google</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('medium');
                continueAsGuest();
                showToast('Entering as Anonymous Explorer (Limited Features)', 'person_off');
              }}
              className="flex-1 py-3.5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">visibility_off</span>
              <span>Guest</span>
            </button>
          </div>

          <div className="text-center pt-2 relative z-10">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                triggerHaptic('light');
              }}
              className="text-xs text-zinc-500 font-bold hover:text-orange-400 transition-colors cursor-pointer"
            >
              {isSignUp ? 'Already a Chronicler? Sign In' : "New Explorer? Create Identity"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenDossier = (disc: Discovery) => {
    triggerHaptic('light');
    setSelectedDiscovery(disc);
  };

  const handleNavigateTab = (tab: TabType) => {
    triggerHaptic('medium');
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen text-[#f4f4f6] font-sans flex flex-col selection:bg-[#F05423] selection:text-white bg-[#121114] relative overflow-x-hidden">
      {/* Visual Micro-Haptic Edge Flare (iOS / Safari / Desktop fallback) */}
      <VisualHapticOverlay />

      {/* Morphing Dynamic Mood Background Overlay */}
      <MoodMorphOverlay activeMood={activeMoodCategory} />

      {/* Main App Content Layer */}
      <div className="relative z-10 flex-1 flex flex-col w-full min-h-screen">
        {/* Google Maps Quota Exceeded Sticky Notice */}
        {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Global Top App Bar */}

      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        onCityClick={() => showToast('Active Expedition Zone: Chennai (Coromandel Coast)', 'fmd_good')}
        onProfileClick={() => handleNavigateTab('me-profile')}
        onLiveLensClick={() => setLiveLensOpen(true)}
        pinSyncStatus={pinSyncStatus}
        onManualSyncPins={() => syncPinsWithFirestore(false)}
      />

      {/* Zomato-style engaging push notification banner */}
      <ZomatoNotificationBanner onShowToast={showToast} />

      {/* Main Screen Router */}
      <main className="flex-1 w-full flex flex-col pt-1">
        {activeTab === 'home' && (
          <HomeScreen
            onOpenDossier={handleOpenDossier}
            onShowToast={showToast}
            onNavigateTab={handleNavigateTab}
            onOpenLiveLens={() => setLiveLensOpen(true)}
            onOpenPassport={() => openActionHub('passport')}
            onOpenSecretPass={() => openActionHub('perks')}
            onOpenMoodRadar={() => openActionHub('radar')}
            onOpenMysteryDrop={() => setMysteryDropOpen(true)}
            onOpenTerritories={() => setTerritoriesOpen(true)}
            onOpenDiBlack={() => setDiBlackOpen(true)}
            onOpenDailyChallenge={() => setDailyChallengeOpen(true)}
            onOpenMasterBrowser={() => setMasterBrowserOpen(true)}
            onOpenAiPlanner={(clusterKey) => {
              setPlannerInitialCluster(clusterKey || 'fort-george-town');
              setAiPlannerOpen(true);
            }}
            onOpenQuestGenerator={(place) => {
              setSelectedQuestPlace(place);
              setQuestGeneratorOpen(true);
            }}
          />
        )}
        {activeTab === 'explore' && (
          <ExploreScreen
            onOpenDossier={handleOpenDossier}
            onShowToast={showToast}
            onNavigateTab={handleNavigateTab}
            onOpenLiveLens={() => setLiveLensOpen(true)}
            onOpenPassport={() => openActionHub('passport')}
            onOpenSecretPass={() => openActionHub('perks')}
            onOpenMoodRadar={() => openActionHub('radar')}
          />
        )}
        {activeTab === 'map' && (
          <MapScreen
            onOpenDossier={handleOpenDossier}
            onShowToast={showToast}
            onOpenLiveLens={() => setLiveLensOpen(true)}
            onOpenPassport={() => openActionHub('passport')}
            onOpenSecretPass={() => openActionHub('perks')}
            onOpenMysteryDrop={() => setMysteryDropOpen(true)}
            initialNavSpot={activeNavSpot}
            onClearInitialNavSpot={() => setActiveNavSpot(null)}
            savedPins={savedPins}
            onUpdatePins={handleUpdatePins}
            activeMoodCategory={activeMoodCategory}
          />
        )}
        {activeTab === 'ar-quest' && (
          <ArQuestAssistantScreen
            onShowToast={showToast}
            onOpenLiveLens={(filterId, spot) => {
              if (filterId) setLiveLensFilter(filterId);
              if (spot) setLiveLensTargetSpot(spot);
              setLiveLensOpen(true);
            }}
            onNavigateToSpot={(spot) => {
              setActiveNavSpot(spot);
              setActiveTab('map');
              showToast(`Routing real-time GPS navigation to ${spot.name}...`, 'near_me');
            }}
            onOpenPassport={() => openActionHub('passport')}
          />
        )}
        {activeTab === 'adventures' && (
          <AdventuresScreen
            onShowToast={showToast}
            onOpenAiModal={() => setAiModalOpen(true)}
          />
        )}
        {activeTab === 'groups' && (
          <GroupsScreen
            onShowToast={showToast}
            onUnreadCountChange={(count) => setUnreadGroupsBadgeCount(count)}
            onNavigateTab={handleNavigateTab}
          />
        )}
        {activeTab === 'journal' && (
          <JournalScreen
            onShowToast={showToast}
          />
        )}
        {activeTab === 'me-profile' && (
          <ProfileScreen
            onShowToast={showToast}
            onOpenPassport={() => openActionHub('passport')}
            onOpenSecretPass={() => openActionHub('perks')}
            onOpenDiBlack={() => setDiBlackOpen(true)}
            onOpenTerritories={() => setTerritoriesOpen(true)}
          />
        )}
      </main>

      {/* Dossier Detail Modal */}
      <DossierModal
        discovery={selectedDiscovery}
        isOpen={!!selectedDiscovery}
        onClose={() => setSelectedDiscovery(null)}
        onBookmark={(title) => showToast(`Saved "${title}" to Field Journal`, 'bookmark_added')}
        onStartWalk={(title) => {
          setSelectedDiscovery(null);
          setActiveTab('map');
          showToast(`Started walking trail: ${title}`, 'directions_walk');
        }}
        onShowToast={showToast}
        onOpenSecretPass={() => openActionHub('perks')}
        onOpenPassport={() => openActionHub('passport')}
      />

      {/* AI Live Lens Modal */}
      <LiveLensModal
        isOpen={liveLensOpen}
        onClose={() => {
          setLiveLensOpen(false);
          setLiveLensTargetSpot(null);
        }}
        onShowToast={showToast}
        initialFilterId={liveLensFilter}
        targetSpot={liveLensTargetSpot}
        onStampUnlocked={() => {
          showToast('Proof-of-Discovery stamped in your Digital Passport! 🎖️', 'menu_book');
        }}
      />

      {/* UNIFIED DISCOVERY ACTION HUB (Passport + Secret Pass + Mood Radar) */}
      <ActionHubModal
        isOpen={actionHubOpen}
        onClose={() => setActionHubOpen(false)}
        onShowToast={showToast}
        initialTab={actionHubTab}
        onStartQuestOnMap={(questTitle) => {
          setActiveTab('map');
          showToast(`Plotted "${questTitle}" on Live Map! 🗺️`, 'near_me');
        }}
        onOpenDiBlack={() => {
          setActionHubOpen(false);
          setDiBlackOpen(true);
        }}
      />

      {/* Sunday Mystery Flash Drop Modal */}
      <MysteryDropModal
        isOpen={mysteryDropOpen}
        onClose={() => setMysteryDropOpen(false)}
        onShowToast={showToast}
        onDropClaimed={(drop: MysteryDrop) => {
          showToast(`Claimed ${drop.title}! Minted in Passport`, 'celebration');
        }}
      />

      {/* District Mayorships & Territory Modal */}
      <TerritoryLeaderboardModal
        isOpen={territoriesOpen}
        onClose={() => setTerritoriesOpen(false)}
        onShowToast={showToast}
      />

      {/* KAOS Black VIP Membership & Activation Modal */}
      <VipActivationModal
        isOpen={diBlackOpen}
        onClose={() => setDiBlackOpen(false)}
        onShowToast={showToast}
      />

      {/* AI Trail Generator Modal */}
      <AiGeneratorModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onShowToast={showToast}
      />

      {/* AI Geographic Route Customizer Modal */}
      <AiExpeditionPlannerModal
        isOpen={aiPlannerOpen}
        onClose={() => setAiPlannerOpen(false)}
        onShowToast={showToast}
        initialClusterKey={plannerInitialCluster}
        onNavigateToMap={(_stops) => {
          setActiveTab('map');
        }}
        onOpenQuestModal={(place) => {
          setSelectedQuestPlace(place);
          setQuestGeneratorOpen(true);
        }}
      />

      {/* AI Dynamic Multimodal Quest Generator Modal */}
      <AiQuestGeneratorModal
        isOpen={questGeneratorOpen}
        onClose={() => setQuestGeneratorOpen(false)}
        onShowToast={showToast}
        initialPlace={selectedQuestPlace}
        onOpenLiveLensWithFilter={(_filterId) => {
          setLiveLensOpen(true);
        }}
      />

      {/* 300 Places, 300 Food Gems & Architecture Master Browser Modal */}
      <MasterPlacesBrowserModal
        isOpen={masterBrowserOpen}
        onClose={() => setMasterBrowserOpen(false)}
        onShowToast={showToast}
        onOpenAiPlanner={(clusterKey) => {
          setPlannerInitialCluster(clusterKey || 'fort-george-town');
          setAiPlannerOpen(true);
        }}
        onOpenQuestGenerator={(place) => {
          setSelectedQuestPlace(place);
          setQuestGeneratorOpen(true);
        }}
        onNavigateToMapWithPlace={(_place) => {
          setActiveTab('map');
        }}
      />

      {/* 24-Hour AI Daily Discovery Challenge Modal */}
      <DailyDiscoveryChallengeModal
        isOpen={dailyChallengeOpen}
        onClose={() => setDailyChallengeOpen(false)}
        onShowToast={showToast}
        onNavigateToMapWithLocation={(categoryName) => {
          let matchedSpot = ALL_UNIFIED_MAP_SPOTS.find(
            (spot) =>
              spot.category.toLowerCase().includes(categoryName.toLowerCase()) ||
              spot.categoryKey.toLowerCase().includes(categoryName.toLowerCase())
          );
          
          if (!matchedSpot) {
            matchedSpot = ALL_UNIFIED_MAP_SPOTS.find(
              (spot) =>
                spot.cluster.toLowerCase().includes(categoryName.toLowerCase()) ||
                spot.name.toLowerCase().includes(categoryName.toLowerCase())
            );
          }

          if (!matchedSpot) {
            matchedSpot = ALL_UNIFIED_MAP_SPOTS.find(s => s.type === 'heritage') || ALL_UNIFIED_MAP_SPOTS[0];
          }

          setActiveNavSpot(matchedSpot);
          setActiveTab('map');
          showToast(`Focusing GPS navigation on daily quest cluster: ${matchedSpot.cluster}! 🗺️`, 'radar');
        }}
      />


      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-[#1a1a1e] text-white px-5 py-3 rounded-2xl shadow-2xl border border-orange-500/40 flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.icon}
          </span>
          <span className="text-xs font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* Streamlined Bottom Navigation with Centerpiece Action Hub */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        onTabChangeToast={showToast}
        unreadCount={unreadGroupsBadgeCount}
        onOpenActionHub={openActionHub}
      />

      {/* Floating Spatial Audio Acoustic Lore Player */}
      <AcousticLorePlayer onShowToast={showToast} />
      </div>
    </div>
  );
}

export default App;
