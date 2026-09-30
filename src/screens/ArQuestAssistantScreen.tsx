import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { triggerHaptic } from '../lib/haptic';
import { ALL_UNIFIED_MAP_SPOTS, UnifiedMapSpot } from '../data/allUnifiedSpots';
import { ALL_MASTER_PLACES_300 } from '../data/masterPlacesIndex';
import { MasterPlace, GeneratedQuest } from '../types';
import { generateDynamicPlaceQuests } from '../lib/aiExpeditionEngine';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { evaluatePlaceOpenStatus } from '../lib/openingHours';
import { ArAcousticArtifactViewport } from '../components/ArAcousticArtifactViewport';
import { ArtifactInventoryModal } from '../components/ArtifactInventoryModal';
import { ACOUSTIC_LORE_ARTIFACTS } from '../data/acousticLoreArtifacts';
import { AcousticLoreArtifact, SessionPlacedArtifact } from '../types';
import { soundscapeEngine } from '../lib/soundscapes';
import {
  createSharedArSession,
  updateSharedArSessionPlacements,
  subscribeSharedArSession,
  joinSharedArSession,
  leaveSharedArSession,
  SharedArSession,
} from '../lib/sharedArSessionService';

interface ArQuestAssistantScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenLiveLens: (filterId?: string, spot?: UnifiedMapSpot) => void;
  onNavigateToSpot: (spot: UnifiedMapSpot) => void;
  onOpenPassport: () => void;
}

export type ArModeTab = 'viewfinder' | 'quest' | 'assistant' | 'catalog' | 'shared-view';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

function calculateGeodesicBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

function getRelativeDirectionLabel(relAngle: number): { label: string; arrowIcon: string } {
  if (Math.abs(relAngle) <= 22) return { label: 'Straight Ahead', arrowIcon: 'arrow_upward' };
  if (relAngle > 22 && relAngle < 68) return { label: 'Ahead to your Right (2 o\'clock)', arrowIcon: 'north_east' };
  if (relAngle >= 68 && relAngle <= 112) return { label: 'To your Right (3 o\'clock)', arrowIcon: 'arrow_forward' };
  if (relAngle > 112 && relAngle < 158) return { label: 'Behind to your Right (4 o\'clock)', arrowIcon: 'south_east' };
  if (relAngle < -22 && relAngle > -68) return { label: 'Ahead to your Left (10 o\'clock)', arrowIcon: 'north_west' };
  if (relAngle <= -68 && relAngle >= -112) return { label: 'To your Left (9 o\'clock)', arrowIcon: 'arrow_back' };
  if (relAngle < -112 && relAngle > -158) return { label: 'Behind to your Left (8 o\'clock)', arrowIcon: 'south_west' };
  return { label: 'Directly Behind You (6 o\'clock)', arrowIcon: 'arrow_downward' };
}

