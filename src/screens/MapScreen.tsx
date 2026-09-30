import React, { useState, useEffect, useMemo } from 'react';
import { Discovery, SavedLocationPin } from '../types';
import { UnifiedMapSpot } from '../data/allUnifiedSpots';
import { triggerHaptic } from '../lib/haptic';
import { GoogleMapView } from '../components/GoogleMapView';
import { getZoneCenter, calculateDistanceKm } from '../services/mapsService';
import { WeatherOverlay } from '../components/WeatherOverlay';
import { Compass } from '../components/Compass';

interface MapScreenProps {
  onOpenDossier: (disc: Discovery) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onOpenLiveLens?: () => void;
  onOpenPassport?: () => void;
  onOpenSecretPass?: () => void;
  onOpenMysteryDrop?: () => void;
  initialNavSpot?: UnifiedMapSpot | null;
  onClearInitialNavSpot?: () => void;
  savedPins: SavedLocationPin[];
  onUpdatePins: (pins: SavedLocationPin[]) => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  onOpenDossier,
  onShowToast,
  onOpenLiveLens,
  onOpenPassport,
  onOpenSecretPass,
  onOpenMysteryDrop,
  initialNavSpot,
  onClearInitialNavSpot,
  savedPins,
  onUpdatePins,
}) => {
  const [selectedZone, setSelectedZone] = useState('All Chennai');
  const [gpsSimulating, setGpsSimulating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState('±2.8m');

  const [pinSearchQuery, setPinSearchQuery] = useState('');
  const [showSavedPins, setShowSavedPins] = useState(true);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);

  const filteredSavedPins = useMemo(() => {
    if (!pinSearchQuery.trim()) return savedPins;
    const q = pinSearchQuery.toLowerCase().trim();
    return savedPins.filter(
      (pin) => pin.note.toLowerCase().includes(q)
    );
  }, [savedPins, pinSearchQuery]);

  const handleSaveCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      onShowToast('Geolocation not supported', 'error');
      return;
    }

    triggerHaptic('medium');
    setGpsSimulating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsSimulating(false);
        const note = window.prompt('Add a note for this location:', 'My Discovery');
        if (note === null) return; // User cancelled

        const newPin: SavedLocationPin = {
          id: `pin-${Date.now()}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          note: note.trim() || 'Custom Pin',
          timestamp: new Date().toISOString(),
        };

        onUpdatePins([newPin, ...savedPins]);
        onShowToast('Location saved to your personal map! 📍', 'push_pin');
        triggerHaptic([50, 80, 100]);
      },
      (err) => {
        setGpsSimulating(false);
        onShowToast('Unable to lock GPS for saving location.', 'error');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleDeletePin = (id: string) => {
    triggerHaptic('light');
    onUpdatePins(savedPins.filter((p) => p.id !== id));
    onShowToast('Pin removed from map', 'delete');
  };

  const handleSimulateGpsPulse = () => {
    setGpsSimulating(true);
    triggerHaptic([40, 60, 80]);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsAccuracy(`±${pos.coords.accuracy.toFixed(1)}m`);
          setGpsSimulating(false);
          const zoneCenter = getZoneCenter(selectedZone);
          const distKm = calculateDistanceKm(
            pos.coords.latitude,
            pos.coords.longitude,
            zoneCenter.lat,
            zoneCenter.lng
          );
          onShowToast(
            `GPS Locked: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E (${distKm} km to ${selectedZone})`,
            'gps_fixed'
          );
        },
        () => {
          setGpsAccuracy('±2.4m (Simulated)');
          setGpsSimulating(false);
          onShowToast('GPS locked to Chennai Heritage Corridor', 'gps_fixed');
        },
        { timeout: 3000 }
      );
    } else {
      setTimeout(() => {
        setGpsAccuracy('±2.4m (Simulated)');
        setGpsSimulating(false);
        onShowToast('GPS locked to Chennai Heritage Corridor', 'gps_fixed');
      }, 800);
    }
  };

  return (
    <div className="flex flex-col w-full pb-24 max-w-4xl mx-auto px-4 space-y-4 bg-[#121214] text-zinc-100 relative">
      {/* REAL-TIME COMPASS OVERLAY */}
      <Compass />

      {/* Title Header */}
      <div className="pt-4 pb-1 border-b border-[#26262b]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="material-symbols-outlined text-[18px] text-orange-400"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            radar
          </span>
          <span className="text-[10px] text-orange-400 uppercase tracking-widest font-mono font-bold">
            Expedition Radar & Live GPS
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-headline text-2xl sm:text-3xl text-white font-extrabold tracking-tight">
            Chennai Map Radar
          </h1>
          <button
            onClick={handleSimulateGpsPulse}
            className="text-xs font-mono font-bold text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <span
              className={`w-2 h-2 rounded-full bg-emerald-400 ${gpsSimulating ? 'animate-ping' : ''}`}
            ></span>
            <span>GPS {gpsAccuracy}</span>
          </button>
        </div>
      </div>

      {/* Quick Launch Action Toolbar on Map */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <button
          onClick={onOpenLiveLens}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Live Lens</span>
        </button>

        <button
          onClick={onOpenPassport}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Passport</span>
        </button>

        <button
          onClick={handleSaveCurrentLocation}
          className="p-2.5 rounded-2xl bg-orange-600/10 border border-orange-500/30 text-center hover:bg-orange-600 hover:border-orange-500 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 group-hover:text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
          <span className="text-[9px] font-bold text-orange-400 group-hover:text-white whitespace-nowrap">Save Pin</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            const next = !showWeatherOverlay;
            setShowWeatherOverlay(next);
            onShowToast(next ? 'Atmospheric Weather HUD Enabled 🌤️' : 'Weather HUD minimized', 'thermostat');
          }}
          className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group ${
            showWeatherOverlay
              ? 'bg-teal-600/20 border-teal-500 text-teal-300'
              : 'bg-[#1a1a1e] border-[#26262b] hover:border-teal-500/40 text-zinc-300'
          }`}
        >
          <span className="material-symbols-outlined text-teal-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>thermostat</span>
          <span className="text-[9px] font-bold group-hover:text-white">Weather HUD</span>
        </button>

        <button
          onClick={onOpenSecretPass}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Pass</span>
        </button>

        <button
          onClick={onOpenMysteryDrop}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span className="material-symbols-outlined text-orange-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Drop</span>
        </button>
      </div>

      {/* Atmospheric Weather HUD Overlay Modal / Card */}
      {showWeatherOverlay && (
        <div className="flex justify-center pb-2">
          <WeatherOverlay
            landmarkName={selectedZone === 'All Chennai' ? 'Kapaleeshwarar Temple' : selectedZone}
            zone={selectedZone}
            onShowToast={onShowToast}
            onClose={() => setShowWeatherOverlay(false)}
          />
        </div>
      )}

      {/* Saved Pins Filter Toggle & Search Bar */}
      {savedPins.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                triggerHaptic('light');
                const nextState = !showSavedPins;
                setShowSavedPins(nextState);
                onShowToast(
                  nextState ? `Showing ${savedPins.length} saved pins on map` : 'Saved pins hidden (public discoveries only)',
                  nextState ? 'visibility' : 'visibility_off'
                );
              }}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                showSavedPins
                  ? 'bg-orange-600/20 text-orange-400 border-orange-500/40 shadow-sm'
                  : 'bg-[#1a1a1e] text-zinc-400 border-[#26262b] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {showSavedPins ? 'push_pin' : 'location_off'}
              </span>
              <span>{showSavedPins ? `Saved Pins Visible (${savedPins.length})` : `Saved Pins Hidden`}</span>
            </button>

            <span className="text-[10px] text-zinc-500 font-mono">
              {showSavedPins ? 'Showing public & saved markers' : 'Public discoveries only'}
            </span>
          </div>

          <div className="bg-[#1a1a1e] rounded-xl border border-[#26262b] flex items-center px-3.5 shadow-sm focus-within:border-violet-500 transition-all">
            <span className="material-symbols-outlined text-violet-400 text-[18px]">search</span>
            <input
              type="text"
              value={pinSearchQuery}
              onChange={(e) => setPinSearchQuery(e.target.value)}
              placeholder="Search your saved pins & notes..."
              className="w-full bg-transparent text-white placeholder:text-[#71717a] text-[11px] px-2.5 py-2 focus:outline-none"
            />
            {pinSearchQuery && (
              <button
                onClick={() => setPinSearchQuery('')}
                className="w-5 h-5 rounded-full bg-[#26262b] flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* REAL GOOGLE MAPS INTEGRATION WITH MARKER CLUSTERING & DIRECTIONS */}
      <GoogleMapView
        onOpenDossier={onOpenDossier}
        onShowToast={onShowToast}
        selectedZone={selectedZone}
        onZoneChange={(z) => setSelectedZone(z)}
        initialNavSpot={initialNavSpot}
        onClearInitialNavSpot={onClearInitialNavSpot}
        customPins={showSavedPins ? filteredSavedPins : []}
        onDeleteCustomPin={handleDeletePin}
      />
    </div>
  );
};

