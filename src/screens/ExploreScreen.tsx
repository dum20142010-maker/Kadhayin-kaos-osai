import React, { useState, useMemo } from 'react';
import { Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { KAOS_SPOTS } from '../data/kaosData';
import { MasterSpot } from '../types';
import { DailyQuests } from '../components/DailyQuests';
import { ArCompassWidget } from '../components/ArCompassWidget';
import { GeoProximityNotifier } from '../components/GeoProximityNotifier';

interface ExploreScreenProps {
  onSpotSelected: (spot: MasterSpot) => void;
  onAwardXp: (amount: number, reason: string) => void;
  onShowToast: (msg: string) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  onSpotSelected,
  onAwardXp,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'archive'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [visibleLimit, setVisibleLimit] = useState(16);

  // Controlled map state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 13.0642,
    lng: 80.2811,
  });
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [infoWindowSpot, setInfoWindowSpot] = useState<MasterSpot | null>(null);

  const categories = [
    'All', 'Heritage', 'Architecture', 'Food Lore', 'Attractions', 
    'Cafes', 'Restaurants', 'Hidden Gems', 'Shopping', 
    'Entertainment', 'Activities', 'Parks', 'Family Friendly'
  ];

  // Perform instant indexing of Chennai's 1,000+ places
  const filteredSpots = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cat = selectedCategory.toLowerCase();

    return KAOS_SPOTS.filter((spot) => {
      const matchesCat =
        selectedCategory === 'All' ||
        spot.category.toLowerCase().includes(cat) ||
        (spot.categoryKey && spot.categoryKey.toLowerCase().includes(cat));

      const matchesQuery =
        !q ||
        spot.title.toLowerCase().includes(q) ||
        spot.zone.toLowerCase().includes(q) ||
        spot.description.toLowerCase().includes(q) ||
        (spot.architecturalStyle && spot.architecturalStyle.toLowerCase().includes(q));

      return matchesCat && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  const paginatedSpots = useMemo(() => {
    return filteredSpots.slice(0, visibleLimit);
  }, [filteredSpots, visibleLimit]);

  const mapMarkers = useMemo(() => {
    return filteredSpots.slice(0, 100);
  }, [filteredSpots]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setVisibleLimit(16);
    setInfoWindowSpot(null);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setVisibleLimit(16);
    setInfoWindowSpot(null);
  };

  return (
    <div className="space-y-6 pb-24 p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* Sub-Tabs Selector Header */}
      <div className="flex items-center justify-between border-b border-[#26242C] pb-4 gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-[#1C1A1F] border border-[#26242C] rounded-2xl shrink-0">
          <button
            onClick={() => setActiveSubTab('discover')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'discover'
                ? 'bg-[#F05423] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">explore</span>
            <span>Discover</span>
          </button>

          <button
            onClick={() => setActiveSubTab('archive')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'archive'
                ? 'bg-[#F05423] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">travel_explore</span>
            <span>Places Archive</span>
          </button>
        </div>

        {activeSubTab === 'archive' && (
          <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-[#F05423]/10 border border-[#F05423]/30 text-[#F05423] font-bold">
            1,000+ Landmarked Beacons
          </span>
        )}
      </div>

      {/* RENDER ACTIVE SUBTAB CONTENT */}
      {activeSubTab === 'discover' ? (
        /* DISCOVER SUBTAB */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Hero Discovery Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main Explorer Telemetry Card */}
            <div className="lg:col-span-12 bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[180px]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider">
                  <span className="text-[#F05423]">Chennai Sector</span>
                  <span aria-hidden="true">·</span>
                  <span>Acoustic Geofence Active</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">
                  Every street corner holds a century of whispers.
                </h2>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                  Explore hidden Indo-Saracenic vaulted corridors, century-old wood-fired coffee roasteries, and sacred temple tanks aligned with ancient cosmology.
                </p>
              </div>
            </div>

            {/* Daily Quests Segment */}
            <div className="lg:col-span-12">
              <DailyQuests
                onAwardXp={onAwardXp}
                onSpotSelected={onSpotSelected}
                onShowToast={onShowToast}
              />
            </div>

            {/* AR Heritage Compass Radar Widget */}
            <div className="lg:col-span-12">
              <ArCompassWidget
                onSpotSelected={onSpotSelected}
                onShowToast={onShowToast}
              />
            </div>

            {/* Geolocation Proximity Notifier & Background Radar */}
            <div className="lg:col-span-12">
              <GeoProximityNotifier
                onSpotSelected={onSpotSelected}
                onShowToast={onShowToast}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ARCHIVE SUBTAB */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Toggle and Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#26242C] pb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Landmark Archives Index</h3>
              <p className="text-[11px] text-zinc-400">Search Chennai coffee ledgers, architectural blueprints, and temples</p>
            </div>

            {/* List/Map Mode Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-[#1C1A1F] border border-[#26242C] rounded-xl self-start md:self-auto shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                  viewMode === 'list'
                    ? 'bg-[#F05423] text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_list</span>
                <span>List View</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                  viewMode === 'map'
                    ? 'bg-[#F05423] text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">map</span>
                <span>Map View</span>
              </button>
            </div>
          </div>

          {/* Search Input and Categories */}
          <div className="space-y-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-zinc-500 text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Search 1,000+ places by name, neighborhood, or keywords..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-[#1C1A1F] border border-[#26242C] rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423] transition-colors"
              />
            </div>

            {/* Categories pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#F05423] text-white font-bold'
                      : 'bg-[#1C1A1F] border border-[#26242C] text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid / Map */}
          {viewMode === 'list' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {paginatedSpots.map((spot) => (
                  <div
                    key={spot.id}
                    onClick={() => onSpotSelected(spot)}
                    className="bg-[#1C1A1F] border border-[#26242C] hover:border-zinc-700 rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-36 w-full bg-[#121114]">
                        <img
                          src={spot.imageUrl}
                          alt={spot.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2 left-2 bg-black/70 text-[#F05423] font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#F05423]/30">
                          {spot.zone}
                        </span>
                      </div>
                      <div className="p-3 space-y-1">
                        <h4 className="font-bold text-xs text-white group-hover:text-[#F05423] transition-colors line-clamp-1">
                          {spot.title}
                        </h4>
                        <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {spot.description}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 pt-0 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{spot.category}</span>
                      <span className="text-amber-400 font-bold">+{spot.xp} XP</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {visibleLimit < filteredSpots.length && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setVisibleLimit((prev) => prev + 16)}
                    className="px-6 py-2.5 rounded-xl bg-[#1C1A1F] border border-[#26242C] hover:border-zinc-600 text-white font-bold text-xs cursor-pointer transition-all"
                  >
                    Load More Places ({filteredSpots.length - visibleLimit} Remaining)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[500px] rounded-2xl overflow-hidden border border-[#26242C]">
              <Map
                center={mapCenter}
                zoom={mapZoom}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                className="w-full h-full"
              >
                {mapMarkers.map((spot) => (
                  <AdvancedMarker
                    key={spot.id}
                    position={{ lat: spot.lat || 13.0642, lng: spot.lng || 80.2811 }}
                    onClick={() => setInfoWindowSpot(spot)}
                  >
                    <Pin background="#F05423" borderColor="#ffffff" glyphColor="#ffffff" />
                  </AdvancedMarker>
                ))}

                {infoWindowSpot && (
                  <InfoWindow
                    position={{ lat: infoWindowSpot.lat || 13.0642, lng: infoWindowSpot.lng || 80.2811 }}
                    onCloseClick={() => setInfoWindowSpot(null)}
                  >
                    <div className="p-2 text-zinc-900 max-w-xs space-y-1 font-sans">
                      <span className="text-[10px] font-mono uppercase font-bold text-[#F05423]">
                        {infoWindowSpot.zone}
                      </span>
                      <h4 className="font-bold text-xs">{infoWindowSpot.title}</h4>
                      <p className="text-[11px] text-zinc-600 line-clamp-2">{infoWindowSpot.description}</p>
                      <button
                        onClick={() => onSpotSelected(infoWindowSpot)}
                        className="mt-1 w-full py-1 bg-[#F05423] text-white text-[10px] font-bold rounded cursor-pointer"
                      >
                        View Place Details
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
