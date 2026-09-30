import React from 'react';
import { TabType } from '../types';
import { triggerHaptic } from '../lib/haptic';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onTabChangeToast: (label: string, icon: string) => void;
  unreadCount?: number;
  onOpenActionHub: (initialTab?: 'passport' | 'perks' | 'radar') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onTabChangeToast,
  unreadCount = 0,
  onOpenActionHub,
}) => {
  const isTabActive = (tabId: TabType) => {
    if (activeTab === tabId) return true;
    if (tabId === 'explore' && (activeTab === 'home' || activeTab === 'adventures')) return true;
    if (tabId === 'map' && activeTab === 'ar-quest') return true;
    if (tabId === 'me-profile' && activeTab === 'journal') return true;
    return false;
  };

  const handleTabSelect = (tabId: TabType, label: string, icon: string) => {
    triggerHaptic('light');
    setActiveTab(tabId);
    onTabChangeToast(`Switched to ${label}`, icon);
  };

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-[#121114]/95 backdrop-blur-2xl border-t border-[#26242c]"
      role="navigation"
    >
      <div className="flex items-center justify-between h-16 max-w-lg mx-auto px-3 relative" role="tablist">
        {/* 1. Explore */}
        <button
          type="button"
          role="tab"
          aria-selected={isTabActive('explore')}
          onClick={() => handleTabSelect('explore', 'Explore', 'explore')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            isTabActive('explore') ? 'text-[#F05423]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{ fontVariationSettings: isTabActive('explore') ? "'FILL' 1, 'wght' 600" : "'FILL' 0" }}
          >
            explore
          </span>
          <span className={`text-[10px] mt-0.5 tracking-tight ${isTabActive('explore') ? 'font-bold' : 'font-medium'}`}>
            Explore
          </span>
        </button>

        {/* 2. Live Map */}
        <button
          type="button"
          role="tab"
          aria-selected={isTabActive('map')}
          onClick={() => handleTabSelect('map', 'Live Map', 'map')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            isTabActive('map') ? 'text-[#F05423]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{ fontVariationSettings: isTabActive('map') ? "'FILL' 1, 'wght' 600" : "'FILL' 0" }}
          >
            map
          </span>
          <span className={`text-[10px] mt-0.5 tracking-tight ${isTabActive('map') ? 'font-bold' : 'font-medium'}`}>
            Live Map
          </span>
        </button>

        {/* 3. CENTERPIECE: Action Hub Discovery Portal */}
        <div className="flex flex-col items-center justify-center px-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onOpenActionHub('passport');
            }}
            aria-label="Open Action Hub"
            title="Discovery Action Hub (Passport, Perks & Radar)"
            className="w-12 h-12 -mt-4 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-[0_0_16px_rgba(240,84,35,0.45)] hover:shadow-[0_0_22px_rgba(240,84,35,0.65)] hover:scale-105 active:scale-95 transition-all border-2 border-[#121114] cursor-pointer group"
          >
            <span className="material-symbols-outlined text-[24px] group-hover:rotate-12 transition-transform">
              hub
            </span>
          </button>
          <span className="text-[9px] font-bold text-orange-400 tracking-tight mt-0.5">
            Action Hub
          </span>
        </div>

        {/* 4. Community */}
        <button
          type="button"
          role="tab"
          aria-selected={isTabActive('groups')}
          onClick={() => handleTabSelect('groups', 'Community', 'forum')}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            isTabActive('groups') ? 'text-[#F05423]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <span
              className="material-symbols-outlined text-[24px]"
              style={{ fontVariationSettings: isTabActive('groups') ? "'FILL' 1, 'wght' 600" : "'FILL' 0" }}
            >
              forum
            </span>
            {Boolean(unreadCount && unreadCount > 0) && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-[#F05423] text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_6px_rgba(240,84,35,0.8)] animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] mt-0.5 tracking-tight ${isTabActive('groups') ? 'font-bold' : 'font-medium'}`}>
            Community
          </span>
        </button>

        {/* 5. Me / Profile */}
        <button
          type="button"
          role="tab"
          aria-selected={isTabActive('me-profile')}
          onClick={() => handleTabSelect('me-profile', 'Me', 'person')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            isTabActive('me-profile') ? 'text-[#F05423]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{ fontVariationSettings: isTabActive('me-profile') ? "'FILL' 1, 'wght' 600" : "'FILL' 0" }}
          >
            person
          </span>
          <span className={`text-[10px] mt-0.5 tracking-tight ${isTabActive('me-profile') ? 'font-bold' : 'font-medium'}`}>
            Me
          </span>
        </button>
      </div>
    </nav>
  );
};
