import React from 'react';
import { useDailyQuestNotification } from '../hooks/useDailyQuestNotification';

export type TabType = 'home' | 'explore' | 'map' | 'squads' | 'assistant' | 'messages' | 'friends' | 'profile';

interface BottomBarProps {
  currentTab: TabType;
  onTabSelected: (tab: TabType) => void;
  unreadChatCount?: number;
}

export const BottomBar: React.FC<BottomBarProps> = ({ currentTab, onTabSelected, unreadChatCount = 0 }) => {
  const { hasNewQuests, uncompletedCount } = useDailyQuestNotification(currentTab as any);

  // Mapped to the exact NANBAR overall Information Architecture
  const tabs = [
    { key: 'home' as TabType, label: 'Home', icon: 'home', activeColor: 'text-kaos-teal' },
    { key: 'explore' as TabType, label: 'Explore', icon: 'explore', activeColor: 'text-kaos-blue' },
    { key: 'map' as TabType, label: 'AR Radar', icon: 'view_in_ar', activeColor: 'text-kaos-orange' },
    { key: 'friends' as TabType, label: 'NANBAR', icon: 'diversity_3', activeColor: 'text-kaos-pink' }, // Everything Social!
    { key: 'profile' as TabType, label: 'Passport', icon: 'badge', activeColor: 'text-kaos-yellow' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-kaos-navy/95 backdrop-blur-2xl border-t border-surface-primary px-2 py-2 flex items-center justify-around max-w-xl mx-auto md:max-w-3xl rounded-t-2xl shadow-2xl">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        const isExploreTab = tab.key === 'explore';
        const isNanbarTab = tab.key === 'friends';
        const showAnimation = isExploreTab && hasNewQuests;

        return (
          <button
            key={tab.key}
            onClick={() => onTabSelected(tab.key)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
              isActive
                ? `${tab.activeColor} font-black scale-105`
                : 'text-text-secondary hover:text-kaos-offwhite font-medium'
            }`}
          >
            {/* Tab Icon with subtle animation */}
            <span className="relative flex items-center justify-center">
              <span
                className={`material-symbols-outlined text-[20px] transition-transform ${
                  isActive ? 'fill-current' : ''
                } ${showAnimation && !isActive ? 'animate-subtle-bounce text-kaos-orange' : ''}`}
              >
                {tab.icon}
              </span>

              {/* Dynamic Call-to-Action Beacon Dot */}
              {showAnimation && (
                <span className="absolute -top-1 -right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kaos-orange opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-tr from-kaos-orange to-kaos-yellow shadow-sm"></span>
                </span>
              )}

              {/* Unread Message Badge Indicator for NANBAR */}
              {isNanbarTab && unreadChatCount > 0 && !isActive && (
                <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-kaos-pink text-white text-[9px] font-mono font-bold leading-none shadow-md animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </span>

            <span className="text-[9.5px] tracking-tight flex items-center gap-1">
              <span>{tab.label}</span>
              {showAnimation && !isActive && (
                <span className="text-[9px] font-mono text-kaos-orange font-bold">
                  {uncompletedCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomBar;
