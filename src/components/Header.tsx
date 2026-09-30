import React, { useState, useEffect } from 'react';
import { TabType } from '../types';
import { triggerHaptic } from '../lib/haptic';
import { KaosLogo } from './KaosLogo';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onCityClick: () => void;
  onProfileClick?: () => void;
  onLiveLensClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ setActiveTab, onCityClick }) => {
  const { userProfile } = useAuth();
  const [streakCount, setStreakCount] = useState<number>(14);

  useEffect(() => {
    if (userProfile?.streak && userProfile.streak > 0) {
      setStreakCount(userProfile.streak);
      return;
    }

    try {
      const lastDate = localStorage.getItem('kaos_last_active_date');
      const storedStreak = parseInt(localStorage.getItem('kaos_explorer_streak') || '14', 10);
      const today = new Date().toDateString();
      if (lastDate === today) {
        setStreakCount(storedStreak);
      } else {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === yesterday) {
          const newStreak = storedStreak + 1;
          localStorage.setItem('kaos_explorer_streak', String(newStreak));
          localStorage.setItem('kaos_last_active_date', today);
          setStreakCount(newStreak);
        } else {
          localStorage.setItem('kaos_last_active_date', today);
          localStorage.setItem('kaos_explorer_streak', String(storedStreak || 14));
          setStreakCount(storedStreak || 14);
        }
      }
    } catch {
      setStreakCount(14);
    }
  }, [userProfile]);

  return (
    <header className="sticky top-0 w-full z-40 bg-[#121114]/90 backdrop-blur-xl border-b border-[#26242c]">
      <div className="h-14 px-4 flex items-center justify-between max-w-4xl mx-auto">
        {/* Minimalist Brand Identity */}
        <div
          className="flex items-center gap-2 cursor-pointer select-none active:scale-[0.98] transition-transform"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('explore');
          }}
        >
          <KaosLogo size="sm" showTagline={true} taglinePosition="top" interactive={true} />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Explorer Streak Badge */}
          <div
            onClick={() => {
              triggerHaptic('light');
            }}
            title={`Explorer Streak: ${streakCount} consecutive days of discovery`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-xl shadow-[0_0_12px_rgba(240,84,35,0.18)] cursor-pointer hover:bg-orange-500/20 transition-all select-none group"
          >
            <span className="text-[14px] group-hover:scale-110 transition-transform">🔥</span>
            <span className="text-[11px] font-mono font-extrabold text-orange-400 tracking-wider">{streakCount}D</span>
          </div>

          {/* AI Connectivity Status */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-xl shadow-[0_0_10px_rgba(45,212,191,0.1)]">
            <span className="material-symbols-outlined text-teal-400 text-[14px] animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <span className="text-[9px] font-mono font-extrabold text-teal-400 uppercase tracking-widest hidden sm:inline">GEMINI</span>
          </div>

          {/* Minimal Sector Pill */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onCityClick();
            }}
            aria-label="Select Sector: Chennai, India"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/50 text-zinc-300 hover:text-white transition-all text-xs font-semibold rounded-full cursor-pointer shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <span>Chennai</span>
            <span className="text-zinc-600 text-[9px]">•</span>
            <span className="text-orange-400 font-mono text-[10px] font-bold">MAA</span>
          </button>
        </div>
      </div>
    </header>
  );
};
