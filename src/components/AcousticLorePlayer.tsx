import React, { useState } from 'react';
import { soundscapeEngine } from '../lib/soundscapes';
import { triggerHaptic } from '../lib/haptic';

interface AcousticLorePlayerProps {
  onShowToast: (msg: string, icon?: string) => void;
}

export const AcousticLorePlayer: React.FC<AcousticLorePlayerProps> = ({ onShowToast }) => {
  const [activeSoundscape, setActiveSoundscape] = useState<string | null>(null);
  const [activeSoundscapeName, setActiveSoundscapeName] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastActiveId, setLastActiveId] = useState<string>('temple');
  const [lastActiveName, setLastActiveName] = useState<string>('Mylapore Temple Bells');
  const [expanded, setExpanded] = useState(false);

  const playSoundscapeById = (id: string, name: string) => {
    setLastActiveId(id);
    setLastActiveName(name);
    setActiveSoundscapeName(name);
    setIsMuted(false);

    if (id === 'temple') {
      soundscapeEngine.playSoundscape('temple-chimes', 0.5);
    } else if (id === 'waves') {
      soundscapeEngine.playSoundscape('marina-waves', 0.4);
    } else if (id === 'coffee') {
      soundscapeEngine.playSoundscape('filter-coffee', 0.4);
    } else if (id === 'bazaar') {
      soundscapeEngine.playSoundscape('belfry', 0.4);
    }
  };

  const handleToggleSoundscape = (id: string, name: string) => {
    triggerHaptic('medium');

    if (activeSoundscape === id && !isMuted) {
      soundscapeEngine.stop();
      setActiveSoundscape(null);
      setIsMuted(true);
      onShowToast('Ambient spatial soundscape paused', 'volume_off');
      return;
    }

    playSoundscapeById(id, name);
    setActiveSoundscape(id);
    onShowToast(`Playing ${name} Acoustic Soundscape 🎵`, 'graphic_eq');
  };

  const handleQuickAcousticToggle = () => {
    triggerHaptic('medium');

    if (activeSoundscape && !isMuted) {
      // Mute/Pause
      soundscapeEngine.stop();
      setIsMuted(true);
      onShowToast(`Muted ambient soundscape (${activeSoundscapeName}) 🔇`, 'volume_off');
    } else {
      // Resume / Play last active or default
      const idToPlay = lastActiveId || 'temple';
      const nameToPlay = lastActiveName || 'Mylapore Temple Bells';
      playSoundscapeById(idToPlay, nameToPlay);
      setActiveSoundscape(idToPlay);
      onShowToast(`Resumed ambient soundscape: ${nameToPlay} 🎵`, 'volume_up');
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 pointer-events-auto">
      {/* Expanded Soundscape Selector Panel */}
      {expanded && (
        <div className="bg-[#1a1a1e]/95 backdrop-blur-xl border border-[#26262b] rounded-2xl p-3 shadow-2xl space-y-2 animate-in slide-in-from-bottom-2 duration-200 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-[#26262b] pb-2">
            <span className="text-xs text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
              <span>Acoustic Lore Engine</span>
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-[#9898a0] hover:text-white text-xs cursor-pointer font-bold px-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <button
              onClick={() => handleToggleSoundscape('temple', 'Mylapore Temple Bells')}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all font-semibold cursor-pointer border ${
                activeSoundscape === 'temple' && !isMuted
                  ? 'bg-orange-600 text-white font-bold border-orange-500 shadow-md'
                  : 'bg-[#121214] text-zinc-300 border-[#26262b] hover:border-orange-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">temple_hindu</span>
                <span>Temple Chimes</span>
              </div>
              {activeSoundscape === 'temple' && !isMuted && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-white sound-wave-1"></span>
                  <span className="w-0.5 bg-white sound-wave-2"></span>
                  <span className="w-0.5 bg-white sound-wave-3"></span>
                </div>
              )}
            </button>

            <button
              onClick={() => handleToggleSoundscape('waves', 'Coromandel Coastal Breeze')}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all font-semibold cursor-pointer border ${
                activeSoundscape === 'waves' && !isMuted
                  ? 'bg-orange-600 text-white font-bold border-orange-500 shadow-md'
                  : 'bg-[#121214] text-zinc-300 border-[#26262b] hover:border-orange-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">water</span>
                <span>Marina Surf Swell</span>
              </div>
              {activeSoundscape === 'waves' && !isMuted && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-white sound-wave-1"></span>
                  <span className="w-0.5 bg-white sound-wave-2"></span>
                  <span className="w-0.5 bg-white sound-wave-3"></span>
                </div>
              )}
            </button>

            <button
              onClick={() => handleToggleSoundscape('coffee', 'Peaberry Tamarind Roast')}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all font-semibold cursor-pointer border ${
                activeSoundscape === 'coffee' && !isMuted
                  ? 'bg-orange-600 text-white font-bold border-orange-500 shadow-md'
                  : 'bg-[#121214] text-zinc-300 border-[#26262b] hover:border-orange-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">coffee</span>
                <span>Triplicane Roast</span>
              </div>
              {activeSoundscape === 'coffee' && !isMuted && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-white sound-wave-1"></span>
                  <span className="w-0.5 bg-white sound-wave-2"></span>
                  <span className="w-0.5 bg-white sound-wave-3"></span>
                </div>
              )}
            </button>

            <button
              onClick={() => handleToggleSoundscape('bazaar', 'George Town Spice Market')}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all font-semibold cursor-pointer border ${
                activeSoundscape === 'bazaar' && !isMuted
                  ? 'bg-orange-600 text-white font-bold border-orange-500 shadow-md'
                  : 'bg-[#121214] text-zinc-300 border-[#26262b] hover:border-orange-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">notifications</span>
                <span>Church Belfry</span>
              </div>
              {activeSoundscape === 'bazaar' && !isMuted && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-white sound-wave-1"></span>
                  <span className="w-0.5 bg-white sound-wave-2"></span>
                  <span className="w-0.5 bg-white sound-wave-3"></span>
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Controls Bar: Quick Acoustic Toggle + Main Soundscapes Button */}
      <div className="flex items-center gap-2">
        {/* Floating Acoustic Toggle (Quick Mute / Resume) */}
        <button
          onClick={handleQuickAcousticToggle}
          className={`px-3 py-2.5 rounded-2xl border shadow-xl flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer active:scale-95 ${
            activeSoundscape && !isMuted
              ? 'bg-amber-600/90 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-[#1a1a1e]/95 text-zinc-300 hover:text-white border-[#26262b] hover:border-amber-500 backdrop-blur-md'
          }`}
          title={activeSoundscape && !isMuted ? "Mute Ambient Soundscape" : "Resume Ambient Soundscape"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {activeSoundscape && !isMuted ? 'volume_up' : 'volume_off'}
          </span>
          <span className="text-xs font-semibold hidden sm:inline">
            {activeSoundscape && !isMuted ? 'Mute' : 'Resume'}
          </span>
        </button>

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => {
            setExpanded(!expanded);
            triggerHaptic('light');
          }}
          className={`px-3.5 py-2.5 rounded-2xl border shadow-2xl flex items-center gap-2 font-bold text-xs transition-all cursor-pointer active:scale-95 ${
            activeSoundscape && !isMuted
              ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse'
              : 'bg-[#1a1a1e]/95 text-zinc-300 hover:text-white border-[#26262b] hover:border-orange-500 backdrop-blur-md'
          }`}
          title="Toggle Ambient Spatial Audio Soundscapes"
        >
          <span className="material-symbols-outlined text-[18px]">
            {activeSoundscape && !isMuted ? 'graphic_eq' : 'headphones'}
          </span>
          <span className="text-xs font-semibold">
            {activeSoundscape && !isMuted ? 'Audio Active' : 'Soundscapes'}
          </span>
        </button>
      </div>
    </div>
  );
};
