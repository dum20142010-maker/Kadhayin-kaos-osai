import React from 'react';
import { useDailyQuestNotification } from '../hooks/useDailyQuestNotification';

export type TabType = 'explore' | 'map' | 'assistant' | 'messages' | 'social' | 'profile';

interface BottomBarProps {
  currentTab: TabType;
  onTabSelected: (tab: TabType) => void;
  unreadChatCount?: number;
}

export const BottomBar: React.FC<BottomBarProps> = ({ currentTab, onTabSelected, unreadChatCount = 0 }) => {
  const { hasNewQuests, uncompletedCount } = useDailyQuestNotification(currentTab as any);

  const tabs = [
    { key: 'explore' as TabType, label: 'Explore', icon: 'explore' },
    { key: 'map' as TabType, label: 'AR Lens', icon: 'view_in_ar' },
    { key: 'assistant' as TabType, label: 'KAOS Bot', icon: 'smart_toy' },
    { key: 'messages' as TabType, label: 'Messages', icon: 'chat' },
    { key: 'social' as TabType, label: 'Social', icon: 'groups' },
    { key: 'profile' as TabType, label: 'Passport', icon: 'badge' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1C1A1F]/95 backdrop-blur-2xl border-t border-[#26242C] px-2 py-2 flex items-center justify-around max-w-xl mx-auto md:max-w-3xl">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        const isExploreTab = tab.key === 'explore';
        const isMessagesTab = tab.key === 'messages';
        const showAnimation = isExploreTab && hasNewQuests;

        return (
          <button
            key={tab.key}
            onClick={() => onTabSelected(tab.key)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer relative ${
              isActive
                ? 'text-[#F05423] font-bold scale-105'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {/* Tab Icon with subtle animation */}
            <span className="relative flex items-center justify-center">
              <span
                className={`material-symbols-outlined text-[20px] transition-transform ${
                  isActive ? 'fill-current text-[#F05423]' : ''
                } ${showAnimation && !isActive ? 'animate-subtle-bounce text-[#F05423]' : ''}`}
              >
                {tab.icon}
              </span>

              {/* Dynamic Call-to-Action Beacon Dot */}
              {showAnimation && (
                <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F05423] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-tr from-[#F05423] to-amber-400 shadow-sm shadow-[#F05423]/50"></span>
                </span>
              )}

              {/* Unread Message Badge Indicator */}
              {isMessagesTab && unreadChatCount > 0 && !isActive && (
                <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-[#F05423] text-white text-[9px] font-mono font-bold leading-none shadow-sm">
                  {unreadChatCount}
                </span>
              )}
            </span>

            <span className="text-[9.5px] tracking-tight flex items-center gap-1">
              <span>{tab.label}</span>
              {showAnimation && !isActive && (
                <span className="text-[9px] font-mono text-[#F05423] font-bold">
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
