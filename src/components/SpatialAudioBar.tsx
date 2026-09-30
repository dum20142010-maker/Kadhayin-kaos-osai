import React, { useState, useEffect } from 'react';
import { soundscapeEngine } from '../lib/soundscapes';
import { triggerHaptic } from '../lib/haptic';

interface SpatialAudioBarProps {
  onShowToast: (msg: string, icon?: string) => void;
}

export const SpatialAudioBar: React.FC<SpatialAudioBarProps> = ({ onShowToast }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSoundscape, setActiveSoundscape] = useState<'temple-chimes' | 'filter-coffee' | 'marina-waves' | 'belfry'>('temple-chimes');
  const [voiceNarratorOn, setVoiceNarratorOn] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    return () => {
      soundscapeEngine.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const togglePlay = () => {
    triggerHaptic('medium');
    if (isPlaying) {
      soundscapeEngine.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      onShowToast('Spatial soundscape paused', 'pause');
    } else {
      soundscapeEngine.playSoundscape(activeSoundscape, 0.5);
      setIsPlaying(true);
      onShowToast(`Playing spatial atmosphere: ${activeSoundscape.replace('-', ' ')}`, 'headphones');

      if (voiceNarratorOn && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(
          `Spatial audio walk enabled. Immerse yourself in ${activeSoundscape.replace('-', ' ')} soundscape as you navigate through Chennai heritage alleys.`
        );
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleSelectSoundscape = (type: 'temple-chimes' | 'filter-coffee' | 'marina-waves' | 'belfry') => {
    setActiveSoundscape(type);
    triggerHaptic('light');
    if (isPlaying) {
      soundscapeEngine.playSoundscape(type, 0.5);
      onShowToast(`Switched to ${type.replace('-', ' ')}`, 'spatial_audio');
    }
  };

  return (
    <div className="w-full bg-[#1a1a1e] rounded-2xl border border-[#26262b] hover:border-orange-500/30 p-3.5 shadow-md transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause Spatial Audio' : 'Play Spatial Audio'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border ${
              isPlaying
                ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                : 'bg-[#121214] text-orange-400 border-[#26262b] hover:border-orange-500'
            }`}
          >
            {isPlaying ? (
              <div className="flex items-end gap-0.5 h-4 px-1">
                <span className="w-1 bg-white sound-wave-1"></span>
                <span className="w-1 bg-white sound-wave-2"></span>
                <span className="w-1 bg-white sound-wave-3"></span>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>
                headphones
              </span>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Spatial Audio Atmosphere</span>
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
            </div>
            <p className="text-[10px] text-[#9898a0] mt-0.5">
              {isPlaying ? `Active Layer: ${activeSoundscape.replace('-', ' ')}` : 'Immersive Binaural Soundscape'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
            triggerHaptic('light');
          }}
          className="px-3 py-1.5 rounded-xl bg-[#121214] text-[#9898a0] hover:text-white border border-[#26262b] hover:border-orange-500 text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <span>{isExpanded ? 'Hide' : 'Presets'}</span>
          <span className="material-symbols-outlined text-[14px]">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {/* Expanded Soundscape Selection Drawer */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[#26262b] space-y-2.5">
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">Select Binaural Soundscape</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'temple-chimes', label: 'Temple Bells', icon: 'temple_hindu' },
              { id: 'filter-coffee', label: 'Coffee Roastery', icon: 'coffee' },
              { id: 'marina-waves', label: 'Marina Surf', icon: 'water' },
              { id: 'belfry', label: 'Church Belfry', icon: 'notifications' }
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleSelectSoundscape(sc.id as any)}
                className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                  activeSoundscape === sc.id
                    ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                    : 'bg-[#121214] text-[#9898a0] border-[#26262b] hover:text-white hover:border-[#32323a]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{sc.icon}</span>
                <span className="truncate">{sc.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-[#9898a0]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={voiceNarratorOn}
                onChange={(e) => {
                  setVoiceNarratorOn(e.target.checked);
                  onShowToast(e.target.checked ? 'Voice narrator enabled' : 'Voice narrator muted', 'record_voice_over');
                }}
                className="rounded bg-[#121214] border-[#26262b] accent-orange-500"
              />
              <span>Synthesized Lore Voice</span>
            </label>
            <span className="text-[10px] font-mono text-orange-400 font-bold">432 Hz Web Audio</span>
          </div>
        </div>
      )}
    </div>
  );
};
