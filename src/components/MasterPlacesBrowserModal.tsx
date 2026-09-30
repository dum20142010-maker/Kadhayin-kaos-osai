import React, { useState, useMemo } from 'react';
import { ALL_MASTER_PLACES_1000, GEOGRAPHICAL_CLUSTERS, searchMasterPlaces } from '../data/masterPlacesIndex';
import { CHENNAI_FOOD_GEMS_300 } from '../data/foodGems300';
import { CHENNAI_ARCHITECTURE_CORPUS } from '../data/architectureCorpus';
import { MasterPlace, AiPlaceExplainer } from '../types';
import { triggerHaptic } from '../lib/haptic';
import { evaluatePlaceOpenStatus } from '../lib/openingHours';
import { getAiPlaceExplainer, searchMasterPlacesWithGemini } from '../lib/aiExpeditionEngine';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface MasterPlacesBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onOpenAiPlanner: (clusterKey?: string) => void;
  onOpenQuestGenerator: (place: MasterPlace) => void;
  onNavigateToMapWithPlace?: (place: MasterPlace) => void;
}

export const MasterPlacesBrowserModal: React.FC<MasterPlacesBrowserModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onOpenAiPlanner,
  onOpenQuestGenerator,
  onNavigateToMapWithPlace,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'heritage300' | 'food300' | 'architecture'>('heritage300');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClusterKey, setSelectedClusterKey] = useState<string>('all');
  const [selectedFoodCategory, setSelectedFoodCategory] = useState<string>('all');
  const [onlyOpenNow, setOnlyOpenNow] = useState<boolean>(false);

  // Gemini Explainer states
  const [explainerPlace, setExplainerPlace] = useState<MasterPlace | null>(null);
  const [explainerData, setExplainerData] = useState<AiPlaceExplainer | null>(null);
  const [explainerLoading, setExplainerLoading] = useState<boolean>(false);
  const [questAccepted, setQuestAccepted] = useState<boolean>(false);

  // Gemini AI Search states
  const [isAiSearchActive, setIsAiSearchActive] = useState<boolean>(false);
  const [aiMatchedNumbers, setAiMatchedNumbers] = useState<number[] | null>(null);
  const [aiSearchLoading, setAiSearchLoading] = useState<boolean>(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  // Device Geolocation & Proximity Sorting State
  const [sortByProximity, setSortByProximity] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);

  // Photo Carousel State for Explainer Overlay
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [galleryViewMode, setGalleryViewMode] = useState<'carousel' | 'grid'>('carousel');
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({});

  // Visited spots state with LocalStorage and Firestore persistence
  const [visitedSpots, setVisitedSpots] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('kaos_visited_spots_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const SUGGESTED_KEYWORDS = [
    '☕ Filter Coffee',
    '🍗 Biryani',
    '🏛️ Indo-Saracenic',
    '🔔 Armenian',
    '🕌 Thousand Lights',
    '🛕 Gopuram',
    '🌊 Coast & Marina',
    '🎨 Art Deco',
    '🥞 Podi Dosa',
    '🥪 Murukku Sandwich',
    '📜 Colonial',
    '🏰 Fort & Port'
  ];

  const toggleVisited = async (spotKey: string, name: string) => {
    triggerHaptic('medium');
    const isNowVisited = !visitedSpots[spotKey];
    const updated = { ...visitedSpots, [spotKey]: isNowVisited };
    setVisitedSpots(updated);

    try {
      localStorage.setItem('kaos_visited_spots_v1', JSON.stringify(updated));
    } catch (err) {
      console.warn('LocalStorage visited save error:', err);
    }

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'visitedSpots', spotKey), {
          spotKey,
          name,
          visited: isNowVisited,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Firestore visited status sync error:', e);
      }
    }

    onShowToast(
      isNowVisited ? `Marked "${name}" as Visited! 🚩 (+25 XP)` : `Unmarked "${name}" as Visited`,
      isNowVisited ? 'check_circle' : 'undo'
    );
  };

  const handleSelectKeywordTag = (tagWithEmoji: string) => {
    const keyword = tagWithEmoji.replace(/^[^\w\s#]+/, '').trim();
    triggerHaptic('light');
    if (searchQuery.toLowerCase().includes(keyword.toLowerCase())) {
      setSearchQuery('');
      setAiMatchedNumbers(null);
    } else {
      setSearchQuery(keyword);
      setAiMatchedNumbers(null);
    }
  };

  // Haversine formula distance calculation in kilometers
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleToggleProximitySort = () => {
    triggerHaptic('medium');
    if (sortByProximity) {
      setSortByProximity(false);
      onShowToast('Proximity sorting disabled.', 'near_me_disabled');
      return;
    }

    if (userLocation) {
      setSortByProximity(true);
      onShowToast('Sorting places by distance to your current GPS position! 📍', 'near_me');
      return;
    }

    if (!navigator.geolocation) {
      onShowToast('Geolocation is not supported by your browser.', 'warning');
      return;
    }

    setGeoLoading(true);
    onShowToast('Acquiring device GPS coordinates...', 'radar');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setSortByProximity(true);
        setGeoLoading(false);
        onShowToast('GPS locked! Search results sorted by nearest proximity 🎯', 'my_location');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGeoLoading(false);
        // Fallback to central Chennai coordinates if user denies or in testing environment
        const fallbackChennai = { lat: 13.0827, lng: 80.2707 }; // Central Chennai
        setUserLocation(fallbackChennai);
        setSortByProximity(true);
        onShowToast('Using Central Chennai baseline for proximity sorting 🗺️', 'location_city');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const getPlacePhotos = (place: MasterPlace | any) => {
    const list: { url: string; caption: string; tag: 'Architecture' | 'Culinary' | 'Heritage' }[] = [];
    
    if (place.imageUrl && typeof place.imageUrl === 'string' && place.imageUrl.trim()) {
      list.push({
        url: place.imageUrl,
        caption: `${place.name} — Signature Landmark Facade`,
        tag: 'Heritage',
      });
    }

    if (place.category === 'Food Lore' || place.specialty) {
      list.push(
        {
          url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1000&auto=format&fit=crop&q=80',
          caption: `${place.specialty || 'Traditional Crispy Dosas & Chutneys'}`,
          tag: 'Culinary',
        },
        {
          url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1000&auto=format&fit=crop&q=80',
          caption: 'Frothy Peaberry Filter Coffee in Brass Davarah',
          tag: 'Culinary',
        },
        {
          url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000&auto=format&fit=crop&q=80',
          caption: 'Aromatic Dum Biryani with Saffron & Star Anise',
          tag: 'Culinary',
        }
      );
    } else if (place.category === 'Architecture' || (place.architecturalStyle && place.architecturalStyle.toLowerCase().includes('saracenic'))) {
      list.push(
        {
          url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=1000&auto=format&fit=crop&q=80',
          caption: 'Indo-Saracenic Red Oxide Columns & Rose Stained Glass',
          tag: 'Architecture',
        },
        {
          url: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1000&auto=format&fit=crop&q=80',
          caption: 'Classical Arches & Victorian Belfry Clock Tower',
          tag: 'Architecture',
        },
        {
          url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1000&auto=format&fit=crop&q=80',
          caption: 'Dravidian Stucco Sculpture & Temple Gopuram Elevation',
          tag: 'Architecture',
        }
      );
    } else {
      list.push(
        {
          url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1000&auto=format&fit=crop&q=80',
          caption: 'Coromandel Sacred Temple Architecture & Heritage Gopuram',
          tag: 'Heritage',
        },
        {
          url: 'https://images.unsplash.com/photo-1609137144827-0cfc341ec2b2?w=1000&auto=format&fit=crop&q=80',
          caption: 'Colonial George Town Row-House Courtyards & Wooden Verandas',
          tag: 'Architecture',
        },
        {
          url: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1000&auto=format&fit=crop&q=80',
          caption: 'Historic Madras Architectural Elevation & Belfries',
          tag: 'Heritage',
        }
      );
    }

    return list;
  };

  if (!isOpen) return null;

  const handleOpenExplainer = async (place: MasterPlace) => {
    triggerHaptic('medium');
    setExplainerPlace(place);
    setExplainerData(null);
    setExplainerLoading(true);
    setQuestAccepted(false);
    onShowToast(`Consulting Gemini on "${place.name}"... 🧠`, 'auto_awesome');

    try {
      const data = await getAiPlaceExplainer(place);
      setExplainerData(data);
    } catch (e) {
      console.error('Error getting AI explainer:', e);
      onShowToast('Could not reach Gemini. Loading backup historical data.', 'error');
    } finally {
      setExplainerLoading(false);
    }
  };

  const handleAcceptAiQuest = async () => {
    if (!explainerPlace || !explainerData) return;
    triggerHaptic('medium');
    setQuestAccepted(true);

    const generatedQuest = {
      id: `quest-${explainerPlace.number}-ai-${Date.now()}`,
      placeId: explainerPlace.id,
      placeNumber: explainerPlace.number,
      placeName: explainerPlace.name,
      zone: explainerPlace.zone,
      cluster: explainerPlace.cluster,
      title: explainerData.questTitle,
      riddleClue: explainerData.questRiddleClue,
      objective: explainerData.questObjective,
      challengeType: 'check_in' as const,
      xpReward: explainerData.questXpReward,
      difficulty: explainerData.questDifficulty,
      badgeReward: '✨ AI Chrono Voyager',
      isCompleted: false,
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'activeQuests', generatedQuest.id), generatedQuest);
      } catch (e) {
        console.warn('Firestore active quest error:', e);
      }
    }

    onShowToast(`Quest Accepted: "${explainerData.questTitle}" (+${explainerData.questXpReward} XP)!`, 'flag');
  };

  const handleExecuteAiSearch = async () => {
    if (!searchQuery.trim()) {
      onShowToast('Please enter a search query first!', 'warning');
      return;
    }
    
    // Select candidates matching current cluster key
    const currentClusterCandidates = selectedClusterKey === 'all'
      ? ALL_MASTER_PLACES_1000
      : ALL_MASTER_PLACES_1000.filter((p) => p.clusterKey === selectedClusterKey);

    triggerHaptic('medium');
    setAiSearchLoading(true);
    setAiSearchError(null);
    setAiMatchedNumbers(null);
    onShowToast('Consulting Gemini AI context engine...', 'auto_awesome');

    try {
      const matched = await searchMasterPlacesWithGemini(searchQuery, currentClusterCandidates);
      setAiMatchedNumbers(matched);
      if (matched.length === 0) {
        onShowToast('Gemini found no matches in this area.', 'info');
      } else {
        onShowToast(`Gemini mapped ${matched.length} semantic matches!`, 'verified');
      }
    } catch (err: any) {
      console.error('[UI] Gemini Search exception caught inside component:', err);
      const isQuota = err?.message?.includes('quota_limit_exceeded') || err?.message?.includes('exhausted');
      
      if (isQuota) {
        setAiSearchError('Gemini API quota exceeded. Standard high-speed search remains active.');
        onShowToast('Gemini quota reached. Fallback search active.', 'warning');
      } else {
        setAiSearchError('Semantic search temporarily offline. Standard search active.');
        onShowToast('AI search offline. Using local search.', 'error');
      }
    } finally {
      setAiSearchLoading(false);
    }
  };

  // Filter Master Places across full 1,000+ dataset by compounding cluster AND search/AI filters
  const rawMasterPlaces = ALL_MASTER_PLACES_1000.filter((p) => {
    // 1. Cluster Filter
    if (selectedClusterKey !== 'all' && p.clusterKey !== selectedClusterKey) return false;

    // 2. Search Filter (Standard vs AI Matcher)
    if (searchQuery.trim()) {
      if (isAiSearchActive && aiMatchedNumbers !== null) {
        return aiMatchedNumbers.includes(p.number);
      } else {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = q.match(/^#?(\d+)$/);
        if (numMatch) {
          return p.number === parseInt(numMatch[1], 10);
        }
        return (
          p.name.toLowerCase().includes(q) ||
          p.locator.toLowerCase().includes(q) ||
          p.zone.toLowerCase().includes(q) ||
          p.cluster.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.architecturalStyle && p.architecturalStyle.toLowerCase().includes(q)) ||
          p.lore.toLowerCase().includes(q)
        );
      }
    }
    return true;
  });

  const masterPlaces = rawMasterPlaces.filter((p) => {
    if (onlyOpenNow) {
      const status = evaluatePlaceOpenStatus((p as any).openHours || '06:00 AM – 08:30 PM', p.category);
      if (!status.isOpen) return false;
    }
    return true;
  });

  // Filter Food Gems
  const rawFoodGems = CHENNAI_FOOD_GEMS_300.filter((fg) => {
    if (selectedFoodCategory !== 'all' && fg.category !== selectedFoodCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      fg.name.toLowerCase().includes(q) ||
      fg.neighborhood.toLowerCase().includes(q) ||
      fg.specialty.toLowerCase().includes(q) ||
      `#${fg.number}`.includes(q)
    );
  });

  const foodGems = rawFoodGems.filter((fg) => {
    if (onlyOpenNow) {
      const status = evaluatePlaceOpenStatus('07:00 AM – 10:30 PM', fg.category);
      if (!status.isOpen) return false;
    }
    return true;
  });

  // Sort by Proximity pipeline for Master Places & Food Gems
  const sortedMasterPlaces = useMemo(() => {
    if (!sortByProximity || !userLocation) return masterPlaces;
    return [...masterPlaces].sort((a, b) => {
      const distA = calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [masterPlaces, sortByProximity, userLocation]);

  const sortedFoodGems = useMemo(() => {
    if (!sortByProximity || !userLocation) return foodGems;
    return [...foodGems].sort((a, b) => {
      const distA = calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [foodGems, sortByProximity, userLocation]);

  // Filter Architecture Movements
  const architectureMovements = CHENNAI_ARCHITECTURE_CORPUS.filter((movement) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      movement.name.toLowerCase().includes(q) ||
      movement.era.toLowerCase().includes(q) ||
      movement.description.toLowerCase().includes(q) ||
      movement.keyElements.some((el) => el.toLowerCase().includes(q)) ||
      movement.keySites.some((site) => site.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-[#18181c] rounded-3xl w-full max-w-4xl shadow-2xl border border-orange-500/30 overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navigation Bar */}
        <div className="p-4 bg-[#121214] border-b border-[#26262b] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/40">
                <span className="material-symbols-outlined text-[22px]">database</span>
              </div>
              <div>
                <h3 className="font-headline text-lg text-white font-bold flex items-center gap-1.5 flex-wrap">
                  Chennai & Region Master Directory
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold uppercase">
                    1,000+ Catalog
                  </span>
                  {Object.keys(visitedSpots).filter((k) => visitedSpots[k]).length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase flex items-center gap-1 border border-emerald-500/30">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      <span>{Object.keys(visitedSpots).filter((k) => visitedSpots[k]).length} Visited</span>
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-[#9898a0]">
                  1,000 Master Places & Heritage Landmarks • 300 Food Gems • Architecture Corpus
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Main 3 Corpus Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('heritage300');
                triggerHaptic('light');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                activeTab === 'heritage300'
                  ? 'bg-orange-600 text-white border-orange-500 shadow'
                  : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
              <span>300 Master Places</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('food300');
                triggerHaptic('light');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                activeTab === 'food300'
                  ? 'bg-amber-600 text-white border-amber-500 shadow'
                  : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">restaurant</span>
              <span>300 Food Gems</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('architecture');
                triggerHaptic('light');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                activeTab === 'architecture'
                  ? 'bg-teal-600 text-white border-teal-500 shadow'
                  : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">domain</span>
              <span>Architecture</span>
            </button>
          </div>

          {/* Suggested Keywords Tag Cloud */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-orange-400/90 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">label</span>
                <span>Suggested Keywords:</span>
              </span>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setAiMatchedNumbers(null);
                  }}
                  className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                >
                  Clear Tag Filter
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {SUGGESTED_KEYWORDS.map((tag) => {
                const keyword = tag.replace(/^[^\w\s#]+/, '').trim();
                const isActive = searchQuery.toLowerCase().includes(keyword.toLowerCase());
                return (
                  <button
                    key={tag}
                    onClick={() => handleSelectKeywordTag(tag)}
                    className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-orange-600/30 border-orange-500 text-orange-300 font-bold shadow ring-1 ring-orange-500/50'
                        : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white hover:border-[#383840]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input Bar & Open Now Toggle */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAiMatchedNumbers(null); // Clear previous AI search results instantly so keystrokes fall back to standard local search
                  }}
                  placeholder={
                    isAiSearchActive
                      ? "Ask Gemini semantically (e.g., 'colonial libraries', 'best filter coffee')..."
                      : "Search by #number (e.g. #121), name, neighborhood, or keywords..."
                  }
                  className={`w-full bg-[#1a1a1e] text-white px-3.5 py-2.5 pl-9 rounded-2xl border text-xs focus:outline-none transition-all ${
                    isAiSearchActive
                      ? 'border-indigo-500/50 focus:border-indigo-500 bg-indigo-950/5'
                      : 'border-[#26262b] focus:border-orange-500'
                  }`}
                />
                <span className={`material-symbols-outlined text-[18px] absolute left-3 top-2.5 ${
                  isAiSearchActive ? 'text-indigo-400' : 'text-[#9898a0]'
                }`}>
                  {isAiSearchActive ? 'psychology' : 'search'}
                </span>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setAiMatchedNumbers(null);
                    }}
                    className="w-5 h-5 rounded-full bg-[#26262b] flex items-center justify-center text-[#9898a0] hover:text-white absolute right-3 top-3"
                  >
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                )}
              </div>

              {/* Gemini AI Search Activator */}
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setIsAiSearchActive(!isAiSearchActive);
                  setAiMatchedNumbers(null);
                  setAiSearchError(null);
                  onShowToast(
                    !isAiSearchActive
                      ? 'Semantic Gemini Search enabled! ✨'
                      : 'Standard high-speed local search active.',
                    'psychology'
                  );
                }}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 border ${
                  isAiSearchActive
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow ring-1 ring-indigo-500/50'
                    : 'bg-[#1a1a1e] text-[#9898a0] hover:text-white border-[#26262b]'
                }`}
                title="Semantic Search Powered by Gemini"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>AI Search: {isAiSearchActive ? 'ON' : 'OFF'}</span>
              </button>

              {/* Run Gemini Search Button */}
              {isAiSearchActive && (
                <button
                  onClick={handleExecuteAiSearch}
                  disabled={aiSearchLoading || !searchQuery.trim()}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiSearchLoading ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">search_spark</span>
                  )}
                  <span>{aiSearchLoading ? 'Searching...' : 'Ask Gemini'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setOnlyOpenNow(!onlyOpenNow);
                  triggerHaptic('light');
                  onShowToast(!onlyOpenNow ? 'Showing ONLY currently Open spots 🟢' : 'Showing all spots', 'schedule');
                }}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 border ${
                  onlyOpenNow
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow ring-1 ring-emerald-500/50'
                    : 'bg-[#1a1a1e] text-[#9898a0] hover:text-white border-[#26262b]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${onlyOpenNow ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500/60'}`}></span>
                <span>{onlyOpenNow ? 'Open (Active)' : 'Filter: Open Now'}</span>
              </button>

              {/* Sort by Proximity (Device Geolocation) Toggle */}
              <button
                onClick={handleToggleProximitySort}
                disabled={geoLoading}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 border ${
                  sortByProximity
                    ? 'bg-orange-600/30 border-orange-500 text-orange-300 shadow ring-1 ring-orange-500/50'
                    : 'bg-[#1a1a1e] text-[#9898a0] hover:text-white border-[#26262b]'
                }`}
                title="Sort search results by closest GPS proximity to you"
              >
                {geoLoading ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px] text-orange-400">
                    {sortByProximity ? 'my_location' : 'near_me'}
                  </span>
                )}
                <span>{geoLoading ? 'Locating...' : sortByProximity ? 'Nearest (Active)' : 'Sort: Nearest'}</span>
              </button>
            </div>

            {/* Error Message or Status Banner */}
            {isAiSearchActive && (
              <div className="px-3 py-1.5 rounded-xl bg-indigo-950/20 border border-indigo-500/25 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                <span className="text-[10px] font-mono text-indigo-300 leading-normal flex-1">
                  {aiSearchError ? (
                    <span className="text-red-400 font-semibold">{aiSearchError}</span>
                  ) : aiMatchedNumbers !== null ? (
                    <span>Gemini returned {aiMatchedNumbers.length} matches. Standard query compounding remains active!</span>
                  ) : (
                    <span>Type keywords and click 'Ask Gemini' to trigger semantic AI search across {selectedClusterKey === 'all' ? 'all' : 'selected'} catalog places.</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: 300 HERITAGE & PLACES MASTER LIST */}
        {activeTab === 'heritage300' && (
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* Cluster Quick Filters */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setSelectedClusterKey('all')}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  selectedClusterKey === 'all'
                    ? 'bg-orange-600 text-white border-orange-500 shadow'
                    : 'bg-[#121214] text-[#9898a0] border-[#26262b]'
                }`}
              >
                All 300 Places
              </button>
              {GEOGRAPHICAL_CLUSTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedClusterKey(c.id);
                    triggerHaptic('light');
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                    selectedClusterKey === c.id
                      ? 'bg-orange-600 text-white border-orange-500 shadow'
                      : 'bg-[#121214] text-[#cfcfd6] hover:bg-[#202026] border-[#26262b]'
                  }`}
                >
                  <span>{c.shortName}</span>
                  <span className="text-[10px] opacity-75 font-mono">({c.count})</span>
                </button>
              ))}
            </div>

            {/* AI Action CTA Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-950/40 via-[#1e1e24] to-[#18181c] border border-orange-500/40 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1">
                  <span className="material-symbols-outlined text-orange-400 text-[16px]">auto_awesome</span>
                  <span>Want a customized expedition for this area?</span>
                </h4>
                <p className="text-[11px] text-[#9898a0]">
                  Let Gemini calculate the optimal walking route and generate sequential missions.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenAiPlanner(selectedClusterKey === 'all' ? 'fort-george-town' : selectedClusterKey);
                }}
                className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow shrink-0 active:scale-95 transition-all"
              >
                Plan Route
              </button>
            </div>

            {/* Places Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedMasterPlaces.map((place) => (
                <div
                  key={place.id}
                  className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b] hover:border-orange-500/40 transition-all flex flex-col justify-between space-y-2.5 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white text-[10px] font-mono font-bold">
                          #{place.number}
                        </span>
                        <span className="text-[11px] font-semibold text-orange-400">{place.zone}</span>
                        {(() => {
                          const status = evaluatePlaceOpenStatus((place as any).openHours || '06:00 AM – 08:30 PM', place.category);
                          return (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 border ${status.badgeClass}`}>
                              <span className={`w-1 h-1 rounded-full ${status.dotColorClass}`}></span>
                              <span>{status.statusLabel}</span>
                            </span>
                          );
                        })()}
                        {sortByProximity && userLocation && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">near_me</span>
                            <span>
                              {(() => {
                                const d = calculateDistanceKm(userLocation.lat, userLocation.lng, place.lat, place.lng);
                                return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
                              })()}
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-400">+{place.xp} XP</span>
                    </div>

                    <h4 className="font-headline text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                      {place.name}
                    </h4>

                    <p className="text-[11px] text-[#9898a0] line-clamp-2 leading-relaxed">{place.lore}</p>
                    <p className="text-[10px] text-[#71717a] font-mono truncate">{place.locator}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#26262b] gap-1 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-amber-400 font-semibold truncate max-w-[80px]">{place.category}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisited(`place-${place.number}`, place.name);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0 ${
                          visitedSpots[`place-${place.number}`]
                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                            : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white hover:border-[#383840]'
                        }`}
                        title="Mark as Visited"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {visitedSpots[`place-${place.number}`] ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span>{visitedSpots[`place-${place.number}`] ? 'Visited' : 'Mark Visited'}</span>
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToMapWithPlace?.(place);
                        }}
                        className="p-1.5 rounded-lg bg-[#1a1a1e] hover:bg-[#26262b] text-[#cfcfd6] hover:text-white text-[11px] font-semibold border border-[#26262b] flex items-center gap-1"
                        title="Plot on Google Map"
                      >
                        <span className="material-symbols-outlined text-[14px] text-orange-400">near_me</span>
                        <span>Map</span>
                      </button>

                      <button
                        onClick={() => handleOpenExplainer(place)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[11px] font-bold border border-indigo-500/30 transition-colors flex items-center gap-1 active:scale-95"
                        title="Consult Gemini AI Explainer & Bio"
                      >
                        <span className="material-symbols-outlined text-[14px]">psychology</span>
                        <span>AI Explainer</span>
                      </button>

                      <button
                        onClick={() => {
                          onClose();
                          onOpenQuestGenerator(place);
                        }}
                        className="px-2 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white text-[11px] font-bold border border-orange-500/30 transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                        <span>AI Quest</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: 300 HIDDEN FOOD GEMS */}
        {activeTab === 'food300' && (
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* Category Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: 'all', label: 'All 300 Food Gems' },
                { key: 'Tiffin & Coffee', label: '☕ Tiffin & Coffee' },
                { key: 'Biryani & Non-Veg', label: '🍗 Biryani & Non-Veg' },
                { key: 'Sweets & Chaat', label: '🍡 Sweets & Chaat' },
                { key: 'Seafood & Coastal', label: '🐟 Seafood & Coastal' },
                { key: 'Traditional Meals', label: '🍌 Banana Leaf Meals' },
                { key: 'Tea & Evening Snacks', label: '🫖 Tea & Snacks' },
              ].map((fc) => (
                <button
                  key={fc.key}
                  onClick={() => {
                    setSelectedFoodCategory(fc.key);
                    triggerHaptic('light');
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    selectedFoodCategory === fc.key
                      ? 'bg-amber-600 text-white border-amber-500 shadow'
                      : 'bg-[#121214] text-[#cfcfd6] hover:bg-[#202026] border-[#26262b]'
                  }`}
                >
                  {fc.label}
                </button>
              ))}
            </div>

            {/* Food Gems Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedFoodGems.map((food) => (
                <div
                  key={food.id}
                  className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b] hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2 group"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-mono font-bold">
                          #{food.number}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-400">{food.neighborhood}</span>
                        {(() => {
                          const status = evaluatePlaceOpenStatus('07:00 AM – 10:30 PM', food.category);
                          return (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 border ${status.badgeClass}`}>
                              <span className={`w-1 h-1 rounded-full ${status.dotColorClass}`}></span>
                              <span>{status.statusLabel}</span>
                            </span>
                          );
                        })()}
                        {sortByProximity && userLocation && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">near_me</span>
                            <span>
                              {(() => {
                                const d = calculateDistanceKm(userLocation.lat, userLocation.lng, food.lat, food.lng);
                                return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
                              })()}
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-400">+{food.xp} XP</span>
                    </div>

                    <h4 className="font-headline text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                      {food.name}
                    </h4>

                    <div className="p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300 font-semibold">
                      🍽️ {food.specialty}
                    </div>

                    <p className="text-[11px] text-[#9898a0] leading-relaxed">{food.lore}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#26262b] gap-1 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#9898a0] truncate max-w-[80px]">{food.category}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisited(`food-${food.number}`, food.name);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0 ${
                          visitedSpots[`food-${food.number}`]
                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                            : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white hover:border-[#383840]'
                        }`}
                        title="Mark as Visited"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {visitedSpots[`food-${food.number}`] ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span>{visitedSpots[`food-${food.number}`] ? 'Visited' : 'Mark Visited'}</span>
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleOpenExplainer(food as any)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[11px] font-bold border border-indigo-500/30 transition-colors flex items-center gap-1 active:scale-95"
                        title="Consult Gemini AI Explainer & Bio"
                      >
                        <span className="material-symbols-outlined text-[14px]">psychology</span>
                        <span>AI Explainer</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          onShowToast(`Added "${food.name}" to Taste Explorer Bucket List! ☕`, 'restaurant');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white text-[11px] font-bold border border-amber-500/30 transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[14px]">bookmark</span>
                        <span>Save Spot</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ARCHITECTURE MOVEMENTS CORPUS */}
        {activeTab === 'architecture' && (
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            <div className="space-y-3">
              {architectureMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="p-4 rounded-3xl bg-[#121214] border border-[#26262b] hover:border-orange-500/40 transition-all space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow"
                      style={{ backgroundColor: `${movement.color}25`, color: movement.color }}
                    >
                      <span className="material-symbols-outlined text-[24px]">{movement.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h4 className="font-headline text-base font-bold text-white">{movement.name}</h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVisited(`arch-${movement.id}`, movement.name);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                              visitedSpots[`arch-${movement.id}`]
                                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-sm'
                                : 'bg-[#1a1a1e] text-[#9898a0] border-[#26262b] hover:text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {visitedSpots[`arch-${movement.id}`] ? 'check_box' : 'check_box_outline_blank'}
                            </span>
                            <span>{visitedSpots[`arch-${movement.id}`] ? 'Explored' : 'Mark Visited'}</span>
                          </button>
                          <span className="text-[10px] font-mono text-orange-400 font-bold">{movement.era}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#9898a0] mt-1 leading-relaxed">{movement.description}</p>
                    </div>
                  </div>

                  {/* Key Elements Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {movement.keyElements.map((el, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-[#1a1a1e] text-[#cfcfd6] text-[10px] font-semibold border border-[#26262b]"
                      >
                        ✓ {el}
                      </span>
                    ))}
                  </div>

                  {/* Key Sites List */}
                  <div className="bg-[#1a1a1e] p-3 rounded-2xl border border-[#26262b] space-y-1.5">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                      Signature Landmarks & Sites
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-white/90">
                      {movement.keySites.map((site, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-orange-400 text-[10px]">▪</span>
                          <span>{site}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gemini AI Explainer Overlay */}
        {explainerPlace && (
          <div className="absolute inset-0 bg-[#121114] z-30 flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-4 bg-[#18181c] border-b border-[#26262b] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/40">
                  <span className="material-symbols-outlined text-[20px] animate-pulse">psychology</span>
                </div>
                <div>
                  <h4 className="font-headline text-base text-white font-extrabold flex items-center gap-1.5">
                    Gemini AI Explainer
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                      Grounding active
                    </span>
                  </h4>
                  <p className="text-[10px] text-[#9898a0]">
                    Real-time historical biography, heritage breakdown & tailored quest
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setExplainerPlace(null);
                  setExplainerData(null);
                }}
                className="w-8 h-8 rounded-full bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white border border-[#26262b]"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-zinc-100">
              {/* Target Landmark Core Info */}
              <div className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-mono font-bold">
                    #{explainerPlace.number}
                  </span>
                  <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                    {explainerPlace.zone || (explainerPlace as any).neighborhood || 'Chennai'}
                  </span>
                  {userLocation && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">near_me</span>
                      <span>
                        {(() => {
                          const d = calculateDistanceKm(userLocation.lat, userLocation.lng, explainerPlace.lat, explainerPlace.lng);
                          return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
                        })()}
                      </span>
                    </span>
                  )}
                </div>
                <h3 className="font-headline text-xl text-white font-bold tracking-tight">
                  {explainerPlace.name}
                </h3>
                <p className="text-xs text-[#71717a] font-mono">{explainerPlace.locator}</p>
              </div>

              {/* Photo Carousel & Visual Explorer with Placeholder CAD Grid Fallback */}
              <div className="rounded-3xl bg-[#18181c] border border-[#26262b] p-4 space-y-3 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-400 text-[18px]">photo_library</span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-headline">
                      Architectural & Field Photography
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#121214] p-1 rounded-xl border border-[#26262b]">
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setGalleryViewMode('carousel');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        galleryViewMode === 'carousel'
                          ? 'bg-orange-600 text-white shadow'
                          : 'text-[#9898a0] hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">view_carousel</span>
                      <span>Carousel</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setGalleryViewMode('grid');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        galleryViewMode === 'grid'
                          ? 'bg-orange-600 text-white shadow'
                          : 'text-[#9898a0] hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">grid_view</span>
                      <span>Grid</span>
                    </button>
                  </div>
                </div>

                {/* Carousel View Mode */}
                {galleryViewMode === 'carousel' && (
                  <div className="relative rounded-2xl overflow-hidden bg-black/70 border border-[#26262b] aspect-video group shadow-inner">
                    {(() => {
                      const photos = getPlacePhotos(explainerPlace);
                      const currentPhoto = photos[activeSlideIndex % photos.length];
                      const isError = imgErrorMap[currentPhoto.url];

                      if (isError || !currentPhoto.url) {
                        return (
                          /* Cyber-Heritage CAD Placeholder Grid */
                          <div className="w-full h-full p-4 bg-gradient-to-br from-[#1b1b22] via-[#121216] to-[#181820] flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

                            <div className="flex justify-between items-start z-10">
                              <span className="px-2.5 py-1 rounded-md bg-orange-600/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">architecture</span>
                                <span>ARCHITECTURAL FIELD CAD</span>
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">#{explainerPlace.number} // {explainerPlace.zone}</span>
                            </div>

                            <div className="flex flex-col items-center justify-center space-y-1.5 z-10 text-center">
                              <div className="w-14 h-14 rounded-2xl border border-orange-500/40 bg-orange-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-orange-400 text-3xl">domain</span>
                              </div>
                              <h5 className="font-headline text-sm font-bold text-white">{explainerPlace.name}</h5>
                              <p className="text-[10px] text-zinc-400 font-mono">LAT {explainerPlace.lat?.toFixed(4)}° N • LNG {explainerPlace.lng?.toFixed(4)}° E</p>
                            </div>

                            <div className="flex justify-between items-end z-10 text-[10px] text-zinc-400 font-mono">
                              <span>STYLE: {explainerPlace.architecturalStyle || 'Colonial & Dravidian Heritage'}</span>
                              <span className="text-orange-400 font-bold">STATUS: VERIFIED</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="relative w-full h-full">
                          <img
                            src={currentPhoto.url}
                            alt={currentPhoto.caption}
                            referrerPolicy="no-referrer"
                            onError={() => setImgErrorMap((prev) => ({ ...prev, [currentPhoto.url]: true }))}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 pointer-events-none"></div>

                          {/* Tag Badge & Counter */}
                          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-orange-400 text-[10px] font-bold border border-white/15 uppercase tracking-wider flex items-center gap-1 shadow-sm">
                              <span className="material-symbols-outlined text-[13px]">
                                {currentPhoto.tag === 'Culinary' ? 'restaurant' : currentPhoto.tag === 'Architecture' ? 'domain' : 'account_balance'}
                              </span>
                              <span>{currentPhoto.tag}</span>
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-black/75 backdrop-blur-md text-zinc-300 text-[10px] font-mono border border-white/15">
                              {activeSlideIndex + 1} / {photos.length}
                            </span>
                          </div>

                          {/* Caption */}
                          <div className="absolute bottom-3 left-3 right-3 z-10">
                            <p className="text-xs text-white font-medium drop-shadow-md bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 truncate">
                              {currentPhoto.caption}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Navigation Chevrons */}
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        const photos = getPlacePhotos(explainerPlace);
                        setActiveSlideIndex((prev) => (prev - 1 + photos.length) % photos.length);
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/75 backdrop-blur-md text-white flex items-center justify-center hover:bg-orange-600 transition-colors border border-white/15 cursor-pointer shadow-md"
                      aria-label="Previous photo"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>

                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        const photos = getPlacePhotos(explainerPlace);
                        setActiveSlideIndex((prev) => (prev + 1) % photos.length);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/75 backdrop-blur-md text-white flex items-center justify-center hover:bg-orange-600 transition-colors border border-white/15 cursor-pointer shadow-md"
                      aria-label="Next photo"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                )}

                {/* Photo Grid View Mode */}
                {galleryViewMode === 'grid' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {getPlacePhotos(explainerPlace).map((photo, pIdx) => {
                      const isError = imgErrorMap[photo.url];
                      return (
                        <div
                          key={pIdx}
                          onClick={() => {
                            triggerHaptic('light');
                            setActiveSlideIndex(pIdx);
                            setGalleryViewMode('carousel');
                          }}
                          className="aspect-square rounded-2xl overflow-hidden relative border border-[#26262b] bg-[#121214] group cursor-pointer hover:border-orange-500/50 transition-all shadow-sm"
                        >
                          {!isError && photo.url ? (
                            <img
                              src={photo.url}
                              alt={photo.caption}
                              referrerPolicy="no-referrer"
                              onError={() => setImgErrorMap((prev) => ({ ...prev, [photo.url]: true }))}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full p-2 bg-gradient-to-br from-zinc-900 to-black flex flex-col items-center justify-center text-center">
                              <span className="material-symbols-outlined text-orange-400 text-xl mb-1">domain</span>
                              <span className="text-[9px] text-zinc-400 font-mono">Spot #{explainerPlace.number}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <span className="text-[9px] text-white font-medium truncate">{photo.caption}</span>
                          </div>
                          <div className="absolute top-1.5 left-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-bold text-orange-400 uppercase">
                              {photo.tag}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {explainerLoading ? (
                /* Glowing Loading State */
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="relative">
                    <span className="material-symbols-outlined text-indigo-400 text-5xl animate-spin">
                      progress_activity
                    </span>
                    <span className="material-symbols-outlined text-indigo-300 text-xl absolute inset-0 m-auto flex items-center justify-center">
                      auto_awesome
                    </span>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-white tracking-wide">Retrieving Heritage Chronicle...</p>
                    <p className="text-xs text-[#9898a0] max-w-xs font-sans">
                      Gemini is generating contextual bios, structural explainers, and local lore quests.
                    </p>
                  </div>
                </div>
              ) : explainerData ? (
                /* Loaded Content */
                <div className="space-y-5">
                  {/* Biography (Bio) */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">
                      // HISTORICAL BIOGRAPHY (BIO)
                    </span>
                    <p className="text-sm text-zinc-200 leading-relaxed bg-[#18181c]/60 p-4 rounded-2xl border border-[#26262b]/80">
                      {explainerData.bio}
                    </p>
                  </div>

                  {/* Chronicle & Vintage History (History) */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">
                      // CHRONICLE & VINTAGE HISTORY
                    </span>
                    <p className="text-sm text-zinc-200 leading-relaxed bg-[#18181c]/60 p-4 rounded-2xl border border-[#26262b]/80">
                      {explainerData.history}
                    </p>
                  </div>

                  {/* Heritage & Architecture Explainer (Heritage Explainer) */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">
                      // HERITAGE & ARCHITECTURE EXPLAINER
                    </span>
                    <p className="text-sm text-zinc-200 leading-relaxed bg-[#18181c]/60 p-4 rounded-2xl border border-[#26262b]/80">
                      {explainerData.heritage_explainer}
                    </p>
                  </div>

                  {/* Immersive Quest Details (Quest) */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">
                      // IMMERSIVE QUEST DETAILS
                    </span>
                    <p className="text-sm text-zinc-200 leading-relaxed bg-[#18181c]/60 p-4 rounded-2xl border border-[#26262b]/80">
                      {explainerData.quest}
                    </p>
                  </div>

                  {/* Vintage Trivia */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">
                      // TIMELINE & VINTAGE TRIVIA
                    </span>
                    <div className="space-y-2">
                      {explainerData.vintageTrivia.map((trivia, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 bg-[#18181c]/40 p-3.5 rounded-xl border border-[#26262b]/60"
                        >
                          <span className="text-indigo-400 text-sm mt-0.5 font-bold">{index + 1}.</span>
                          <p className="text-xs text-zinc-300 leading-relaxed">{trivia}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tailored AI Quest */}
                  <div className="bg-gradient-to-br from-indigo-950/30 to-[#18181c] p-5 rounded-2xl border border-indigo-500/40 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 rounded-md uppercase tracking-wider">
                          GEMINI CUSTOM QUEST
                        </span>
                        <h4 className="font-headline text-lg text-white font-bold leading-tight">
                          {explainerData.questTitle}
                        </h4>
                      </div>
                      <span className="px-2 py-1 rounded bg-teal-500/10 text-teal-400 text-[10px] font-bold border border-teal-500/20 font-mono">
                        +{explainerData.questXpReward} XP
                      </span>
                    </div>

                    <div className="bg-black/40 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                      <span className="text-[10px] font-bold text-[#9898a0] uppercase tracking-wider block">
                        Riddle Clue
                      </span>
                      <p className="text-xs text-indigo-300 italic font-medium leading-relaxed">
                        "{explainerData.questRiddleClue}"
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#9898a0] uppercase tracking-wider block">
                        Objective
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {explainerData.questObjective}
                      </p>
                    </div>

                    {/* Quest Status / Claim Action */}
                    <button
                      onClick={handleAcceptAiQuest}
                      disabled={questAccepted}
                      className={`w-full py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow transition-all ${
                        questAccepted
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 cursor-pointer'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {questAccepted ? 'check_circle' : 'assignment'}
                      </span>
                      <span>{questAccepted ? 'Quest Logged' : 'Accept Custom Quest'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Error Fallback */
                <div className="text-center py-10">
                  <p className="text-xs text-red-400">Failed to load detailed lore. Please try again.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
