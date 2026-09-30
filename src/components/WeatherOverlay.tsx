import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../lib/haptic';

interface WeatherOverlayProps {
  landmarkName?: string;
  zone?: string;
  onShowToast: (msg: string, icon?: string) => void;
  onClose?: () => void;
}

interface WeatherData {
  temperature: string;
  humidity: string;
  wind: string;
  vibeIndex: string;
  vibeTitle: string;
  atmosphereSummary: string;
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  landmarkName = 'Kapaleeshwarar Temple',
  zone = 'Mylapore',
  onShowToast,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchWeather() {
      setLoading(true);
      try {
        const res = await fetch('/api/ai/landmark-weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ landmarkName, zone }),
        });
        const data = await res.json();
        if (isMounted) {
          setWeather(data);
        }
      } catch (err) {
        console.warn('Weather fetch error:', err);
        if (isMounted) {
          setWeather({
            temperature: '31°C',
            humidity: '76%',
            wind: '13 km/h SE',
            vibeIndex: '95/100',
            vibeTitle: 'Sacred Granitic Resonance',
            atmosphereSummary: 'Warm tropical breeze laden with sandalwood and sea salt.'
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [landmarkName, zone]);

  return (
    <div className="bg-[#1a1a1e]/95 backdrop-blur-xl border border-teal-500/40 rounded-2xl p-4 shadow-2xl text-zinc-100 max-w-sm w-full space-y-3 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Background cyber grid glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-teal-500/15 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center justify-between border-b border-[#26262b] pb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-teal-400 text-[18px]">thermostat</span>
          <div>
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Atmospheric HUD</h4>
            <span className="text-[10px] text-teal-400 font-mono">{landmarkName} • {zone}</span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-6 h-6 rounded-full bg-[#26262b] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer text-xs font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-teal-400">
          <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          <span className="text-[11px] font-mono">Analyzing Atmospheric Sensors...</span>
        </div>
      ) : weather ? (
        <div className="space-y-3 text-xs">
          {/* Vibe Index Highlight Box */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-teal-950/40 to-[#121214] border border-teal-500/30 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-mono text-teal-400 uppercase font-bold tracking-widest block">Vibe Index Score</span>
              <span className="text-sm font-bold text-white">{weather.vibeTitle}</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-mono font-extrabold text-teal-300 orange-glow">{weather.vibeIndex}</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b]">
              <span className="text-[9px] text-zinc-400 block uppercase">Temp</span>
              <span className="text-xs font-bold text-white mt-0.5 block">{weather.temperature}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b]">
              <span className="text-[9px] text-zinc-400 block uppercase">Humidity</span>
              <span className="text-xs font-bold text-teal-400 mt-0.5 block">{weather.humidity}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b]">
              <span className="text-[9px] text-zinc-400 block uppercase">Wind</span>
              <span className="text-xs font-bold text-zinc-300 mt-0.5 block">{weather.wind}</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-300 italic leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
            "{weather.atmosphereSummary}"
          </p>

          <button
            onClick={() => {
              triggerHaptic('medium');
              onShowToast(`Atmosphere verified for ${landmarkName}: Vibe Index ${weather.vibeIndex}! 🌤️`, 'verified');
            }}
            className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>Sync Vibe with Field Passport</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};
