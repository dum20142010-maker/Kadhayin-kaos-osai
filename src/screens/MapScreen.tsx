import React, { useState, useRef } from 'react';
import { Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { soundscapes } from '../lib/soundscapeEngine';
import { KAOS_SPOTS } from '../data/kaosData';
import { MasterSpot } from '../types';
import { useLiveGeolocation, calculateDistanceMeters } from '../hooks/useLiveGeolocation';

interface MapScreenProps {
  onShowToast: (msg: string) => void;
  onAwardXp?: (amount: number, reason: string) => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({ onShowToast, onAwardXp }) => {
  const [activeSoundscape, setActiveSoundscape] = useState<string>('temple');
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'ar' | 'map' | 'snapshot'>('ar');
  const [bearing, setBearing] = useState<number>(42);
  const [selectedSpotId, setSelectedSpotId] = useState<string>('senate-house');
  const [infoWindowSpot, setInfoWindowSpot] = useState<MasterSpot | null>(null);

  // Native Live Geolocation hook with continuous GPS tracking
  const { coords: userCoords, isLiveGps } = useLiveGeolocation(13.0642, 80.2811);
  const [checkingIn, setCheckingIn] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentActiveSpot: MasterSpot =
    KAOS_SPOTS.find((s) => s.id === selectedSpotId) || KAOS_SPOTS[0];

  const distanceToTargetMeters = calculateDistanceMeters(
    userCoords.lat,
    userCoords.lng,
    currentActiveSpot.lat || 13.0642,
    currentActiveSpot.lng || 80.2811
  );

  const handlePlaySoundscape = (type: string, name: string) => {
    setActiveSoundscape(type);
    setIsPlaying(true);

    if (type === 'temple') soundscapes.playTempleBells();
    else if (type === 'coffee') soundscapes.playFilterCoffee();
    else if (type === 'waves') soundscapes.playMarinaWaves();
    else soundscapes.playBelfry();

    onShowToast(`Activated ${name} soundscape 🎵`);
  };

  const handleStopSoundscape = () => {
    soundscapes.stop();
    setIsPlaying(false);
    onShowToast('Ambient audio paused');
  };

  // Live Geofence Check-in using MCP & Live Distance
  const handleVerifyGeofence = async () => {
    setCheckingIn(true);
    try {
      const res = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'kaos_verify_geofence',
          arguments: {
            spotId: currentActiveSpot.id,
            userLat: userCoords.lat,
            userLng: userCoords.lng,
          },
        }),
      });

      const data = await res.json();
      const raw = data.raw || {};

      if (raw.verified || distanceToTargetMeters <= 500) {
        soundscapes.playSuccessTone();
        if (onAwardXp) onAwardXp(raw.xpAwarded || currentActiveSpot.xp, currentActiveSpot.title);
        onShowToast(`🎯 GPS Geofence Check-In Confirmed! +${raw.xpAwarded || currentActiveSpot.xp} XP unlocked!`);
      } else {
        onShowToast(
          `Target is ${distanceToTargetMeters}m away. Move closer to verify.`
        );
      }
    } catch {
      onShowToast('GPS verification completed.');
    } finally {
      setCheckingIn(false);
    }
  };

  // Capture Vintage 1888 Postcard Snapshot
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 700;

    // Vintage paper background
    ctx.fillStyle = '#1A1820';
    ctx.fillRect(0, 0, 600, 700);

    // Inner photo area
    ctx.fillStyle = '#26242C';
    ctx.fillRect(30, 30, 540, 480);

    // Draw spot photo thumbnail
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentActiveSpot.imageUrl;
    img.onload = () => {
      ctx.drawImage(img, 30, 30, 540, 480);

      // Vintage Sepia Overlay Filter
      ctx.fillStyle = 'rgba(240, 84, 35, 0.15)';
      ctx.fillRect(30, 30, 540, 480);

      // Grid Vignette lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, 520, 460);

      // Typography
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(currentActiveSpot.title, 35, 550);

      ctx.fillStyle = '#F05423';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(
        `ZONE: ${currentActiveSpot.zone.toUpperCase()} · BEARING: ${bearing}°`,
        35,
        580
      );

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '13px monospace';
      ctx.fillText(
        `GPS: ${userCoords.lat.toFixed(4)}° N, ${userCoords.lng.toFixed(4)}° E`,
        35,
        610
      );
      ctx.fillText(`ARCHIVE: ${currentActiveSpot.vintageYear}`, 35, 635);
      ctx.fillText(`EXPEDITION STAMP · ${new Date().toLocaleDateString()}`, 35, 660);

      const dataUrl = canvas.toDataURL('image/png');
      setCapturedPhoto(dataUrl);
      soundscapes.playSuccessTone();
      onShowToast('Vintage Expedition Postcard Captured! 📸');
    };
  };

  return (
    <div className="space-y-6 pb-28 p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* View Header with Mode Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#26242C] pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            AR Live Lens & Google Maps Radar
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Google Maps Platform Advanced Markers, binaural acoustic telemetry, and live GPS beacon check-in
          </p>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-[#1C1A1F] border border-[#26242C] rounded-2xl self-start sm:self-auto shrink-0">
          <button
            onClick={() => setViewMode('ar')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'ar'
                ? 'bg-[#F05423] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
            <span>Live Lens</span>
          </button>

          <button
            onClick={() => setViewMode('map')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'map'
                ? 'bg-[#F05423] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">map</span>
            <span>Google Maps</span>
          </button>

          <button
            onClick={() => setViewMode('snapshot')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'snapshot'
                ? 'bg-[#F05423] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            <span>Snapshot</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main View Area */}
        <div className="lg:col-span-8 space-y-4">
          {viewMode === 'ar' && (
            <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              {/* Live GPS Telemetry Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#121114] border border-[#26242C] text-xs">
                <div className="flex items-center gap-2 text-zinc-300 font-mono">
                  <span className="text-[#F05423] font-bold">GPS TELEMETRY:</span>
                  <span className="tabular-nums">
                    {userCoords.lat.toFixed(4)}° N, {userCoords.lng.toFixed(4)}° E
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${isLiveGps ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
                  <span className={`font-bold ${isLiveGps ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {isLiveGps ? 'LIVE GPS ACTIVE' : 'MADRAS SIGNAL LOCKED'}
                    {userCoords.accuracy ? ` (±${Math.round(userCoords.accuracy)}m)` : ''}
                  </span>
                </div>
              </div>

              {/* Holographic Target Viewfinder */}
              <div className="relative rounded-3xl overflow-hidden border border-[#26242C] bg-gradient-to-b from-[#18161D] to-black p-8 text-center space-y-6 shadow-inner">
                <div className="absolute inset-0 bg-[radial-gradient(#F05423_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

                {/* Rotating AR Reticle */}
                <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full border-2 border-dashed border-[#F05423] transition-transform duration-300"
                    style={{ transform: `rotate(${bearing}deg)` }}
                  />
                  <div className="w-20 h-20 rounded-2xl bg-[#F05423]/15 border border-[#F05423]/50 flex items-center justify-center text-white shadow-xl shadow-[#F05423]/20">
                    <span className="material-symbols-outlined text-4xl text-[#F05423]">explore</span>
                  </div>
                </div>

                {/* Clear Target Info */}
                <div className="relative z-10 space-y-2 max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                    <span className="text-[#F05423] font-bold">{currentActiveSpot.zone} Sector</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-cyan-400 font-bold font-mono">{distanceToTargetMeters}m away</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-zinc-300 tabular-nums">+{currentActiveSpot.xp} XP</span>
                  </div>

                  <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                    {currentActiveSpot.title}
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {currentActiveSpot.description}
                  </p>

                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-black/60 border border-[#26242C] text-amber-400 font-mono text-xs">
                    <span>Bearing: {bearing}° NE</span>
                    <span>·</span>
                    <span>Distance: {distanceToTargetMeters}m</span>
                  </div>
                </div>

                {/* Bearing Angle Slider Control */}
                <div className="relative z-10 bg-black/70 backdrop-blur-md p-4 rounded-2xl border border-[#26242C] space-y-2 max-w-md mx-auto">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                    <span>Manual Compass Heading</span>
                    <span className="font-mono text-[#F05423] font-bold tabular-nums">{bearing}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={bearing}
                    onChange={(e) => setBearing(Number(e.target.value))}
                    className="w-full accent-[#F05423] cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons Deck */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleVerifyGeofence}
                  disabled={checkingIn}
                  className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#F05423] to-[#FF8A00] text-white font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#F05423]/25 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <span>{checkingIn ? 'Verifying Beacon...' : `GPS Check-In (+${currentActiveSpot.xp} XP)`}</span>
                </button>

                <button
                  onClick={() => setViewMode('snapshot')}
                  className="py-3.5 px-4 rounded-2xl bg-[#121114] hover:bg-[#26242C] border border-[#26242C] text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                  <span>Capture 1888 Postcard</span>
                </button>
              </div>
            </div>
          )}

          {viewMode === 'map' && (
            <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Interactive Google Maps View</h3>
                  <p className="text-xs text-zinc-400">
                    Live Google Maps Platform vector map with Advanced Markers & Teleportation
                  </p>
                </div>
              </div>

              {/* Google Maps View */}
              <div className="relative w-full h-[450px] rounded-2xl overflow-hidden border border-[#26242C] bg-zinc-900 shadow-inner">
                <Map
                  center={{ lat: userCoords.lat, lng: userCoords.lng }}
                  defaultZoom={13}
                  mapId="DEMO_MAP_ID"
                  gestureHandling={'greedy'}
                  disableDefaultUI={false}
                  className="w-full h-full"
                >
                  {/* User's Live Position Marker */}
                  <AdvancedMarker position={{ lat: userCoords.lat, lng: userCoords.lng }}>
                    <Pin background="#06B6D4" borderColor="#ffffff" glyphColor="#ffffff" />
                  </AdvancedMarker>

                  {KAOS_SPOTS.map((spot) => (
                    <AdvancedMarker
                      key={spot.id}
                      position={{ lat: spot.lat || 13.0642, lng: spot.lng || 80.2811 }}
                      onClick={() => setInfoWindowSpot(spot)}
                    >
                      <Pin
                        background={spot.id === selectedSpotId ? '#F05423' : '#10B981'}
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                      />
                    </AdvancedMarker>
                  ))}

                  {infoWindowSpot && (
                    <InfoWindow
                      position={{ lat: infoWindowSpot.lat || 13.0642, lng: infoWindowSpot.lng || 80.2811 }}
                      onCloseClick={() => setInfoWindowSpot(null)}
                    >
                      <div className="p-2 text-zinc-900 max-w-xs space-y-1 font-sans">
                        <span className="text-[10px] font-mono uppercase font-bold text-[#F05423]">
                          {infoWindowSpot.zone} Sector
                        </span>
                        <h4 className="font-bold text-xs">{infoWindowSpot.title}</h4>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{infoWindowSpot.description}</p>
                        <button
                          onClick={() => {
                            setSelectedSpotId(infoWindowSpot.id);
                            setViewMode('ar');
                            onShowToast(`Aligned Live Lens with ${infoWindowSpot.title}`);
                          }}
                          className="mt-1 w-full py-1 bg-[#F05423] text-white text-[10px] font-bold rounded cursor-pointer"
                        >
                          Align Live Lens
                        </button>
                      </div>
                    </InfoWindow>
                  )}
                </Map>
              </div>
            </div>
          )}

          {viewMode === 'snapshot' && (
            <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Vintage 1888 Postcard Generator</h3>
                  <p className="text-xs text-zinc-400">
                    Renders an authenticated Madras Lore postcard with GPS stamp
                  </p>
                </div>

                <button
                  onClick={handleCaptureSnapshot}
                  className="px-4 py-2 bg-[#F05423] text-white rounded-xl text-xs font-bold hover:bg-[#ff6a38] transition-colors cursor-pointer"
                >
                  Generate Postcard
                </button>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {capturedPhoto ? (
                <div className="space-y-4 text-center">
                  <div className="inline-block p-2 bg-[#121114] border border-[#26242C] rounded-2xl shadow-2xl max-w-md mx-auto">
                    <img
                      src={capturedPhoto}
                      alt="1888 Postcard"
                      className="w-full rounded-xl shadow-md"
                    />
                  </div>
                  <div>
                    <a
                      href={capturedPhoto}
                      download={`Madras_Postcard_${currentActiveSpot.id}.png`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Download Expedition Postcard</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-12 border-2 border-dashed border-[#26242C] rounded-3xl text-center space-y-3">
                  <span className="material-symbols-outlined text-4xl text-zinc-600">photo_library</span>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Click "Generate Postcard" to compile your current beacon telemetry into a collectible expedition stamp.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ambient Soundscapes Sidebar */}
        <div className="lg:col-span-4 bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-[#F05423]">
              Binaural Soundscapes
            </h3>
            {isPlaying && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F05423] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F05423]"></span>
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Synthesized ambient acoustic environments tuned to Madras heritage sectors.
          </p>

          <div className="space-y-2.5">
            {[
              { id: 'temple', name: 'Mylapore Temple Bells', icon: 'notifications', desc: 'Resonating bronze bell harmonics' },
              { id: 'coffee', name: 'Triplicane Coffee Roastery', icon: 'coffee', desc: 'Brass filter dripping & roasting sounds' },
              { id: 'waves', name: 'Marina Beach Dawn Waves', icon: 'waves', desc: 'Binaural shoreline ocean waves' },
              { id: 'belfry', name: 'Senate House Belfry', icon: 'church', desc: 'Acoustic reverb of high gothic arches' },
            ].map((snd) => {
              const isCurrent = activeSoundscape === snd.id && isPlaying;
              return (
                <button
                  key={snd.id}
                  onClick={() =>
                    isCurrent
                      ? handleStopSoundscape()
                      : handlePlaySoundscape(snd.id, snd.name)
                  }
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isCurrent
                      ? 'bg-[#F05423]/20 border-[#F05423] text-white shadow-md'
                      : 'bg-[#121114] border-[#26242C] text-zinc-300 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isCurrent ? 'bg-[#F05423] text-white' : 'bg-[#1C1A1F] text-zinc-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isCurrent ? 'pause' : snd.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate">{snd.name}</h4>
                    <p className="text-[10px] text-zinc-500 truncate">{snd.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
