import React, { useState, useEffect } from 'react';
import { Discovery } from '../types';
import { triggerHaptic } from '../lib/haptic';
import { soundscapeEngine } from '../lib/soundscapes';

interface DossierModalProps {
  discovery: Discovery | null;
  isOpen: boolean;
  onClose: () => void;
  onBookmark: (title: string) => void;
  onStartWalk: (title: string) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onOpenSecretPass?: () => void;
  onOpenPassport?: () => void;
}

export const DossierModal: React.FC<DossierModalProps> = ({
  discovery,
  isOpen,
  onClose,
  onBookmark,
  onStartWalk,
  onShowToast,
  onOpenSecretPass,
  onOpenPassport,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [showVintage, setShowVintage] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [narrationSource, setNarrationSource] = useState<'full' | 'summary' | 'ai'>('full');

  const [isAiLoreLoading, setIsAiLoreLoading] = useState(false);
  const [aiLoreResult, setAiLoreResult] = useState<string | null>(null);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [reconstructedImageUrl, setReconstructedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoice) {
        const preferred = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Rishi'))) || voices[0];
        if (preferred) setSelectedVoice(preferred.name);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen || !discovery) return null;

  const handleMayaAiLore = async () => {
    setIsAiLoreLoading(true);
    setAiLoreResult(null);
    triggerHaptic('medium');
    onShowToast(`Consulting Maya AI Archives...`, 'auto_awesome');

    try {
      const prompt = `You are Maya, the Lead Chrono-Navigator for KAOS Chennai.
Task: Provide a "Deep Lore" journal entry for a curious explorer.
Landmark: "${discovery.title}"
Current Knowledge: "${discovery.description}"

Guidelines:
1. Use an evocative, scholarly yet adventurous tone.
2. Uncover a specific historical secret or oral tradition (even if minor).
3. Connect it to the wider fabric of Madras history.
4. Format with: 
   - [THE STORY]
   - [CHRONO-NAVIGATOR SECRET]
   - [MODERN TRACE]`;

      const res = await fetch('/api/ai/maya-lore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      setAiLoreResult(data.text || 'The archives are silent on this specific coordinate, explorer.');
      triggerHaptic('legendary');
    } catch (err) {
      console.warn('Maya AI Lore Error:', err);
      onShowToast('Lore link severed. Try again near a hotspot.', 'error');
    } finally {
      setIsAiLoreLoading(false);
    }
  };

  const handleReconstructImage = async () => {
    setIsReconstructing(true);
    triggerHaptic('heavy');
    onShowToast('Synthesizing vintage digital reconstruction...', 'vivid_banner');

    try {
      const res = await fetch('/api/ai/reconstruct-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          landmarkName: discovery.title,
          landmarkLore: discovery.description 
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setReconstructedImageUrl(data.imageUrl);
        setShowVintage(true);
        onShowToast('Vintage Reconstruction Minted!', 'photo_library');
        triggerHaptic('legendary');
      }
    } catch (err) {
      console.warn('Reconstruction Error:', err);
      onShowToast('Reconstruction engine overloaded.', 'error');
    } finally {
      setIsReconstructing(false);
    }
  };

  const handleSnapAndVerify = () => {
    triggerHaptic([60, 40, 80]);
    setVerifying(true);

    setTimeout(() => {
      setVerifying(false);
      setVerifiedSuccess(true);
      triggerHaptic('legendary');
      onShowToast(`Proof-of-Discovery Verified! +${discovery.xp + 50} XP & Minted Passport Stamp! 🎖️`, 'military_tech');
    }, 1500);
  };

  const handlePlayAudioLore = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onShowToast('Audio guide not supported in this browser', 'error');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      soundscapeEngine.stop();
      setIsPlayingAudio(false);
      onShowToast('Audio narration paused', 'pause');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      let textToSpeak = discovery.fullStory || discovery.description;
      if (narrationSource === 'summary') {
        textToSpeak = discovery.description;
      } else if (narrationSource === 'ai' && aiLoreResult) {
        textToSpeak = aiLoreResult;
      }

      const script = discovery.audioGuideScript || `${discovery.title}. ${textToSpeak}`;
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.rate = speechRate;

      if (selectedVoice) {
        const voices = window.speechSynthesis.getVoices();
        const voiceObj = voices.find(v => v.name === selectedVoice);
        if (voiceObj) utterance.voice = voiceObj;
      }

      utterance.onstart = () => {
        setIsPlayingAudio(true);
        if (discovery.soundscapeType) {
          soundscapeEngine.playSoundscape(discovery.soundscapeType, 0.35);
        }
        triggerHaptic('light');
        onShowToast(`Narrating via Web Speech API (${speechRate}x)...`, 'volume_up');
      };

      utterance.onend = () => {
        setIsPlayingAudio(false);
        soundscapeEngine.stop();
      };

      utterance.onerror = () => {
        setIsPlayingAudio(false);
        soundscapeEngine.stop();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
      soundscapeEngine.stop();
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => {
        triggerHaptic('light');
        soundscapeEngine.stop();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        onClose();
      }}
    >
      <div
        className="bg-[#1a1a1e] text-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[88vh] overflow-y-auto border border-[#26262b] space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-[#26262b] rounded-full mx-auto mb-2 sm:hidden"></div>

        {/* Top Title Bar */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-xs font-bold">
              <span className="text-orange-400 font-semibold">{discovery.zone}</span>
              {discovery.architecturalStyle && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-teal-400">{discovery.architecturalStyle.split('&')[0]}</span>
                </>
              )}
            </div>
            <h3 className="font-headline text-2xl text-white font-bold leading-tight">
              {discovery.title}
            </h3>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              soundscapeEngine.stop();
              if ('speechSynthesis' in window) window.speechSynthesis.cancel();
              onClose();
            }}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-[#26262b] hover:bg-orange-600 hover:text-white flex items-center justify-center text-zinc-400 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Image & Vintage 100-Year Comparison Viewfinder */}
        <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-[#26262b]">
          <img
            src={showVintage ? (reconstructedImageUrl || (discovery.vintageImageUrl || discovery.imageUrl)) : discovery.imageUrl}
            alt={discovery.title}
            className={`w-full h-full object-cover transition-all duration-500 ${showVintage && reconstructedImageUrl ? 'sepia-[0.3]' : ''}`}
            referrerPolicy="no-referrer"
          />

          <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md text-orange-400 text-xs font-bold border border-white/10 shadow-sm flex items-center gap-1.5">
            {showVintage && reconstructedImageUrl ? (
              <>
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>AI RECONSTRUCTION</span>
              </>
            ) : (
              showVintage && discovery.vintageYear ? discovery.vintageYear : discovery.provenance
            )}
          </div>

          <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1 shadow-md">
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            <span>+{verifiedSuccess ? discovery.xp + 50 : discovery.xp} XP</span>
          </div>

          {/* AI Reconstruction / Vintage Toggle */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end">
            {!reconstructedImageUrl && !discovery.vintageImageUrl ? (
              <button
                onClick={handleReconstructImage}
                disabled={isReconstructing}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/10 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isReconstructing ? (
                  <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                )}
                <span>AI Vintage Reconstruction</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowVintage(!showVintage);
                  triggerHaptic('light');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-black/75 hover:bg-orange-600 text-orange-400 hover:text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/10 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">history_toggle_off</span>
                <span>{showVintage ? 'Present Day' : (reconstructedImageUrl ? 'View AI Reconstruction' : '100-Year Flashback')}</span>
              </button>
            )}
          </div>

          {verifiedSuccess && (
            <div className="absolute bottom-3 left-3 bg-emerald-500 text-black px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Proof Minted in Passport</span>
            </div>
          )}
        </div>

        {/* Web Speech API Audio Narration Studio */}
        <div className="p-4 bg-[#121214] rounded-2xl border border-[#26262b] space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isPlayingAudio ? 'bg-orange-500 text-white animate-pulse' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isPlayingAudio ? 'volume_up' : 'spatial_audio'}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Web Speech Narration Studio</span>
                  {isPlayingAudio && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/20 rounded text-[9px] text-orange-400">
                      <span className="w-1 h-2.5 bg-orange-400 animate-pulse rounded-full"></span>
                      <span className="w-1 h-4 bg-orange-400 animate-pulse rounded-full delay-75"></span>
                      <span className="w-1 h-3 bg-orange-400 animate-pulse rounded-full delay-150"></span>
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-[#9898a0]">Binaural soundscape & speech synthesis</p>
              </div>
            </div>

            <button
              onClick={handlePlayAudioLore}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                isPlayingAudio
                  ? 'bg-orange-500 text-white animate-pulse'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isPlayingAudio ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlayingAudio ? 'Pause Narration' : 'Listen Now'}</span>
            </button>
          </div>

          {/* Narration Source & Speed Controls */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#26262b]">
            <div>
              <label className="text-[10px] text-zinc-400 font-medium block mb-1">Narration Script</label>
              <select
                value={narrationSource}
                onChange={(e) => {
                  setNarrationSource(e.target.value as any);
                  triggerHaptic('light');
                }}
                className="w-full bg-[#1a1a1e] border border-[#26262b] text-zinc-200 text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
              >
                <option value="full">Full Historical Lore</option>
                <option value="summary">Brief Summary</option>
                {aiLoreResult && <option value="ai">Maya AI Journal</option>}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 font-medium block mb-1">Narration Speed: {speechRate}x</label>
              <div className="flex items-center gap-1">
                {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setSpeechRate(rate);
                      triggerHaptic('light');
                    }}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      speechRate === rate
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-[#1a1a1e] text-zinc-400 hover:text-white border border-[#26262b]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Selector if available */}
          {availableVoices.length > 0 && (
            <div className="pt-1">
              <label className="text-[10px] text-zinc-400 font-medium block mb-1">Synthesis Voice ({availableVoices.length} available)</label>
              <select
                value={selectedVoice || ''}
                onChange={(e) => {
                  setSelectedVoice(e.target.value);
                  triggerHaptic('light');
                }}
                className="w-full bg-[#1a1a1e] border border-[#26262b] text-zinc-200 text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
              >
                {availableVoices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Story & Historical Background */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#26262b] pb-2">
            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">Historical Provenance</span>
            <button
              onClick={handleMayaAiLore}
              disabled={isAiLoreLoading}
              className="flex items-center gap-1.5 text-[10px] font-bold text-teal-400 hover:text-teal-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span>{isAiLoreLoading ? 'Consulting Maya...' : 'Consult Maya AI'}</span>
            </button>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">{discovery.fullStory || discovery.description}</p>
          
          {aiLoreResult && (
            <div className="mt-4 p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-teal-400 font-bold text-[10px] uppercase">
                <span className="material-symbols-outlined text-[16px]">history_edu</span>
                <span>Maya's Deep Lore Journal</span>
              </div>
              <p className="text-xs text-teal-100/90 leading-relaxed italic whitespace-pre-wrap">
                {aiLoreResult}
              </p>
            </div>
          )}
        </div>

        {/* Secret Perk Callout (if available) */}
        {discovery.secretPerkId && (
          <div className="p-3.5 bg-[#121214] rounded-2xl border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-[22px]">stars</span>
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Secret Merchant Perk</span>
                <span className="text-xs font-bold text-white">Off-Menu Dish Available</span>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenSecretPass?.();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer shadow-sm"
            >
              View Pass
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 grid grid-cols-2 gap-3">
          <button
            onClick={handleSnapAndVerify}
            disabled={verifying || verifiedSuccess}
            className={`py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
              verifiedSuccess
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-[#26262b] hover:bg-[#32323a] text-white border border-[#32323a]'
            }`}
          >
            {verifying ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : verifiedSuccess ? (
              <>
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>GPS Verified</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">fmd_good</span>
                <span>GPS Check-In</span>
              </>
            )}
          </button>

          <button
            onClick={() => onStartWalk(discovery.title)}
            className="py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">directions_walk</span>
            <span>Start Walk</span>
          </button>
        </div>
      </div>
    </div>
  );
};