export const ArQuestAssistantScreen: React.FC<ArQuestAssistantScreenProps> = ({
  onShowToast,
  onOpenLiveLens,
  onNavigateToSpot,
  onOpenPassport,
}) => {
  const { user } = useAuth();

  // Real-time GPS location
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'fallback'>('acquiring');

  // Active Quest State
  const [activeQuest, setActiveQuest] = useState<GeneratedQuest | null>(null);
  const [questTargetSpot, setQuestTargetSpot] = useState<UnifiedMapSpot | null>(null);
  const [cluesRevealed, setCluesRevealed] = useState<number>(0);
  const [questCompleted, setQuestCompleted] = useState<boolean>(false);
  const [questEvidencePhoto, setQuestEvidencePhoto] = useState<string | null>(null);

  const questCameraInputRef = useRef<HTMLInputElement>(null);
  const questGalleryInputRef = useRef<HTMLInputElement>(null);

  // AR Mode Navigation State
  const [activeMode, setActiveMode] = useState<ArModeTab>('viewfinder');
  const [targetArtifactId, setTargetArtifactId] = useState<string>('kapaleeshwarar-bell');
  const [inventoryOpen, setInventoryOpen] = useState<boolean>(false);

  // Session Placed 3D AR Artifacts & Undo Stack
  const [sessionPlacedCount, setSessionPlacedCount] = useState<number>(0);
  const [lastPlacedArtifactName, setLastPlacedArtifactName] = useState<string | undefined>();
  const undoActionRef = useRef<(() => void) | null>(null);

  // Quest Generation State
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('all-1');
  const [isGeneratingQuest, setIsGeneratingQuest] = useState<boolean>(false);
  const [availableQuests, setAvailableQuests] = useState<GeneratedQuest[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'heritage' | 'food' | 'architecture'>('all');
  const [onlyOpenNow, setOnlyOpenNow] = useState<boolean>(false);

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: "Vanakkam Explorer! I'm Maya, your AR Chrono-Navigator. Point me towards any ancient gopuram, colonial colonnade, or secret mess in Chennai, and I'll decrypt its hidden lore and guide your steps in real-time.",
      timestamp: 'Just now',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiReplying, setIsAiReplying] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Real-time GPS tracker
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('fallback');
      setUserCoords({ lat: 13.0674, lng: 80.2650 }); // Chennai center fallback
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus('locked');
      },
      (err) => {
        console.warn('GPS error in AR Quest Assistant:', err);
        setGpsStatus('fallback');
        setUserCoords({ lat: 13.0674, lng: 80.2650 });
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Distance calculator helper
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find nearest spot to user
  const nearestSpot = useMemo(() => {
    if (!userCoords) return ALL_UNIFIED_MAP_SPOTS[0];
    let closest = ALL_UNIFIED_MAP_SPOTS[0];
    let minDistance = Infinity;

    for (const spot of ALL_UNIFIED_MAP_SPOTS) {
      const dist = calculateDistanceKm(userCoords.lat, userCoords.lng, spot.lat, spot.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = spot;
      }
    }
    return closest;
  }, [userCoords]);

  // Distance to nearest spot
  const distanceToNearest = useMemo(() => {
    if (!userCoords || !nearestSpot) return '1.2 km';
    const dist = calculateDistanceKm(userCoords.lat, userCoords.lng, nearestSpot.lat, nearestSpot.lng);
    return dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
  }, [userCoords, nearestSpot]);

  // Listen to device orientation compass for real-time azimuth
  const [deviceCompassHeading, setDeviceCompassHeading] = useState<number>(0);

  useEffect(() => {
    const handleOrientation = (e: any) => {
      let heading = e.webkitCompassHeading;
      if (heading === undefined || heading === null) {
        heading = e.alpha ? (360 - e.alpha) % 360 : 0;
      }
      setDeviceCompassHeading(Math.round(heading));
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // 1. Proximity-Based Audio Notification System (< 50m of un-discovered 3D heritage site)
  const [proximityAudioEnabled, setProximityAudioEnabled] = useState<boolean>(true);
  const [discoveredSpotIds, setDiscoveredSpotIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('kaos_discovered_heritage_spots');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set<string>();
  });

  const markSpotDiscovered = useCallback(
    (spotId: string, spotName: string) => {
      setDiscoveredSpotIds((prev) => {
        const next = new Set(prev);
        next.add(spotId);
        try {
          localStorage.setItem('kaos_discovered_heritage_spots', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
      triggerHaptic([60, 100, 200]);
      onShowToast(`🏆 Discovered & Documented "${spotName}"! +120 Heritage XP`, 'military_tech');
    },
    [onShowToast]
  );

  const [lastChimedSiteId, setLastChimedSiteId] = useState<string | null>(null);
  const lastChimeTimeRef = useRef<number>(0);

  // Filter un-discovered 3D heritage sites within 50m
  const nearbyHeritageSitesWithin50m = useMemo(() => {
    if (!userCoords) return [];
    const pool = ALL_UNIFIED_MAP_SPOTS.filter(
      (s) =>
        (s.category === 'heritage' || s.category === 'architecture') &&
        !discoveredSpotIds.has(s.id)
    );

    return pool
      .map((site) => {
        const distKm = calculateDistanceKm(userCoords.lat, userCoords.lng, site.lat, site.lng);
        const distMeters = Math.round(distKm * 1000);
        const bearing = calculateGeodesicBearing(userCoords.lat, userCoords.lng, site.lat, site.lng);
        const relAngle = ((bearing - deviceCompassHeading + 540) % 360) - 180;
        const pan = Math.sin((relAngle * Math.PI) / 180);

        return {
          site,
          distanceMeters: distMeters,
          bearingDegrees: Math.round(bearing),
          relativeAngleDeg: Math.round(relAngle),
          pan: Number(pan.toFixed(2)),
          directionInfo: getRelativeDirectionLabel(relAngle),
          isSimulated: false,
        };
      })
      .filter((item) => item.distanceMeters <= 50)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [userCoords, discoveredSpotIds, deviceCompassHeading]);

  const [simulatedProximityActive, setSimulatedProximityActive] = useState<boolean>(false);

  const activeProximityHeritage = useMemo(() => {
    if (nearbyHeritageSitesWithin50m.length > 0) {
      return nearbyHeritageSitesWithin50m[0];
    }
    if (simulatedProximityActive) {
      const fallbackSite = nearestSpot || ALL_UNIFIED_MAP_SPOTS[0];
      return {
        site: fallbackSite,
        distanceMeters: 28,
        bearingDegrees: (deviceCompassHeading + 45) % 360,
        relativeAngleDeg: 45,
        pan: 0.71, // Right ear spatial pan
        directionInfo: { label: "Ahead to your Right (2 o'clock)", arrowIcon: 'north_east' },
        isSimulated: true,
      };
    }
    return null;
  }, [nearbyHeritageSitesWithin50m, simulatedProximityActive, nearestSpot, deviceCompassHeading]);

  // Auto-trigger subtle directional chime when within 50m of an un-discovered 3D heritage site
  useEffect(() => {
    if (!activeProximityHeritage || !proximityAudioEnabled) return;

    const now = Date.now();
    const siteId = activeProximityHeritage.site.id;
    // Play chime if new site entered or at least 25 seconds since last notification
    if (siteId !== lastChimedSiteId || now - lastChimeTimeRef.current > 25000) {
      lastChimeTimeRef.current = now;
      setLastChimedSiteId(siteId);

      soundscapeEngine.playDirectionalProximityChime(
        activeProximityHeritage.pan,
        activeProximityHeritage.distanceMeters,
        528
      );
      triggerHaptic([40, 70]);

      onShowToast(
        `🔔 Proximity Chime: "${activeProximityHeritage.site.name}" (${activeProximityHeritage.distanceMeters}m ${activeProximityHeritage.directionInfo.label})`,
        'spatial_audio'
      );
    }
  }, [activeProximityHeritage, proximityAudioEnabled, lastChimedSiteId, onShowToast]);

  const handlePlayProximityChimeOnDemand = useCallback(() => {
    const target = activeProximityHeritage || {
      site: nearestSpot || ALL_UNIFIED_MAP_SPOTS[0],
      distanceMeters: 28,
      pan: 0.71,
      directionInfo: { label: "Ahead to your Right (2 o'clock)", arrowIcon: 'north_east' },
    };

    if (!activeProximityHeritage) {
      setSimulatedProximityActive(true);
    }

    soundscapeEngine.playDirectionalProximityChime(
      target.pan,
      target.distanceMeters,
      528
    );
    triggerHaptic([40, 70]);
    onShowToast(
      `🔔 Directional Chime triggered for "${target.site.name}" (${target.pan < -0.1 ? 'Left Ear' : target.pan > 0.1 ? 'Right Ear' : 'Centered'})`,
      'spatial_audio'
    );
  }, [activeProximityHeritage, nearestSpot, onShowToast]);

  // 2. 'Shared-View' Mode (Real-time live multi-user 3D artifact placements via local link)
  const [activeSharedSession, setActiveSharedSession] = useState<SharedArSession | null>(null);
  const [isSharedSessionHost, setIsSharedSessionHost] = useState<boolean>(false);
  const [joinSessionCodeInput, setJoinSessionCodeInput] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isJoiningSession, setIsJoiningSession] = useState<boolean>(false);
  const [sessionLinkCopied, setSessionLinkCopied] = useState<boolean>(false);
  const [sessionPlacedArtifacts, setSessionPlacedArtifacts] = useState<SessionPlacedArtifact[]>([]);

  // Check URL query parameters for session link (e.g. ?sessionCode=KAOS-8A2F or ?sharedSession=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('sessionCode') || urlParams.get('sharedSession');
    if (code) {
      setJoinSessionCodeInput(code.toUpperCase());
      handleJoinSessionByCode(code.toUpperCase());
    }
  }, []);

  // Real-time Firestore subscription to active shared session
  useEffect(() => {
    if (!activeSharedSession?.id) return;
    const unsubscribe = subscribeSharedArSession(activeSharedSession.id, (updated) => {
      if (updated) {
        setActiveSharedSession(updated);
      }
    });
    return () => unsubscribe();
  }, [activeSharedSession?.id]);

  const handleCreateSharedSession = async () => {
    setIsCreatingSession(true);
    triggerHaptic('medium');
    try {
      const session = await createSharedArSession(
        { uid: user?.uid || 'guest-host', displayName: user?.displayName, email: user?.email },
        userCoords,
        nearestSpot?.name,
        sessionPlacedArtifacts
      );
      setActiveSharedSession(session);
      setIsSharedSessionHost(true);
      setActiveMode('shared-view');
      onShowToast(`✨ Live Shared-View Session Active: ${session.sessionCode}!`, 'group_work');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create Shared-View session', 'error');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleJoinSessionByCode = async (codeToJoin?: string) => {
    const code = (codeToJoin || joinSessionCodeInput).trim().toUpperCase();
    if (!code) {
      onShowToast('Please enter a 6-character session code', 'warning');
      return;
    }
    setIsJoiningSession(true);
    triggerHaptic('medium');
    try {
      const session = await joinSharedArSession(code);
      if (!session) {
        throw new Error(`Session "${code}" not found. Verify the code or link.`);
      }
      setActiveSharedSession(session);
      setIsSharedSessionHost(session.hostUserId === (user?.uid || 'guest-host'));
      setActiveMode('viewfinder');
      onShowToast(`👥 Connected to Shared-View AR Session: ${session.sessionCode}!`, 'group_work');
    } catch (err: any) {
      onShowToast(err.message || 'Unable to join session', 'error');
    } finally {
      setIsJoiningSession(false);
    }
  };

  const handleLeaveSharedSession = async () => {
    if (activeSharedSession) {
      try {
        await leaveSharedArSession(activeSharedSession.id);
      } catch {}
      setActiveSharedSession(null);
      setIsSharedSessionHost(false);
      onShowToast('Disconnected from Shared-View session.', 'info');
      triggerHaptic('light');
    }
  };

  const handleCopySharedLink = () => {
    if (!activeSharedSession) return;
    const link = `${window.location.origin}/?tab=ar-quest&sessionCode=${activeSharedSession.sessionCode}`;
    navigator.clipboard.writeText(link);
    setSessionLinkCopied(true);
    triggerHaptic('light');
    onShowToast(`📋 Copied Temporary Local Session Link: ${activeSharedSession.sessionCode}`, 'link');
    setTimeout(() => setSessionLinkCopied(false), 3000);
  };

  const handleNativeShareSession = async () => {
    if (!activeSharedSession) return;
    const link = `${window.location.origin}/?tab=ar-quest&sessionCode=${activeSharedSession.sessionCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my KAOS 3D AR Shared-View Session: ${activeSharedSession.sessionCode}`,
          text: `I'm exploring heritage artifacts in AR near ${activeSharedSession.placeName}. Join my live space to see 3D placements in real-time!`,
          url: link,
        });
        triggerHaptic('light');
      } catch {}
    } else {
      handleCopySharedLink();
    }
  };

  // Filtered master spots
  const filteredSpots = useMemo(() => {
    return ALL_UNIFIED_MAP_SPOTS.filter((s) => {
      if (onlyOpenNow) {
        const openStatus = evaluatePlaceOpenStatus(s.openHours, s.category);
        if (!openStatus.isOpen) return false;
      }
      if (activeCategoryFilter !== 'all' && s.type !== activeCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.neighborhood.toLowerCase().includes(q) ||
          s.lore.toLowerCase().includes(q)
        );
      }
      return true;
    }).slice(0, 30);
  }, [activeCategoryFilter, searchQuery, onlyOpenNow]);

  // Generate instant quest for nearest or selected spot
  const handleGenerateInstantQuest = async (targetSpot?: UnifiedMapSpot) => {
    const spot = targetSpot || nearestSpot;
    if (!spot) return;

    setIsGeneratingQuest(true);
    triggerHaptic('medium');
    onShowToast(`Maya is synthesizing AR quests for ${spot.name}...`, 'auto_awesome');

    // Convert to MasterPlace format
    const candidateMaster: MasterPlace = ALL_MASTER_PLACES_300.find(
      (p) => p.name.toLowerCase() === spot.name.toLowerCase()
    ) || ({
      id: spot.id,
      number: 1,
      name: spot.name,
      locator: spot.neighborhood,
      category: 'Heritage' as any,
      categoryKey: 'heritage' as any,
      zone: spot.cluster || spot.neighborhood,
      cluster: 'Central Chennai',
      clusterKey: 'central',
      lat: spot.lat,
      lng: spot.lng,
      xp: spot.xp || 100,
      lore: spot.lore,
      imageUrl: spot.imageUrl,
      secretPerk: spot.specialty,
      architecturalStyle: spot.architecturalStyle || 'Indo-Saracenic',
    } as MasterPlace);

    try {
      const generated = await generateDynamicPlaceQuests(candidateMaster, 3);
      setAvailableQuests(generated);
      if (generated.length > 0) {
        setActiveQuest(generated[0]);
        setQuestTargetSpot(spot);
        setCluesRevealed(1);
        setQuestCompleted(false);
        triggerHaptic([40, 60, 100]);
        onShowToast(`AR Quest activated: "${generated[0].title}"! 🎯`, 'verified');

        // Append assistant message in chat
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: `🎯 Quest Initialized: "${generated[0].title}". Objective: ${generated[0].objective}. You can navigate to ${spot.name} in real-time or fire up the Live Lens scanner to inspect the site!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      console.warn('Quest generation failed:', err);
      // Fallback quest
      const fallback: GeneratedQuest = {
        id: `quest-instant-${Date.now()}`,
        placeId: spot.id,
        placeNumber: 1,
        placeName: spot.name,
        zone: spot.neighborhood,
        cluster: spot.cluster || 'Chennai Heritage',
        title: `The Mystery of ${spot.name}`,
        riddleClue: `Seek the historic markers and decipher the legacy carved in time at ${spot.neighborhood}.`,
        objective: `Locate the prominent architectural facade of ${spot.name} and align with the AR digital reticle.`,
        challengeType: 'photo_lens',
        requiredFilter: 'peaberry-1924',
        xpReward: 180,
        difficulty: 'Moderate',
        badgeReward: 'Chennai Pioneer',
      };
      setActiveQuest(fallback);
      setQuestTargetSpot(spot);
      setCluesRevealed(1);
      setQuestCompleted(false);
      onShowToast(`AR Quest activated for ${spot.name}!`, 'verified');
    } finally {
      setIsGeneratingQuest(false);
    }
  };

  // Chat with AI Assistant Maya
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isAiReplying) return;

    const userText = chatInput.trim();
    setChatInput('');
    triggerHaptic('light');

    const newMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setIsAiReplying(true);

    try {
      const ai = new GoogleGenAI();
      const currentContext = activeQuest
        ? `User is currently on an active AR quest: "${activeQuest.title}" at "${activeQuest.placeName}" (Zone: ${activeQuest.zone}). Objective: "${activeQuest.objective}". Riddle Clue: "${activeQuest.riddleClue}". Required filter: "${activeQuest.requiredFilter}".`
        : `User is near "${nearestSpot?.name}" in ${nearestSpot?.neighborhood}. User GPS: ${userCoords?.lat.toFixed(4)}, ${userCoords?.lng.toFixed(4)}.`;

      // Map existing messages to standard Gemini dialogue roles ('user' / 'model')
      const dialogueContents = chatMessages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      // Append the latest user query
      dialogueContents.push({
        role: 'user',
        parts: [{ text: userText }]
      });

      const systemInstruction = `You are Maya, the brilliant, charismatic Chennai Chrono-Navigator and AR Quest Assistant in the "DÌ DiscoverIt" explorer app.
You know every square inch of Chennai—from 7th-century Pallava shore temples, Chola bronzes, and Armenian belfries to hidden Mylapore filter coffee spots and George Town spice godowns.
Current State: ${currentContext}

Rules:
1. Stay in character as Maya: warm, sharp, culturally rich, evocative, and adventurous.
2. If the user asks for a hint on their active quest, give a clever, atmospheric hint that points them towards the right detail without giving away the answer completely.
3. If they ask about history, food gems, or architecture, share real historical anecdotes and local Madras secrets. You can leverage the attached Google Maps tool to lookup real, up-to-date regional information, locations, and landmarks.
4. Keep the response concise (2-4 sentences max), punchy, and engaging. Include 1-2 relevant emojis.`;

      const res = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: dialogueContents,
        config: {
          systemInstruction,
          tools: [{ googleMaps: {} }],
        }
      });

      const replyText = res.text?.trim() || "The stones of Madras hold centuries of stories. Step closer to the site and let's unlock the inscription together!";

      setChatMessages((prev) => [
        ...prev,
        {
          id: `maya-${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      triggerHaptic('light');
    } catch (err) {
      console.warn('Maya AI chat error:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `maya-${Date.now()}`,
          sender: 'assistant',
          text: "My chrono-sensors hit a brief solar flare! But keep your compass pointed forward—the heritage trail never fades.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiReplying(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };

  // Complete Quest & Claim Rewards
  const handleCompleteQuest = async () => {
    if (!activeQuest) return;
    triggerHaptic([50, 100, 150, 250]);
    setQuestCompleted(true);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'completedQuests', activeQuest.id), {
          ...activeQuest,
          photoEvidence: questEvidencePhoto || null,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Error recording completed quest in Firestore:', err);
      }
    }

    onShowToast(`🎉 Quest Complete! +${activeQuest.xpReward} XP awarded & stamped into Passport!`, 'celebration');
  };

  // Upload or Snap Photo Evidence for AR Quest
  const handleQuestPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      setQuestEvidencePhoto(dataUrl);
      triggerHaptic('medium');
      onShowToast('Mission challenge photo captured & attached! 📸', 'photo_camera');
    };
    reader.readAsDataURL(file);
  };

  // Start real-time navigation to quest spot
  const handleStartNavigationToSpot = (spot: UnifiedMapSpot) => {
    triggerHaptic('medium');
    onNavigateToSpot(spot);
    onShowToast(`Starting live GPS turn-by-turn navigation to ${spot.name}...`, 'near_me');
  };

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-4 space-y-6">
      {/* Hidden File Inputs for AR Quest Photo Capture & Gallery */}
      <input
        type="file"
        ref={questCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleQuestPhotoUpload}
      />
      <input
        type="file"
        ref={questGalleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleQuestPhotoUpload}
      />
      {/* Phase 1: AR Quest Assistant Header Banner */}
      <div className="pt-4 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[#F05423] text-white flex items-center justify-center shadow-lg shadow-[#F05423]/25 border border-[#F05423]/40">
              <span className="material-symbols-outlined text-[24px]">view_in_ar</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#F05423] uppercase tracking-widest">
                  KAOS Multimodal AR Engine
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  {gpsStatus === 'locked' ? `GPS ±${gpsAccuracy || 3}m` : 'GPS Active'}
                </span>
              </div>
              <h1 className="font-headline text-2xl sm:text-3xl text-white font-bold flex items-center gap-2">
                KAOS AR Quest Assistant
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo Last Placed 3D AR Artifact Button Overlay */}
            {sessionPlacedCount > 0 && (
              <button
                onClick={() => {
                  undoActionRef.current?.();
                  triggerHaptic('medium');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border border-amber-500/50 text-xs font-bold shadow-lg active:scale-95 transition-all cursor-pointer ring-1 ring-amber-400/40 animate-in fade-in"
                title={`Undo most recently placed "${lastPlacedArtifactName || 'artifact'}" (Ctrl+Z)`}
              >
                <span className="material-symbols-outlined text-[17px]">undo</span>
                <span>Undo ({sessionPlacedCount})</span>
              </button>
            )}

            <button
              onClick={() => {
                setInventoryOpen(true);
                triggerHaptic('light');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-orange-600/25 to-amber-600/25 hover:from-orange-600/40 hover:to-amber-600/40 text-orange-300 border border-orange-500/40 text-xs font-bold shadow active:scale-95 transition-all cursor-pointer"
              title="Open 3D Heritage Artifacts Inventory"
            >
              <span className="material-symbols-outlined text-[17px]">backpack</span>
              <span>3D Inventory</span>
            </button>

            <button
              onClick={() => handleGenerateInstantQuest(nearestSpot)}
              disabled={isGeneratingQuest}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#F05423] hover:bg-[#ff6130] text-white text-xs font-bold shadow-lg active:scale-95 transition-all cursor-pointer border border-[#F05423]/40"
            >
              <span className="material-symbols-outlined text-[18px] animate-spin-slow">auto_awesome</span>
              <span>{isGeneratingQuest ? 'Synthesizing...' : 'Quest Near Me'}</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-[#9898a0] mt-1.5">
          Real-time GPS tracking, camera challenges, riddle decryptions, and live guidance. Every place has a story.
        </p>
      </div>

      {/* Proximity-Based Audio Notification Radar & Alert Bar (< 50m of un-discovered 3D heritage site) */}
      <div className="space-y-2">
        {activeProximityHeritage ? (
          <div className="relative rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-emerald-950/40 via-[#181a1f] to-[#121418] border-2 border-emerald-500/60 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-[24px] animate-pulse">spatial_audio</span>
                  </div>
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#121418] animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold uppercase tracking-wider border border-emerald-500/30">
                      🔔 Subtle Directional Chime Alert • &lt; 50m
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {activeProximityHeritage.distanceMeters}m away • {activeProximityHeritage.directionInfo.label}
                    </span>
                    {activeProximityHeritage.isSimulated && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[8px] font-mono font-bold">
                        SIMULATED TEST
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline text-base sm:text-lg font-bold text-white mt-0.5 flex items-center gap-1.5">
                    <span>{activeProximityHeritage.site.name}</span>
                    <span className="text-xs font-normal text-emerald-300/80">
                      ({activeProximityHeritage.pan < -0.1 ? '🎧 Left Ear Pan' : activeProximityHeritage.pan > 0.1 ? '🎧 Right Ear Pan' : '🎧 Centered Pan'})
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-300 line-clamp-1 mt-0.5">
                    {activeProximityHeritage.site.subtitle || activeProximityHeritage.site.lore}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={handlePlayProximityChimeOnDemand}
                  className="px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                  title="Replay 528Hz Sacred Directional Chime with Stereo Panning"
                >
                  <span className="material-symbols-outlined text-[17px]">play_arrow</span>
                  <span>Play Chime</span>
                </button>

                <button
                  onClick={() => {
                    markSpotDiscovered(activeProximityHeritage.site.id, activeProximityHeritage.site.name);
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
                  title="Mark as Documented & Claim XP"
                >
                  <span className="material-symbols-outlined text-[17px]">military_tech</span>
                  <span>Document (+120 XP)</span>
                </button>

                <button
                  onClick={() => {
                    setQuestTargetSpot(activeProximityHeritage.site);
                    setActiveMode('viewfinder');
                    triggerHaptic('medium');
                    onShowToast(`Tracking "${activeProximityHeritage.site.name}" with glowing breadcrumbs!`, 'near_me');
                  }}
                  className="px-3 py-2 rounded-xl bg-orange-600/30 hover:bg-orange-600/40 text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                  title="Open AR Viewfinder & Trail"
                >
                  <span className="material-symbols-outlined text-[17px]">view_in_ar</span>
                  <span>View in AR</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-[#16151a] border border-[#2d2a34] text-xs shadow-md">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${proximityAudioEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-zinc-300 text-[11px]">
                <strong className="text-white">Proximity Audio System:</strong> {proximityAudioEnabled ? 'Active (Subtle 528Hz Chimes &lt; 50m of un-discovered heritage)' : 'Muted'}
              </span>
              <span className="hidden sm:inline text-zinc-500 text-[11px]">
                • {discoveredSpotIds.size} Documented
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSimulatedProximityActive(true);
                  handlePlayProximityChimeOnDemand();
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Simulate entering within 50m of a heritage site to experience subtle directional chime"
              >
                <span className="material-symbols-outlined text-[14px]">spatial_audio</span>
                <span>Test Chime (&lt;50m)</span>
              </button>

              <button
                onClick={() => {
                  setProximityAudioEnabled(!proximityAudioEnabled);
                  triggerHaptic('light');
                  onShowToast(!proximityAudioEnabled ? 'Proximity audio chimes enabled 🔔' : 'Proximity audio chimes muted 🔕', 'spatial_audio');
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
                title={proximityAudioEnabled ? 'Mute Proximity Chimes' : 'Enable Proximity Chimes'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {proximityAudioEnabled ? 'volume_up' : 'volume_off'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AR Navigation Mode Switcher */}
      <div className="flex items-center gap-1.5 p-1 bg-[#1a191e] rounded-2xl border border-[#2d2a34] shadow-md overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            setActiveMode('viewfinder');
            triggerHaptic('light');
          }}
          className={`flex-1 min-w-[155px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeMode === 'viewfinder'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
          <span>3D AR Viewfinder</span>
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[8px] font-mono font-bold">
            Trail & GPS
          </span>
        </button>

        {/* Shared-View Mode Tab Button */}
        <button
          onClick={() => {
            setActiveMode('shared-view');
            triggerHaptic('light');
          }}
          className={`flex-1 min-w-[145px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeMode === 'shared-view'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">group_work</span>
          <span>Shared-View</span>
          {activeSharedSession ? (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-400/25 text-emerald-300 text-[8px] font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-300 text-[8px] font-mono font-bold">
              Multi-User
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveMode('quest');
            triggerHaptic('light');
          }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeMode === 'quest'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">flag</span>
          <span>Mission Console</span>
        </button>

        <button
          onClick={() => {
            setActiveMode('assistant');
            triggerHaptic('light');
          }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeMode === 'assistant'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          <span>Maya AI Chat</span>
        </button>

        <button
          onClick={() => {
            setActiveMode('catalog');
            triggerHaptic('light');
          }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeMode === 'catalog'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">explore</span>
          <span>Bounty Board</span>
        </button>
      </div>

      {/* Primary AR Mode View: 3D AR Spatial Viewfinder with Camera & Acoustic Lore */}
      {activeMode === 'viewfinder' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Active Shared-View Session Live Sync Banner */}
          {activeSharedSession && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-[#141b22] to-[#121418] border border-cyan-500/50 shadow-lg text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <span className="material-symbols-outlined text-[18px]">group_work</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold">
                      Shared-View Live Sync: {activeSharedSession.sessionCode}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[8px] font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {activeSharedSession.activeParticipantsCount} EXPLORERS
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-300">
                    Host: <strong className="text-white">{activeSharedSession.hostUserName}</strong> • {activeSharedSession.placedArtifacts?.length || 0} Synced 3D Placements
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySharedLink}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/35 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Copy Temporary Local Session Link"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {sessionLinkCopied ? 'check' : 'link'}
                  </span>
                  <span>{sessionLinkCopied ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  onClick={() => setActiveMode('shared-view')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow active:scale-95"
                >
                  <span className="material-symbols-outlined text-[15px]">settings</span>
                  <span>Manage</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Session Placed Artifacts Status & Undo Banner */}
          {sessionPlacedCount > 0 && (
            <div className="flex items-center justify-between p-3 px-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#1c1815] to-[#16161a] border border-amber-500/50 text-xs shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <span className="material-symbols-outlined text-[18px]">deployed_code</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">
                      {sessionPlacedCount} Active 3D Artifact{sessionPlacedCount > 1 ? 's' : ''} Anchored
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-mono font-bold">
                      CURRENT SESSION
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-300">
                    Latest: <strong className="text-white">{lastPlacedArtifactName}</strong> • Tap Undo to remove (Ctrl+Z)
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  undoActionRef.current?.();
                  triggerHaptic('medium');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow active:scale-95"
                title="Undo most recently placed 3D AR artifact (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                <span>Undo Last Placed</span>
              </button>
            </div>
          )}

          <ArAcousticArtifactViewport
            userCoords={userCoords}
            gpsAccuracy={gpsAccuracy}
            nearestSpotName={nearestSpot?.name}
            targetSpot={questTargetSpot || nearestSpot}
            initialArtifactId={targetArtifactId}
            onShowToast={onShowToast}
            onOpenInventory={() => setInventoryOpen(true)}
            onSessionPlacedChange={(count, lastArtName, undoFn, allPlaced) => {
              setSessionPlacedCount(count);
              setLastPlacedArtifactName(lastArtName);
              if (undoFn) undoActionRef.current = undoFn;
              if (allPlaced) {
                setSessionPlacedArtifacts(allPlaced);
                // Synchronize placement to active shared-view session in real time
                if (activeSharedSession?.id) {
                  updateSharedArSessionPlacements(activeSharedSession.id, allPlaced);
                }
              }
            }}
            onRegisterUndo={(undoFn) => {
              undoActionRef.current = undoFn;
            }}
            sharedPlacedArtifacts={activeSharedSession?.placedArtifacts || []}
            isSharedViewActive={!!activeSharedSession}
            sharedSessionCode={activeSharedSession?.sessionCode}
            sharedHostName={activeSharedSession?.hostUserName}
            onOpenSharedView={() => setActiveMode('shared-view')}
          />
        </div>
      )}

      {/* Shared-View Mode: Real-time Multi-User AR Artifact Synchronization & Temporary Session Link */}
      {activeMode === 'shared-view' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="relative rounded-3xl p-6 bg-gradient-to-br from-[#121820] via-[#161c24] to-[#0e1318] border-2 border-cyan-500/50 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-[28px]">group_work</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                        AR Local Multi-User Engine
                      </span>
                      {activeSharedSession ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          LIVE SESSION ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 text-[9px] font-mono font-bold">
                          READY TO HOST / JOIN
                        </span>
                      )}
                    </div>
                    <h2 className="font-headline text-2xl font-bold text-white">
                      Shared-View Mode
                    </h2>
                  </div>
                </div>

                {activeSharedSession && (
                  <button
                    onClick={handleLeaveSharedSession}
                    className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Leave Session</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
                Invite fellow explorers in the same physical location to experience your 3D heritage artifacts.
                All participants share real-time artifact anchors, scaling gestures, and acoustic resonances
                aligned to the local ground plane.
              </p>

              {/* State 1: Active Session Display */}
              {activeSharedSession ? (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl bg-[#0b1016] border border-cyan-500/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                          TEMPORARY LOCAL SESSION CODE
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-widest">
                            {activeSharedSession.sessionCode}
                          </span>
                          <button
                            onClick={handleCopySharedLink}
                            className="p-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 transition-all cursor-pointer"
                            title="Copy code and link"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {sessionLinkCopied ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <div className="bg-[#121820] p-2.5 px-3 rounded-xl border border-zinc-700/60 text-center">
                          <span className="text-[10px] text-zinc-400 block font-mono">ROLE</span>
                          <span className="text-xs font-bold text-white">
                            {isSharedSessionHost ? '👑 Host' : '👤 Participant'}
                          </span>
                        </div>
                        <div className="bg-[#121820] p-2.5 px-3 rounded-xl border border-zinc-700/60 text-center">
                          <span className="text-[10px] text-zinc-400 block font-mono">EXPLORERS</span>
                          <span className="text-xs font-bold text-emerald-400">
                            {activeSharedSession.activeParticipantsCount} Active
                          </span>
                        </div>
                        <div className="bg-[#121820] p-2.5 px-3 rounded-xl border border-zinc-700/60 text-center">
                          <span className="text-[10px] text-zinc-400 block font-mono">PLACEMENTS</span>
                          <span className="text-xs font-bold text-cyan-400">
                            {activeSharedSession.placedArtifacts?.length || 0} Anchored
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Temporary Shareable Link Input with One-Tap Copy */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-cyan-400">link</span>
                        Temporary Local Session Link (3-Hour Active Window)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/?tab=ar-quest&sessionCode=${activeSharedSession.sessionCode}` : ''}
                          className="flex-1 bg-[#141b24] text-cyan-200 text-xs px-3.5 py-2.5 rounded-xl border border-cyan-500/30 font-mono select-all focus:outline-none"
                        />
                        <button
                          onClick={handleCopySharedLink}
                          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {sessionLinkCopied ? 'check' : 'content_copy'}
                          </span>
                          <span>{sessionLinkCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          onClick={handleNativeShareSession}
                          className="px-3 py-2.5 rounded-xl bg-[#1c2430] hover:bg-[#253040] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                          title="Share via device apps"
                        >
                          <span className="material-symbols-outlined text-[16px]">share</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Synchronized 3D Artifacts Placements List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-cyan-400">deployed_code</span>
                        <span>Synchronized 3D Artifacts in this Session ({activeSharedSession.placedArtifacts?.length || 0})</span>
                      </h4>
                      <button
                        onClick={() => setActiveMode('viewfinder')}
                        className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Anchor New in AR</span>
                      </button>
                    </div>

                    {activeSharedSession.placedArtifacts && activeSharedSession.placedArtifacts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activeSharedSession.placedArtifacts.map((art, idx) => (
                          <div
                            key={art.id || idx}
                            className="p-3 rounded-xl bg-[#0c1218] border border-cyan-500/30 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-black font-bold text-xs"
                                style={{ backgroundColor: art.color || '#06b6d4' }}
                              >
                                {art.artifactName ? art.artifactName.charAt(0) : '#'}
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-white truncate">
                                  {art.artifactName}
                                </h5>
                                <span className="text-[10px] text-zinc-400 font-mono block">
                                  Scale: {art.scale?.toFixed(2)}x • Pos: ({art.posX?.toFixed(1)}, {art.posZ?.toFixed(1)})
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] text-zinc-500 font-mono shrink-0">
                              {new Date(art.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-[#0b1016] border border-dashed border-zinc-700 text-center space-y-2">
                        <span className="material-symbols-outlined text-[32px] text-zinc-500">view_in_ar</span>
                        <p className="text-xs text-zinc-400">
                          No 3D artifacts have been placed yet in this session.
                        </p>
                        <button
                          onClick={() => setActiveMode('viewfinder')}
                          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow cursor-pointer transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px]">touch_app</span>
                          <span>Open Viewfinder & Tap Ground to Place</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Primary Launch Viewfinder CTA */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setActiveMode('viewfinder');
                        triggerHaptic('medium');
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-sm font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-cyan-400/40"
                    >
                      <span className="material-symbols-outlined text-[20px]">view_in_ar</span>
                      <span>Return to 3D AR Viewfinder (Live Multi-User Mode)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* State 2: No Active Session (Host or Join) */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  {/* Host Card */}
                  <div className="p-5 rounded-2xl bg-[#0c1218] border border-cyan-500/40 flex flex-col justify-between space-y-4 shadow-lg">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                          <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                        </div>
                        <h3 className="font-headline text-base font-bold text-white">
                          Host a Local Session
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Start a temporary 3-hour Shared-View AR session anchored around your current GPS coordinates ({nearestSpot?.name || 'Chennai'}).
                        Anyone with your link or code can immediately see your 3D placements.
                      </p>
                    </div>

                    <button
                      onClick={handleCreateSharedSession}
                      disabled={isCreatingSession}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-cyan-400/40 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px] animate-spin-slow">
                        {isCreatingSession ? 'sync' : 'add_circle'}
                      </span>
                      <span>{isCreatingSession ? 'Creating Session...' : 'Create Shared-View Session'}</span>
                    </button>
                  </div>

                  {/* Join Card */}
                  <div className="p-5 rounded-2xl bg-[#0c1218] border border-zinc-700/80 flex flex-col justify-between space-y-4 shadow-lg">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                          <span className="material-symbols-outlined text-[18px]">key</span>
                        </div>
                        <h3 className="font-headline text-base font-bold text-white">
                          Join via Session Code
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Received a temporary session code (e.g. <span className="font-mono text-cyan-300 font-bold">KAOS-8F2A</span>) from an explorer in the same area? Enter it below:
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={joinSessionCodeInput}
                          onChange={(e) => setJoinSessionCodeInput(e.target.value.toUpperCase())}
                          placeholder="e.g. KAOS-9J2A"
                          maxLength={10}
                          className="flex-1 bg-[#141b24] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-cyan-500 font-mono uppercase tracking-wider placeholder:text-zinc-600"
                        />
                        <button
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) {
                                // Extract session code if full URL was pasted
                                const match = text.match(/sessionCode=([A-Za-z0-9_-]+)/i);
                                setJoinSessionCodeInput((match ? match[1] : text).trim().toUpperCase());
                                triggerHaptic('light');
                              }
                            } catch {}
                          }}
                          className="px-2.5 py-2.5 rounded-xl bg-[#1c2430] hover:bg-[#253040] text-zinc-300 border border-zinc-700 text-xs font-semibold cursor-pointer"
                          title="Paste from clipboard"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_paste</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleJoinSessionByCode()}
                        disabled={isJoiningSession || !joinSessionCodeInput.trim()}
                        className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-orange-400/40"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isJoiningSession ? 'sync' : 'login'}
                        </span>
                        <span>{isJoiningSession ? 'Connecting...' : 'Join Shared-View Session'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instant Action Hero Card: Nearest Spot & Live GPS Triangulation */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a1a1e] via-[#201815] to-[#16161a] border border-orange-500/40 p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={nearestSpot.imageUrl}
                alt={nearestSpot.name}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border border-orange-500/40 shadow-xl"
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-black text-[9px] font-mono font-bold shadow-md">
                {distanceToNearest}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                  Nearest Spot
                </span>
                {(() => {
                  const status = evaluatePlaceOpenStatus(nearestSpot.openHours, nearestSpot.category);
                  return (
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 border ${status.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dotColorClass}`}></span>
                      <span>{status.statusLabel}</span>
                      <span className="text-zinc-500">•</span>
                      <span>{status.displayNote}</span>
                    </span>
                  );
                })()}
                <span className="text-[10px] text-zinc-400 font-mono">
                  {userCoords ? `${userCoords.lat.toFixed(4)}°N, ${userCoords.lng.toFixed(4)}°E` : 'Triangulating...'}
                </span>
              </div>
              <h3 className="font-headline text-lg sm:text-xl font-bold text-white">
                {nearestSpot.name}
              </h3>
              <p className="text-xs text-zinc-300 line-clamp-1">
                {nearestSpot.lore}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => {
                setActiveMode('viewfinder');
                triggerHaptic('medium');
                onShowToast(`Opening 3D AR Viewfinder for ${nearestSpot.name}`, 'view_in_ar');
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-orange-600/25 hover:bg-orange-600/35 text-orange-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-orange-500/40 shadow active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
              <span>3D AR Viewfinder</span>
            </button>

            <button
              onClick={() => handleStartNavigationToSpot(nearestSpot)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-cyan-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-cyan-500/40 shadow active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">near_me</span>
              <span>Live Navigate</span>
            </button>

            <button
              onClick={() => handleGenerateInstantQuest(nearestSpot)}
              disabled={isGeneratingQuest}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-orange-400/40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              <span>{isGeneratingQuest ? 'Generating...' : 'Start AR Quest'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Phase 2: Active Quest Console (If quest active) */}
      {activeQuest && questTargetSpot && (
        <div className="bg-[#18181c] rounded-3xl border-2 border-orange-500/60 p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                <span className="material-symbols-outlined text-[20px]">flag</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">
                  Active Mission • {activeQuest.difficulty}
                </span>
                <h3 className="font-headline text-lg font-bold text-white">
                  {activeQuest.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30">
                +{activeQuest.xpReward} XP
              </span>
              {questCompleted && (
                <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Completed
                </span>
              )}
            </div>
          </div>

          {/* Objective Box */}
          <div className="bg-[#121214] p-4 rounded-2xl border border-[#26262b] space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold text-orange-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">task_alt</span>
                Physical Field Objective
              </span>
              <span className="text-zinc-500">{activeQuest.zone}</span>
            </div>
            <p className="text-sm text-white font-medium">
              {activeQuest.objective}
            </p>
          </div>

          {/* Cryptic Riddle & Clue Decryptor */}
          <div className="bg-gradient-to-r from-orange-950/30 via-zinc-900 to-amber-950/20 p-4 rounded-2xl border border-orange-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
                Maya's Decrypted Riddle Clue
              </span>
              <button
                onClick={() => {
                  setCluesRevealed((prev) => Math.min(prev + 1, 2));
                  triggerHaptic('light');
                  onShowToast('Additional architectural nuance revealed!', 'lightbulb');
                }}
                className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">tips_and_updates</span>
                <span>Reveal Nuance ({cluesRevealed}/2)</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-amber-100 italic bg-black/40 p-3 rounded-xl border border-amber-500/20">
              "{activeQuest.riddleClue}"
            </p>
            {cluesRevealed >= 2 && (
              <p className="text-[11px] text-zinc-300 bg-orange-900/20 p-2.5 rounded-xl border border-orange-500/20 animate-in fade-in">
                💡 <span className="font-semibold text-orange-300">Maya's Extra Clue:</span> Look closely at the upper cornice or central gateway archway. Align your device compass directly with the sunward axis!
              </p>
            )}
          </div>

          {/* Mission Challenge Camera / Photo Evidence */}
          <div className="bg-[#121214] p-3.5 rounded-2xl border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-orange-400">photo_camera</span>
                <span>Camera Mission Evidence (Required Filter: {activeQuest.requiredFilter || 'peaberry-1924'})</span>
              </span>
              {questEvidencePhoto && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ Attached</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  questCameraInputRef.current?.click();
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                <span>Snap Camera Evidence</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  questGalleryInputRef.current?.click();
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 cursor-pointer active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">photo_library</span>
                <span>Upload from Photos</span>
              </button>
            </div>

            {/* Evidence Photo Preview */}
            {questEvidencePhoto && (
              <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 max-h-40 group">
                <img src={questEvidencePhoto} alt="Mission Evidence" className="w-full h-36 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setQuestEvidencePhoto(null);
                    triggerHaptic('light');
                  }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow cursor-pointer"
                  title="Remove Photo"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
                <span className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/75 text-[9px] text-emerald-300 font-mono border border-emerald-500/30">
                  Ready to verify & claim XP
                </span>
              </div>
            )}
          </div>

          {/* Phase 2 Action Buttons: 3D AR Anchor, Live Navigation, Live Lens AR, Complete Quest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            <button
              onClick={() => {
                setActiveMode('viewfinder');
                // Select matching acoustic artifact based on category or name
                const titleLower = activeQuest.title.toLowerCase();
                const zoneLower = activeQuest.zone.toLowerCase();
                if (titleLower.includes('coffee') || titleLower.includes('mess') || titleLower.includes('roast') || titleLower.includes('dosa')) {
                  setTargetArtifactId('madras-davarah-tumbler');
                } else if (titleLower.includes('conch') || zoneLower.includes('marina') || titleLower.includes('surf') || titleLower.includes('coast')) {
                  setTargetArtifactId('coromandel-shankha');
                } else if (titleLower.includes('belfry') || zoneLower.includes('george') || titleLower.includes('church') || titleLower.includes('armenian')) {
                  setTargetArtifactId('armenian-belfry-chime');
                } else if (titleLower.includes('rain') || titleLower.includes('monsoon') || zoneLower.includes('chettinad')) {
                  setTargetArtifactId('chettinad-monsoon-urn');
                } else {
                  setTargetArtifactId('kapaleeshwarar-bell');
                }
                triggerHaptic('medium');
                onShowToast(`Opening 3D AR Viewfinder to anchor artifact for "${activeQuest.title}"`, 'view_in_ar');
              }}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-purple-400/40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">view_in_ar</span>
              <span>Anchor 3D Artifact</span>
            </button>

            <button
              onClick={() => handleStartNavigationToSpot(questTargetSpot)}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-cyan-400/40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">turn_sharp_right</span>
              <span>Live Navigation</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('medium');
                onOpenLiveLens(activeQuest.requiredFilter || 'peaberry-1924', questTargetSpot || undefined);
              }}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-orange-400/40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">photo_camera</span>
              <span>AR Live Lens</span>
            </button>

            <button
              onClick={handleCompleteQuest}
              disabled={questCompleted}
              className={`py-3 px-4 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                questCompleted
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {questCompleted ? 'verified' : 'emoji_events'}
              </span>
              <span>{questCompleted ? 'Claimed in Passport' : 'Verify & Claim XP'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Phase 3: Maya AR Assistant Interactive Chrono-Chat */}
      <div className="bg-[#18181c] rounded-3xl border border-[#26262b] p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-orange-500 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[22px]">smart_toy</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#18181c]"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-headline text-base font-bold text-white">
                  Maya Chrono-Assistant
                </h3>
                <span className="px-2 py-0.2 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold">
                  Gemini Flash
                </span>
              </div>
              <p className="text-[11px] text-[#9898a0]">
                Ask for live quest hints, decipher ancient Tamil/Armenian inscriptions, or discover hidden dishes
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setChatMessages([
                {
                  id: `welcome-${Date.now()}`,
                  sender: 'assistant',
                  text: "Memory cleared. What mystery of Madras would you like to explore next?",
                  timestamp: 'Now',
                },
              ]);
              triggerHaptic('light');
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-[#26262b] transition-all"
            title="Clear Chat"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>

        {/* Chat message bubbles */}
        <div
          ref={chatScrollRef}
          className="max-h-60 overflow-y-auto space-y-3 pr-1 no-scrollbar text-xs"
        >
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/40 text-[12px] font-bold">
                  M
                </div>
              )}
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-none'
                    : 'bg-[#121214] text-zinc-200 border border-[#26262b] rounded-tl-none shadow'
                }`}
              >
                <p>{msg.text}</p>
                <span className="text-[9px] text-zinc-500 block mt-1 text-right">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}
          {isAiReplying && (
            <div className="flex items-center gap-2 text-xs text-orange-400 p-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">
                progress_activity
              </span>
              <span>Maya is consulting the Chennai Archives...</span>
            </div>
          )}
        </div>

        {/* Quick prompt suggestions */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            'Give me a hint for the active quest',
            'Where is the best filter coffee nearby?',
            'Tell me the secret of Madras High Court dome',
            'What is the oldest temple in Chennai?',
          ].map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => {
                setChatInput(promptText);
                triggerHaptic('light');
              }}
              className="px-2.5 py-1 rounded-full bg-[#121214] hover:bg-[#26262b] text-[10px] text-zinc-400 hover:text-white border border-[#26262b] shrink-0 transition-all cursor-pointer"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Chat input box */}
        <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask Maya for a hint, historical clue, or nearby secret..."
            className="flex-1 bg-[#121214] text-white text-xs px-4 py-3 rounded-xl border border-[#26262b] focus:outline-none focus:border-orange-500 transition-all placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isAiReplying}
            className="px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center active:scale-95 cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      </div>

      {/* Phase 4: AR Quest Catalog & District Bounty Board */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-headline text-lg font-bold text-white flex items-center gap-1.5">
              <span>District AR Bounty Board</span>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold">
                600+ Places
              </span>
            </h3>
            <p className="text-xs text-[#9898a0]">
              Select any place to launch an on-demand AR quest or start live real-time turn-by-turn navigation
            </p>
          </div>

          {/* Category Filter Pills & Open Now Toggle */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'All Quests', icon: 'explore' },
              { id: 'heritage', label: 'Heritage', icon: 'fort' },
              { id: 'food', label: 'Food Gems', icon: 'restaurant' },
              { id: 'architecture', label: 'Architecture', icon: 'domain' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setActiveCategoryFilter(f.id as any);
                  triggerHaptic('light');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  activeCategoryFilter === f.id
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-[#1a1a1e] text-[#9898a0] hover:bg-[#26262b] border border-[#26262b]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
                <span>{f.label}</span>
              </button>
            ))}

            {/* NEW: Open Now Only Filter Toggle */}
            <button
              onClick={() => {
                setOnlyOpenNow(!onlyOpenNow);
                triggerHaptic('light');
                onShowToast(!onlyOpenNow ? 'Showing ONLY open locations 🟢' : 'Showing all locations', 'schedule');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                onlyOpenNow
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow ring-1 ring-emerald-500/50'
                  : 'bg-[#1a1a1e] text-[#9898a0] hover:text-white border-[#26262b]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlyOpenNow ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500/60'}`}></span>
              <span>{onlyOpenNow ? 'Open Now (Active)' : 'Filter: Open Now'}</span>
            </button>
          </div>
        </div>

        {/* Search input for places */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by monument name, food specialty, or neighborhood..."
            className="w-full bg-[#18181c] text-white text-xs pl-10 pr-4 py-3 rounded-2xl border border-[#26262b] focus:outline-none focus:border-orange-500 transition-all placeholder:text-zinc-600"
          />
        </div>

        {/* Grid of Quest Candidates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSpots.map((spot) => {
            const dist = userCoords
              ? calculateDistanceKm(userCoords.lat, userCoords.lng, spot.lat, spot.lng)
              : null;
            const distFormatted = dist !== null
              ? dist < 1
                ? `${Math.round(dist * 1000)}m away`
                : `${dist.toFixed(1)}km away`
              : spot.neighborhood;

            const spotOpenStatus = evaluatePlaceOpenStatus(spot.openHours, spot.category);

            return (
              <div
                key={spot.id}
                className="bg-[#18181c] rounded-2xl p-3.5 border border-[#26262b] hover:border-orange-500/40 transition-all flex flex-col justify-between space-y-3 group shadow"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={spot.imageUrl}
                    alt={spot.name}
                    className="w-14 h-14 rounded-xl object-cover border border-orange-500/20 shrink-0 group-hover:scale-105 transition-all"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">
                        {spot.category}
                      </span>
                      {/* Open or Closed Status Badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 border ${spotOpenStatus.badgeClass}`}>
                        <span className={`w-1 h-1 rounded-full ${spotOpenStatus.dotColorClass}`}></span>
                        <span>{spotOpenStatus.statusLabel}</span>
                      </span>
                    </div>
                    <h4 className="font-headline text-sm font-bold text-white truncate">
                      {spot.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-1">
                      {spot.subtitle || spot.lore}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                        {distFormatted}
                      </span>
                      <span className="text-zinc-400 text-[9px]">{spotOpenStatus.displayNote}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-[#26262b]">
                  <button
                    onClick={() => handleStartNavigationToSpot(spot)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-cyan-400 text-xs font-bold transition-all flex items-center justify-center gap-1 border border-cyan-500/30 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">near_me</span>
                    <span>Navigate</span>
                  </button>

                  <button
                    onClick={() => handleGenerateInstantQuest(spot)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow"
                  >
                    <span className="material-symbols-outlined text-[14px]">view_in_ar</span>
                    <span>Quest</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3D Heritage Artifacts Inventory Browser Modal */}
      <ArtifactInventoryModal
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        currentlyEquippedId={targetArtifactId}
        onSelectAndEquipArtifact={(art: AcousticLoreArtifact) => {
          setTargetArtifactId(art.id);
          setActiveMode('viewfinder');
          triggerHaptic('medium');
          onShowToast(`Equipped 3D ${art.name} in AR Viewfinder!`, 'view_in_ar');
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
