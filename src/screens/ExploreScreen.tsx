import React, { useState, useEffect, useMemo } from 'react';
import { Discovery } from '../types';
import { mockNeighbourhoods } from '../data/mockData';
import { ALL_UNIFIED_MAP_SPOTS, mapSpotToDiscovery } from '../data/allUnifiedSpots';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { SearchHistoryView } from '../components/SearchHistoryView';
import { saveUserSearch } from '../lib/searchHistory';

interface ExploreScreenProps {
  onOpenDossier: (disc: Discovery) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateTab: (tab: any) => void;
  onOpenLiveLens?: () => void;
  onOpenPassport?: () => void;
  onOpenSecretPass?: () => void;
  onOpenMoodRadar?: () => void;
}

interface CommunityEcho {
  id: string;
  author: string;
  handle: string;
  spot: string;
  snippet: string;
  timestamp: string;
  likes: number;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  onOpenDossier,
  onShowToast,
  onNavigateTab,
  onOpenLiveLens,
  onOpenPassport,
  onOpenSecretPass,
  onOpenMoodRadar,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Community Echoes state
  const [echoes, setEchoes] = useState<CommunityEcho[]>([
    {
      id: 'echo-1',
      author: 'Srividya R.',
      handle: '@mylapore_scribe',
      spot: 'Triplicane Alchemist Well',
      snippet: 'Found an unmapped stone carving near the crumbling 17th-century well mentioning Dutch water treaties of 1682!',
      timestamp: '2 hours ago',
      likes: 24,
    },
    {
      id: 'echo-2',
      author: 'Karthik V.',
      handle: '@george_town_walker',
      spot: 'Armenian Church Belfry',
      snippet: 'Listening to the Whitechapel bronze bells at 07:00 AM in George Town is pure meditative serenity.',
      timestamp: '5 hours ago',
      likes: 41,
    },
    {
      id: 'echo-3',
      author: 'Ananya S.',
      handle: '@coastal_cartographer',
      spot: 'Marina Ghost Lighthouse',
      snippet: 'The rusted spiral staircase still echoes with whispers of old lighthouse keepers from the 1920s.',
      timestamp: 'Yesterday',
      likes: 59,
    },
  ]);

  const [newEchoSpot, setNewEchoSpot] = useState('');
  const [newEchoSnippet, setNewEchoSnippet] = useState('');
  const [contributeOpen, setContributeOpen] = useState(false);

