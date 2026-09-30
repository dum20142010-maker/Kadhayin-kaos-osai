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
  activeMoodCategory?: string;
}

export const FOLDER_ACCENT_PALETTE = [
  { color: '#f59e0b', name: 'Amber Gold' },
  { color: '#ea580c', name: 'Heritage Orange' },
  { color: '#eab308', name: 'Saffron Yellow' },
  { color: '#10b981', name: 'Emerald Green' },
  { color: '#14b8a6', name: 'Coastal Teal' },
  { color: '#06b6d4', name: 'Cyan Neon' },
  { color: '#3b82f6', name: 'Electric Blue' },
  { color: '#6366f1', name: 'Indigo Aura' },
  { color: '#a855f7', name: 'Cyber Purple' },
  { color: '#d946ef', name: 'Fuchsia Laser' },
  { color: '#f43f5e', name: 'Rose Red' },
  { color: '#ec4899', name: 'Hot Pink' },
];

export const DEFAULT_COLLECTIONS = [
  'Food Gems',
  'Heritage Sites',
  'Cafes & Coffee',
  'Late Night & Secret',
  'General',
];

export const DEFAULT_FOLDER_ACCENT_COLORS: Record<string, string> = {
  'Food Gems': '#f59e0b',
  'Heritage Sites': '#ea580c',
  'Cafes & Coffee': '#eab308',
  'Late Night & Secret': '#a855f7',
  'General': '#06b6d4',
};

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
  activeMoodCategory,
}) => {
  const [selectedZone, setSelectedZone] = useState('All Chennai');
  const [gpsSimulating, setGpsSimulating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState('±2.8m');

  const [pinSearchQuery, setPinSearchQuery] = useState('');
  const [showSavedPins, setShowSavedPins] = useState(true);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);

  // Folder Collections State
  const [collections, setCollections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kaos_pin_custom_collections');
      return saved ? JSON.parse(saved) : DEFAULT_COLLECTIONS;
    } catch {
      return DEFAULT_COLLECTIONS;
    }
  });

  // Folder Accent Colors State
  const [folderColors, setFolderColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('kaos_folder_accent_colors');
      return saved ? { ...DEFAULT_FOLDER_ACCENT_COLORS, ...JSON.parse(saved) } : DEFAULT_FOLDER_ACCENT_COLORS;
    } catch {
      return DEFAULT_FOLDER_ACCENT_COLORS;
    }
  });

  const [activeFolder, setActiveFolder] = useState<string>('All Pins');
  const [isFolderListOpen, setIsFolderListOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderAccentColor, setNewFolderAccentColor] = useState<string>('#10b981');

  // Palette Popover / Color Editor State
  const [editingFolderColorName, setEditingFolderColorName] = useState<string | null>(null);

  // Save Pin Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [newPinNote, setNewPinNote] = useState('');
  const [newPinCollection, setNewPinCollection] = useState('Food Gems');
  const [newPinColor, setNewPinColor] = useState('#f59e0b');

  // Pin Editing State
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Helper to get accent color for any folder
  const getFolderAccentColor = (name: string): string => {
    if (folderColors[name]) return folderColors[name];
    if (DEFAULT_FOLDER_ACCENT_COLORS[name]) return DEFAULT_FOLDER_ACCENT_COLORS[name];
    return '#14b8a6';
  };

  // Save collections to localStorage
  const saveCollections = (updated: string[]) => {
    setCollections(updated);
    try {
      localStorage.setItem('kaos_pin_custom_collections', JSON.stringify(updated));
    } catch {}
  };

  // Update folder accent color
  const handleUpdateFolderAccentColor = (folderName: string, color: string) => {
    triggerHaptic('light');
    const updated = { ...folderColors, [folderName]: color };
    setFolderColors(updated);
    try {
      localStorage.setItem('kaos_folder_accent_colors', JSON.stringify(updated));
    } catch {}

    // Update pins in that folder so markers on map and UI stay in sync
    const updatedPins = savedPins.map((p) =>
      (p.collectionName || 'General') === folderName ? { ...p, colorTag: color } : p
    );
    onUpdatePins(updatedPins);

    setEditingFolderColorName(null);
    onShowToast(`Accent color for "${folderName}" set to ${color} ✨`, 'palette');
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (collections.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      onShowToast(`Collection "${trimmed}" already exists.`, 'warning');
      return;
    }

    const nextCollections = [...collections, trimmed];
    saveCollections(nextCollections);

    const nextColors = { ...folderColors, [trimmed]: newFolderAccentColor };
    setFolderColors(nextColors);
    try {
      localStorage.setItem('kaos_folder_accent_colors', JSON.stringify(nextColors));
    } catch {}

    setActiveFolder(trimmed);
    setNewFolderName('');
    setIsCreatingFolder(false);
    triggerHaptic('medium');
    onShowToast(`Created folder "${trimmed}" with custom accent color! 📁`, 'create_new_folder');
  };

  const handleDeleteFolder = (folderToDelete: string) => {
    if (DEFAULT_COLLECTIONS.includes(folderToDelete)) {
      onShowToast('Default system collections cannot be deleted.', 'info');
      return;
    }

    triggerHaptic('light');
    const next = collections.filter((c) => c !== folderToDelete);
    saveCollections(next);

    // Reassign pins in that folder to 'General'
    const genColor = getFolderAccentColor('General');
    const updatedPins = savedPins.map((p) =>
      p.collectionName === folderToDelete ? { ...p, collectionName: 'General', colorTag: genColor } : p
    );
    onUpdatePins(updatedPins);

    if (activeFolder === folderToDelete) {
      setActiveFolder('All Pins');
    }
    onShowToast(`Deleted collection "${folderToDelete}". Pins moved to General.`, 'delete');
  };

  // Helper for folder icons
  const getFolderIcon = (name: string) => {
    switch (name) {
      case 'Food Gems':
        return 'restaurant';
      case 'Heritage Sites':
        return 'fort';
      case 'Cafes & Coffee':
        return 'local_cafe';
      case 'Late Night & Secret':
        return 'stars';
      case 'General':
        return 'push_pin';
      default:
        return 'folder';
    }
  };

  // Calculate pin counts per folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Pins': savedPins.length };
    collections.forEach((col) => {
      counts[col] = savedPins.filter((p) => (p.collectionName || 'General') === col).length;
    });
    return counts;
  }, [savedPins, collections]);

  // Filter saved pins by active folder AND search query
  const filteredSavedPins = useMemo(() => {
    let list = savedPins;

    // Filter by Folder Collection
    if (activeFolder !== 'All Pins') {
      list = list.filter((pin) => (pin.collectionName || 'General') === activeFolder);
    }

    // Filter by search query
    if (pinSearchQuery.trim()) {
      const q = pinSearchQuery.toLowerCase().trim();
      list = list.filter(
        (pin) =>
          pin.note.toLowerCase().includes(q) ||
          (pin.collectionName && pin.collectionName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [savedPins, activeFolder, pinSearchQuery]);

  // Handle Save Current Location Flow
  const handleInitiateSavePin = () => {
    if (!('geolocation' in navigator)) {
      onShowToast('Geolocation is not supported in this browser.', 'error');
      return;
    }

    triggerHaptic('medium');
    setGpsSimulating(true);

    const defaultCol = activeFolder !== 'All Pins' ? activeFolder : 'Food Gems';
    const defaultColor = getFolderAccentColor(defaultCol);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsSimulating(false);
        setPendingLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setNewPinNote('');
        setNewPinCollection(defaultCol);
        setNewPinColor(defaultColor);
        setIsSaveModalOpen(true);
      },
      () => {
        setGpsSimulating(false);
        // Fallback to zone center or default
        const zoneCenter = getZoneCenter(selectedZone);
        setPendingLocation({
          lat: zoneCenter.lat,
          lng: zoneCenter.lng,
        });
        setNewPinNote('');
        setNewPinCollection(defaultCol);
        setNewPinColor(defaultColor);
        setIsSaveModalOpen(true);
        onShowToast('Using approximate zone coordinates for pin.', 'info');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleConfirmSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLocation) return;

    const note = newPinNote.trim() || 'Saved Location Discovery';
    const chosenColor = newPinColor || getFolderAccentColor(newPinCollection);
    const newPin: SavedLocationPin = {
      id: `pin-${Date.now()}`,
      lat: pendingLocation.lat,
      lng: pendingLocation.lng,
      note,
      timestamp: new Date().toISOString(),
      collectionName: newPinCollection,
      colorTag: chosenColor,
    };

    onUpdatePins([newPin, ...savedPins]);
    setIsSaveModalOpen(false);
    setPendingLocation(null);
    onShowToast(`Saved pin to "${newPinCollection}" with accent color! 📍`, 'push_pin');
    triggerHaptic([50, 80, 120]);
  };

  // Move Pin to different folder
  const handleMovePinToFolder = (pinId: string, targetFolder: string) => {
    triggerHaptic('light');
    const folderColor = getFolderAccentColor(targetFolder);
    const updated = savedPins.map((p) =>
      p.id === pinId ? { ...p, collectionName: targetFolder, colorTag: folderColor } : p
    );
    onUpdatePins(updated);
    onShowToast(`Moved pin to "${targetFolder}" folder 📁`, 'folder_shared');
  };

  // Save edited note for a pin
  const handleSaveEditedPinNote = (pinId: string) => {
    const trimmed = editingNoteText.trim();
    if (!trimmed) return;
    const updated = savedPins.map((p) =>
      p.id === pinId ? { ...p, note: trimmed } : p
    );
    onUpdatePins(updated);
    setEditingPinId(null);
    setEditingNoteText('');
    triggerHaptic('light');
    onShowToast('Pin updated successfully! ✏️', 'check');
  };

  const handleDeletePin = (id: string) => {
    triggerHaptic('light');
    onUpdatePins(savedPins.filter((p) => p.id !== id));
    onShowToast('Pin removed from collection', 'delete');
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
            />
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
          <span
            className="material-symbols-outlined text-orange-400 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            photo_camera
          </span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Live Lens</span>
        </button>

        <button
          onClick={onOpenPassport}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span
            className="material-symbols-outlined text-orange-400 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            menu_book
          </span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Passport</span>
        </button>

        {/* Save Pin with Collections Folder Support */}
        <button
          onClick={handleInitiateSavePin}
          className="p-2.5 rounded-2xl bg-orange-600/15 border border-orange-500/40 text-center hover:bg-orange-600 hover:border-orange-500 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md cursor-pointer group"
        >
          <span
            className="material-symbols-outlined text-orange-400 group-hover:text-white text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add_location_alt
          </span>
          <span className="text-[9px] font-bold text-orange-400 group-hover:text-white whitespace-nowrap">
            + Save Pin
          </span>
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
          <span
            className="material-symbols-outlined text-teal-400 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            thermostat
          </span>
          <span className="text-[9px] font-bold group-hover:text-white">Weather HUD</span>
        </button>

        <button
          onClick={onOpenSecretPass}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span
            className="material-symbols-outlined text-orange-400 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            stars
          </span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Pass</span>
        </button>

        <button
          onClick={onOpenMysteryDrop}
          className="p-2.5 rounded-2xl bg-[#1a1a1e] border border-[#26262b] text-center hover:border-orange-500/40 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm cursor-pointer group"
        >
          <span
            className="material-symbols-outlined text-orange-400 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            local_fire_department
          </span>
          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-white">Drop</span>
        </button>
      </div>

      {/* Atmospheric Weather HUD Overlay Modal / Card */}
      {showWeatherOverlay && (
        <div className="flex justify-center pb-2">
          <WeatherOverlay
            landmarkName={selectedZone === 'All Chennai' ? 'Kapaleeshwarar Temple' : selectedZone}
            zone={selectedZone}
            activeMoodCategory={activeMoodCategory}
            onShowToast={onShowToast}
            onClose={() => setShowWeatherOverlay(false)}
          />
        </div>
      )}

      {/* SAVED PINS & FOLDER-BASED COLLECTIONS SECTION */}
      <div className="bg-[#18181c] p-3.5 rounded-2xl border border-[#26262b] space-y-3">
        {/* Header & Visibility Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#26262b] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-400 text-[20px]">folder_special</span>
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Saved Pins & Custom Collections
              </h3>
              <span className="text-[10px] text-zinc-400 font-mono">
                Organize personal discoveries with custom accent-colored folders ({savedPins.length} total)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                const nextState = !showSavedPins;
                setShowSavedPins(nextState);
                onShowToast(
                  nextState ? `Saved pins active on map` : 'Saved pins hidden from map',
                  nextState ? 'visibility' : 'visibility_off'
                );
              }}
              className={`text-[10px] font-bold font-mono px-2.5 py-1 rounded-xl border flex items-center gap-1 transition-all cursor-pointer ${
                showSavedPins
                  ? 'bg-orange-600/20 text-orange-400 border-orange-500/40 shadow-sm'
                  : 'bg-[#121214] text-zinc-400 border-[#26262b]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {showSavedPins ? 'visibility' : 'visibility_off'}
              </span>
              <span>{showSavedPins ? 'Map Overlay: ON' : 'Map Overlay: OFF'}</span>
            </button>

            <button
              onClick={() => setIsFolderListOpen(!isFolderListOpen)}
              className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 flex items-center gap-1 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isFolderListOpen ? 'expand_less' : 'view_list'}
              </span>
              <span>{isFolderListOpen ? 'Collapse' : 'Manage Folders'}</span>
            </button>
          </div>
        </div>

        {/* FOLDER COLLECTIONS RIBBON WITH ACCENT COLOR BADGES */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">
              Active Collection Folder:
            </span>
            <button
              onClick={() => {
                setIsCreatingFolder(true);
                triggerHaptic('light');
              }}
              className="text-[10px] font-mono text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">create_new_folder</span>
              <span>+ New Folder</span>
            </button>
          </div>

          {/* Folder Tabs / Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {/* All Pins Special Folder */}
            <button
              onClick={() => {
                setActiveFolder('All Pins');
                triggerHaptic('light');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                activeFolder === 'All Pins'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-md ring-1 ring-orange-400/40'
                  : 'bg-[#121214] text-zinc-400 border-[#26262b] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">folder_open</span>
              <span>All Pins ({folderCounts['All Pins'] || 0})</span>
            </button>

            {/* Custom & Default Collection Folders */}
            {collections.map((folder) => {
              const isSelected = activeFolder === folder;
              const count = folderCounts[folder] || 0;
              const icon = getFolderIcon(folder);
              const accentColor = getFolderAccentColor(folder);

              return (
                <div key={folder} className="relative group shrink-0 flex items-center">
                  <button
                    onClick={() => {
                      setActiveFolder(folder);
                      triggerHaptic('light');
                    }}
                    style={
                      isSelected
                        ? {
                            borderColor: accentColor,
                            boxShadow: `0 0 12px ${accentColor}35`,
                          }
                        : undefined
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-[#1f1f26] text-white'
                        : 'bg-[#121214] text-zinc-300 border-[#26262b] hover:border-white/20'
                    }`}
                  >
                    {/* Visual Accent Color Indicator Dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{ color: isSelected ? accentColor : undefined }}
                    >
                      {icon}
                    </span>
                    <span>
                      {folder} ({count})
                    </span>
                  </button>

                  {/* Accent Color Palette Quick Trigger Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolderColorName(editingFolderColorName === folder ? null : folder);
                      triggerHaptic('light');
                    }}
                    title="Change folder accent color"
                    className="ml-1 p-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white cursor-pointer opacity-80 group-hover:opacity-100 transition-opacity"
                  >
                    <span
                      className="material-symbols-outlined text-[12px]"
                      style={{ color: accentColor }}
                    >
                      palette
                    </span>
                  </button>

                  {/* Delete button for custom folders */}
                  {!DEFAULT_COLLECTIONS.includes(folder) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      title="Delete folder"
                      className="ml-0.5 p-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete</span>
                    </button>
                  )}

                  {/* Inline Color Palette Picker Dropdown for this folder */}
                  {editingFolderColorName === folder && (
                    <div className="absolute top-full left-0 mt-2 z-50 p-3 rounded-2xl bg-[#1e1e24] border border-orange-500/40 shadow-2xl space-y-2 w-64 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase">
                          Accent Color for "{folder}"
                        </span>
                        <button
                          onClick={() => setEditingFolderColorName(null)}
                          className="text-zinc-400 hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-6 gap-1.5 pt-1">
                        {FOLDER_ACCENT_PALETTE.map((pal) => (
                          <button
                            key={pal.color}
                            type="button"
                            onClick={() => handleUpdateFolderAccentColor(folder, pal.color)}
                            title={pal.name}
                            style={{ backgroundColor: pal.color }}
                            className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                              accentColor === pal.color
                                ? 'ring-2 ring-white scale-110 shadow-lg'
                                : 'opacity-80 hover:opacity-100 hover:scale-105'
                            }`}
                          >
                            {accentColor === pal.color && (
                              <span className="material-symbols-outlined text-[14px] text-white font-bold drop-shadow">
                                check
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inline Create New Folder Input with Accent Color Picker */}
        {isCreatingFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="p-3 rounded-2xl bg-[#121214] border border-orange-500/50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full shrink-0 shadow"
                style={{ backgroundColor: newFolderAccentColor }}
              />
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Architecture Walk, Sunset Spots, Rooftop Bars..."
                className="w-full bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none font-medium"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shrink-0 cursor-pointer shadow-md"
              >
                Create Folder
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="px-2 py-1 text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Choose Initial Accent Color */}
            <div className="space-y-1 pt-1 border-t border-white/5">
              <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">
                Choose Folder Accent Color:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {FOLDER_ACCENT_PALETTE.map((pal) => (
                  <button
                    key={pal.color}
                    type="button"
                    onClick={() => {
                      setNewFolderAccentColor(pal.color);
                      triggerHaptic('light');
                    }}
                    title={pal.name}
                    style={{ backgroundColor: pal.color }}
                    className={`w-5 h-5 rounded-lg transition-transform cursor-pointer ${
                      newFolderAccentColor === pal.color
                        ? 'ring-2 ring-white scale-125 shadow-md'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </form>
        )}

        {/* Search Bar for Pins */}
        <div className="bg-[#121214] rounded-xl border border-[#26262b] flex items-center px-3 shadow-sm focus-within:border-orange-500 transition-all">
          <span className="material-symbols-outlined text-zinc-500 text-[16px]">search</span>
          <input
            type="text"
            value={pinSearchQuery}
            onChange={(e) => setPinSearchQuery(e.target.value)}
            placeholder={`Search within ${activeFolder} (${filteredSavedPins.length} pins)...`}
            className="w-full bg-transparent text-white placeholder:text-zinc-600 text-xs px-2.5 py-2 focus:outline-none"
          />
          {pinSearchQuery && (
            <button
              onClick={() => setPinSearchQuery('')}
              className="w-4 h-4 rounded-full bg-[#26262b] flex items-center justify-center text-zinc-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
        </div>

        {/* EXPANDED PINS & FOLDERS MANAGEMENT DRAWER */}
        {isFolderListOpen && (
          <div className="space-y-4 pt-3 border-t border-[#26262b]">
            {/* Folder Custom Accent Colors Management Section */}
            <div className="p-3 rounded-2xl bg-[#121214] border border-[#26262b] space-y-2">
              <div className="flex items-center justify-between border-b border-[#26262b] pb-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-orange-400">palette</span>
                  <span>Folder Color Accents (Click to customize)</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Changes sync to map markers</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {collections.map((folder) => {
                  const accentColor = getFolderAccentColor(folder);
                  const icon = getFolderIcon(folder);
                  const isEditingColor = editingFolderColorName === folder;

                  return (
                    <div
                      key={folder}
                      className="p-2.5 rounded-xl bg-[#18181c] border border-white/5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: accentColor }}
                          />
                          <span className="material-symbols-outlined text-[14px]" style={{ color: accentColor }}>
                            {icon}
                          </span>
                          <span className="text-xs font-bold text-white">{folder}</span>
                        </div>
                        <button
                          onClick={() => setEditingFolderColorName(isEditingColor ? null : folder)}
                          className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] font-mono text-zinc-300 flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[12px]" style={{ color: accentColor }}>
                            palette
                          </span>
                          <span>{isEditingColor ? 'Done' : 'Change'}</span>
                        </button>
                      </div>

                      {/* Swatch Picker */}
                      {isEditingColor && (
                        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-white/5">
                          {FOLDER_ACCENT_PALETTE.map((pal) => (
                            <button
                              key={pal.color}
                              type="button"
                              onClick={() => handleUpdateFolderAccentColor(folder, pal.color)}
                              title={pal.name}
                              style={{ backgroundColor: pal.color }}
                              className={`w-5 h-5 rounded-md transition-all cursor-pointer ${
                                accentColor === pal.color
                                  ? 'ring-2 ring-white scale-110 shadow-sm'
                                  : 'opacity-70 hover:opacity-100 hover:scale-105'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saved Pins List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 font-bold uppercase">
                <span>Pins in {activeFolder} ({filteredSavedPins.length})</span>
              </div>

              {filteredSavedPins.length === 0 ? (
                <div className="py-6 text-center text-zinc-500 space-y-1">
                  <span className="material-symbols-outlined text-[28px] opacity-40">push_pin</span>
                  <p className="text-xs">No saved pins in this collection.</p>
                  <p className="text-[10px]">Tap "+ Save Pin" above to drop your first discovery here.</p>
                </div>
              ) : (
                filteredSavedPins.map((pin) => {
                  const isEditing = editingPinId === pin.id;
                  const colName = pin.collectionName || 'General';
                  const accentColor = pin.colorTag || getFolderAccentColor(colName);
                  const colIcon = getFolderIcon(colName);

                  return (
                    <div
                      key={pin.id}
                      className="p-3 rounded-xl bg-[#121214] border border-[#26262b] hover:border-white/20 transition-all space-y-2"
                      style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          {/* Collection Badge Pill */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              style={{
                                color: accentColor,
                                borderColor: `${accentColor}40`,
                                backgroundColor: `${accentColor}15`,
                              }}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border flex items-center gap-1"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: accentColor }}
                              />
                              <span className="material-symbols-outlined text-[12px]">{colIcon}</span>
                              <span>{colName}</span>
                            </span>

                            <span className="text-[10px] text-zinc-500 font-mono">
                              {pin.lat.toFixed(4)}°N, {pin.lng.toFixed(4)}°E
                            </span>
                          </div>

                          {/* Note / Title */}
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                autoFocus
                                className="w-full bg-[#18181c] border border-orange-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveEditedPinNote(pin.id)}
                                className="px-2 py-1 bg-orange-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingPinId(null)}
                                className="px-2 py-1 text-zinc-400 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs font-semibold text-white leading-snug">{pin.note}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingPinId(pin.id);
                              setEditingNoteText(pin.note);
                            }}
                            title="Edit Note"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeletePin(pin.id)}
                            title="Delete Pin"
                            className="w-7 h-7 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 flex items-center justify-center cursor-pointer transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Move to Folder Dropdown Selector */}
                      <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/5">
                        <span className="text-zinc-500">Move folder:</span>
                        <select
                          value={colName}
                          onChange={(e) => handleMovePinToFolder(pin.id, e.target.value)}
                          className="bg-[#18181c] text-orange-300 border border-[#32323a] px-2 py-0.5 rounded-lg text-[10px] cursor-pointer focus:outline-none focus:border-orange-500"
                        >
                          {collections.map((c) => (
                            <option key={c} value={c} className="bg-[#18181c]">
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* SAVE PIN MODAL DIALOG */}
      {isSaveModalOpen && pendingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#18181c] border border-orange-500/40 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-zinc-100">
            <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shadow"
                  style={{
                    backgroundColor: `${newPinColor}25`,
                    color: newPinColor,
                    borderColor: `${newPinColor}50`,
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono">Save New Location Pin</h3>
                  <span className="text-[10px] text-orange-400 font-mono">
                    {pendingLocation.lat.toFixed(4)}°N, {pendingLocation.lng.toFixed(4)}°E
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSaveModalOpen(false);
                  setPendingLocation(null);
                }}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSavePin} className="space-y-3.5">
              {/* Note / Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase">
                  Pin Title / Personal Note
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newPinNote}
                  onChange={(e) => setNewPinNote(e.target.value)}
                  placeholder="e.g. Best Filter Coffee Stall, Secret Gopuram Viewpoint..."
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121214] border border-[#26262b] focus:border-orange-500 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              {/* Collection Folder Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase">
                  Organize into Collection Folder
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {collections.map((col) => {
                    const isSelected = newPinCollection === col;
                    const icon = getFolderIcon(col);
                    const accentColor = getFolderAccentColor(col);

                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          setNewPinCollection(col);
                          setNewPinColor(accentColor);
                          triggerHaptic('light');
                        }}
                        style={
                          isSelected
                            ? {
                                borderColor: accentColor,
                                backgroundColor: `${accentColor}25`,
                                color: '#ffffff',
                              }
                            : undefined
                        }
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold text-left flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isSelected
                            ? 'shadow-md ring-1 ring-white/30'
                            : 'bg-[#121214] text-zinc-300 border-[#26262b] hover:border-white/20'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: accentColor }}
                        />
                        <span className="material-symbols-outlined text-[15px]">{icon}</span>
                        <span className="truncate">{col}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Tag Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase">
                  Marker Accent Color on Map
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {FOLDER_ACCENT_PALETTE.map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => {
                        setNewPinColor(c.color);
                        triggerHaptic('light');
                      }}
                      title={c.name}
                      style={{ backgroundColor: c.color }}
                      className={`w-6 h-6 rounded-lg transition-transform cursor-pointer ${
                        newPinColor === c.color ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSaveModalOpen(false);
                    setPendingLocation(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Location Pin</span>
                </button>
              </div>
            </form>
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
        folderAccentColors={folderColors}
      />
    </div>
  );
};