  // Debounced auto-save for typed search queries
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) return;

    const timer = setTimeout(() => {
      saveUserSearch(user?.uid, trimmed, 'keyword');
    }, 1200);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    triggerHaptic('light');
    saveUserSearch(user?.uid, trimmed, 'keyword');
    onShowToast(`Searching for "${trimmed}"`, 'search');
  };

  const handleSelectHistorySearch = (query: string) => {
    setSearchQuery(query);
    triggerHaptic('medium');
    saveUserSearch(user?.uid, query, 'keyword');
    onShowToast(`Filtered by "${query}"`, 'history');
  };

  const handleContributeEcho = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEchoSpot.trim() || !newEchoSnippet.trim()) return;

    triggerHaptic('medium');
    const newEntry: CommunityEcho = {
      id: `echo-${Date.now()}`,
      author: user?.displayName || 'User',
      handle: user?.email ? `@${user.email.split('@')[0]}` : '@explorer',
      spot: newEchoSpot.trim(),
      snippet: newEchoSnippet.trim(),
      timestamp: 'Just now',
      likes: 1,
    };

    setEchoes([newEntry, ...echoes]);
    setNewEchoSpot('');
    setNewEchoSnippet('');
    setContributeOpen(false);
    onShowToast('Echo contributed to local knowledge graph! (+50 XP)', 'hub');
  };

  const toggleBookmark = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    setBookmarks((prev) => {
      const next = !prev[title];
      onShowToast(
        next ? `Saved "${title}" to Field Journal` : `Removed from Field Journal`,
        next ? 'bookmark_added' : 'bookmark_remove'
      );
      return { ...prev, [title]: next };
    });
  };

  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [deepSearchResults, setDeepSearchResults] = useState<string[] | null>(null);
  const [isDeepSearching, setIsDeepSearching] = useState(false);

  // Deep Semantic Search with Gemini
  const handleDeepSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsDeepSearching(true);
    setDeepSearchResults(null);
    triggerHaptic('heavy');
    onShowToast(`Consulting Deep Lore Archives for "${searchQuery}"...`, 'psychology');

    try {
      const prompt = `You are the lead curator of the KAOS Chennai Archive.
Find the most relevant heritage landmarks, food gems, or architectural sites for this query: "${searchQuery}"

Context:
- Landmarks have names, zones, and descriptions related to Chennai history (Mylapore, George Town, Marina, etc.).
- Categories: heritage, food, architecture, secret.

Return a list of up to 10 Landmark IDs (starting with heritage-mp-, food-fg-, or arch-) that match this semantic vibe.
Return ONLY valid JSON: { "matches": ["id1", "id2", ...] }`;

      const res = await fetch('/api/ai/search-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.text) {
        const parsed = JSON.parse(data.text);
        setDeepSearchResults(parsed.matches || []);
        onShowToast(`Semantic Search: Found ${parsed.matches?.length || 0} matches`, 'auto_awesome');
      }
    } catch (err) {
      console.warn('Deep Search Error:', err);
      onShowToast('Deep Search is currently busy. Falling back to local index.', 'warning');
    } finally {
      setIsDeepSearching(false);
    }
  };

  const allDiscoveriesFromUnified = useMemo(() => {
    return ALL_UNIFIED_MAP_SPOTS.map(mapSpotToDiscovery);
  }, []);

  const filteredDiscoveries = useMemo(() => {
    let base = allDiscoveriesFromUnified;

    if (isDeepSearch && deepSearchResults) {
      base = base.filter(d => deepSearchResults.includes(d.id));
    } else {
      if (activeCat !== 'all') {
        base = base.filter(d => d.categoryKey === activeCat);
      }
      if (selectedZone) {
        base = base.filter(d => d.zone === selectedZone || d.zone.includes(selectedZone));
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        base = base.filter(disc => 
          disc.title.toLowerCase().includes(q) ||
          disc.zone.toLowerCase().includes(q) ||
          disc.description.toLowerCase().includes(q) ||
          (disc.architecturalStyle && disc.architecturalStyle.toLowerCase().includes(q))
        );
      }
    }
    return base;
  }, [allDiscoveriesFromUnified, activeCat, selectedZone, searchQuery, isDeepSearch, deepSearchResults]);

  return (
    <div className="flex flex-col w-full pb-24 max-w-4xl mx-auto px-4 space-y-5 bg-[#121114] text-zinc-100">
      {/* Title Header */}
      <div className="pt-4 pb-1 border-b border-[#26242c]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="material-symbols-outlined text-[18px] text-[#F05423]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            travel_explore
          </span>
          <span className="text-[10px] text-[#F05423] uppercase tracking-widest font-mono font-bold">
            KAOS Field Catalog • Every place has a story
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-headline text-2xl sm:text-3xl text-white font-extrabold tracking-tight">Explore Chennai</h1>
          <span className="text-xs font-mono font-bold text-[#F05423] px-3 py-1 rounded-full bg-[#F05423]/10 border border-[#F05423]/30 shadow-sm">
            {filteredDiscoveries.length} Gems Uncovered
          </span>
        </div>
      </div>

      {/* Quick Launch Action Toolbar */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          onClick={onOpenLiveLens}
          className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1.5 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-white">Live Lens</span>
        </button>

        <button
          onClick={onOpenPassport}
          className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1.5 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-white">Passport</span>
        </button>

        <button
          onClick={onOpenSecretPass}
          className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1.5 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-white">Secret Pass</span>
        </button>

        <button
          onClick={onOpenMoodRadar}
          className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1.5 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>cyclone</span>
          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-white">Mood Radar</span>
        </button>
      </div>

      {/* Search Input Bar with Form Submit */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="bg-[#1a1a1e] rounded-2xl border border-[#26262b] flex items-center px-4 shadow-sm focus-within:border-orange-500">
            <span className="material-symbols-outlined text-zinc-400 text-[20px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (isDeepSearch) setDeepSearchResults(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isDeepSearch) handleDeepSearch();
                  else handleSearchSubmit();
                }
              }}
              placeholder={isDeepSearch ? "Ask Gemini (e.g. 'coastal spots with old arches')" : "Search by name or district..."}
              className="w-full bg-transparent text-white placeholder:text-zinc-500 text-xs px-3 py-3.5 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDeepSearchResults(null);
                }}
                className="w-6 h-6 rounded-full bg-[#26262b] flex items-center justify-center text-zinc-400 hover:text-white mr-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
            
            {isDeepSearch ? (
              <button
                type="button"
                onClick={handleDeepSearch}
                disabled={isDeepSearching}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeepSearching ? (
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    <span>Deep Search</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
              >
                Search
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => {
              setIsDeepSearch(!isDeepSearch);
              setDeepSearchResults(null);
              triggerHaptic('light');
              onShowToast(isDeepSearch ? 'Basic search active' : 'Gemini Deep Search active', 'psychology');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
              isDeepSearch 
                ? 'bg-teal-600/10 text-teal-400 border-teal-500/30' 
                : 'bg-zinc-800/40 text-zinc-500 border-zinc-700 hover:text-zinc-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isDeepSearch ? "'FILL' 1" : "'FILL' 0" }}>
              auto_awesome
            </span>
            <span>Gemini Deep Search {isDeepSearch ? 'ON' : 'OFF'}</span>
          </button>

          {isDeepSearch && deepSearchResults && (
            <span className="text-[10px] font-mono text-teal-400 animate-pulse">
              {deepSearchResults.length} SEMANTIC MATCHES FOUND
            </span>
          )}
        </div>
      </div>

      {/* SEARCH HISTORY COMPONENT */}
      <SearchHistoryView
        onSelectSearch={handleSelectHistorySearch}
        currentSearchQuery={searchQuery}
        onShowToast={onShowToast}
      />

      {/* Category Filter Chips */}
      <div className="overflow-x-auto no-scrollbar flex items-center gap-2 py-1">
        {[
          { key: 'all', label: 'All Curated', icon: 'stars' },
          { key: 'heritage', label: 'Heritage', icon: 'account_balance' },
          { key: 'food', label: 'Food Lore', icon: 'local_cafe' },
          { key: 'architecture', label: 'Architecture', icon: 'domain' },
          { key: 'secret', label: 'Hidden Lore', icon: 'key' },
        ].map((cat) => {
          const isSelected = activeCat === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCat(cat.key);
                triggerHaptic('medium');
                if (cat.key !== 'all') {
                  saveUserSearch(user?.uid, `${cat.label} Topics`, 'topic');
                }
                onShowToast(`Filtered by: ${cat.label}`, cat.icon);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 cursor-pointer ${
                isSelected
                  ? 'bg-orange-600 text-white border border-orange-500 shadow-md'
                  : 'bg-[#1a1a1e] text-[#9898a0] border border-[#26262b] hover:text-white hover:border-[#32323a]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Neighbourhood Zones Filter Pills */}
      <div className="overflow-x-auto no-scrollbar flex items-center gap-2 py-1">
        <button
          onClick={() => setSelectedZone(null)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
            selectedZone === null
              ? 'bg-orange-600 text-white font-bold shadow'
              : 'bg-[#1a1a1e] text-[#9898a0] border border-[#26262b] hover:text-white'
          }`}
        >
          All Districts
        </button>
        {mockNeighbourhoods.map((zone) => (
          <button
            key={zone.name}
            onClick={() => {
              const next = selectedZone === zone.name ? null : zone.name;
              setSelectedZone(next);
              triggerHaptic('light');
              if (next) {
                saveUserSearch(user?.uid, next, 'location');
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              selectedZone === zone.name
                ? 'bg-orange-600 text-white font-bold shadow'
                : 'bg-[#1a1a1e] text-[#9898a0] border border-[#26262b] hover:text-white'
            }`}
          >
            {zone.name}
          </button>
        ))}
      </div>

      {/* Discovery Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredDiscoveries.map((disc) => (
          <div
            key={disc.id}
            onClick={() => onOpenDossier(disc)}
            className="bg-[#1a1a1e] rounded-2xl border border-[#26262b] hover:border-orange-500/40 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between group shadow-sm"
          >
            <div className="relative h-48 w-full overflow-hidden border-b border-[#26262b]">
              {!imgErrors[disc.id] ? (
                <img
                  src={disc.imageUrl}
                  alt={disc.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgErrors(prev => ({ ...prev, [disc.id]: true }))}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-950/20 to-zinc-900 flex flex-col items-center justify-center p-6 text-center">
                  <span className="material-symbols-outlined text-orange-400 text-3xl mb-1">image_not_supported</span>
                  <span className="text-xs text-zinc-400 font-semibold">{disc.title}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1e] via-transparent to-transparent"></div>

              {/* Minimal Unboxed Overlay Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-xs font-bold shadow-sm text-white">
                <span className="text-orange-400">{disc.zone}</span>
                {disc.secretPerkId && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <span className="text-amber-400 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[14px]">stars</span>
                      <span>Secret Perk</span>
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={(e) => toggleBookmark(disc.title, e)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:text-orange-400 border border-white/10 transition-colors cursor-pointer"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: bookmarks[disc.title] ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {bookmarks[disc.title] ? 'bookmark' : 'bookmark_border'}
                </span>
              </button>
            </div>

            <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-headline text-lg text-white font-bold group-hover:text-orange-400 transition-colors leading-tight">
                    {disc.title}
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                    +{disc.xp} XP
                  </span>
                </div>

                <p className="text-xs text-[#9898a0] line-clamp-2 leading-relaxed">
                  {disc.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#26262b] text-xs text-[#9898a0] mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-orange-400">near_me</span>
                  <span>{disc.distance}</span>
                  <span className="text-zinc-700">·</span>
                  <span>{disc.duration}</span>
                </div>
                <span className="text-orange-400 font-semibold">{disc.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Community Lore & Hidden Echoes Section */}
      <section className="pt-4 space-y-3">
        <div className="flex justify-between items-end border-b border-[#26262b] pb-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="material-symbols-outlined text-[18px] text-orange-400"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                campaign
              </span>
              <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-widest">
                Local Lore Feed
              </span>
            </div>
            <h2 className="font-headline text-2xl text-white font-bold">Community Echoes</h2>
          </div>

          <button
            onClick={() => setContributeOpen(!contributeOpen)}
            className="px-3.5 py-1.5 rounded-xl bg-orange-600/10 border border-orange-500/30 text-orange-400 text-xs font-bold hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_comment</span>
            <span>{contributeOpen ? 'Close Form' : 'Contribute Echo'}</span>
          </button>
        </div>

        {contributeOpen && (
          <form
            onSubmit={handleContributeEcho}
            className="p-5 rounded-2xl bg-[#1a1a1e] border border-orange-500/40 space-y-3 shadow-md"
          >
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Add Field Observation or Secret Lore
            </h3>
            <div>
              <input
                type="text"
                placeholder="Spot name (e.g. Triplicane 1888 Alleyway)"
                value={newEchoSpot}
                onChange={(e) => setNewEchoSpot(e.target.value)}
                className="w-full bg-[#121214] text-white p-3 rounded-xl border border-[#26262b] text-xs focus:outline-none focus:border-orange-500 placeholder:text-zinc-500"
              />
            </div>
            <div>
              <textarea
                placeholder="What unmapped detail or oral history did you discover?"
                value={newEchoSnippet}
                onChange={(e) => setNewEchoSnippet(e.target.value)}
                rows={2}
                className="w-full bg-[#121214] text-white p-3 rounded-xl border border-[#26262b] text-xs focus:outline-none focus:border-orange-500 resize-none placeholder:text-zinc-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-orange-600 text-white font-bold text-xs shadow hover:bg-orange-500 active:scale-95 transition-all cursor-pointer"
            >
              Publish to Chennai Lore Feed (+50 XP)
            </button>
          </form>
        )}

        <div className="space-y-3">
          {echoes.map((echo) => (
            <div
              key={echo.id}
              className="p-4 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/30 transition-all space-y-2 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-headline text-base font-bold text-white">{echo.spot}</h4>
                  <span className="text-[11px] text-[#9898a0] block mt-0.5">
                    {echo.author} • {echo.handle} • {echo.timestamp}
                  </span>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setEchoes((prev) =>
                      prev.map((e) => (e.id === echo.id ? { ...e, likes: e.likes + 1 } : e))
                    );
                    onShowToast('Echo upvoted! ☕', 'thumb_up');
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-xl border border-orange-500/20 hover:bg-orange-500/20 active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">local_cafe</span>
                  <span>{echo.likes}</span>
                </button>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">"{echo.snippet}"</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
