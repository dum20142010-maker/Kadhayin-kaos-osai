import React, { useState, useEffect } from 'react';
import { TabType } from './BottomBar';
import { sqlDb, SqlSyncInfo } from '../lib/sqlDatabase';
import { useDailyQuestNotification } from '../hooks/useDailyQuestNotification';

interface HeaderProps {
  currentTab: TabType;
  onTabSelected: (tab: TabType) => void;
  level: number;
  streak: number;
  onOpenSqlExplorer?: () => void;
  onOpenCommandPalette?: () => void;
  unreadChatCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabSelected,
  level,
  streak,
  onOpenSqlExplorer,
  onOpenCommandPalette,
  unreadChatCount = 0,
}) => {
  const { hasNewQuests } = useDailyQuestNotification(currentTab);
  const [syncInfo, setSyncInfo] = useState<SqlSyncInfo>(() => sqlDb.getSyncInfo());

  useEffect(() => {
    // Subscribe to live SQL local storage persistence events
    const unsubscribe = sqlDb.subscribeSync((info) => {
      setSyncInfo(info);
    });
    return () => unsubscribe();
  }, []);

  const navLinks = [
    { key: 'explore' as TabType, label: 'Explore' },
    { key: 'map' as TabType, label: 'AR Radar' },
    { key: 'assistant' as TabType, label: 'KAOS Bot' },
    { key: 'messages' as TabType, label: 'Messages' },
    { key: 'social' as TabType, label: 'Social' },
    { key: 'profile' as TabType, label: 'Passport' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#121114]/90 backdrop-blur-xl border-b border-[#26242C] px-4 md:px-8 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Zone 1: Single Wordmark Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTabSelected('explore')}
            className="text-left flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F05423] to-[#FF8A00] flex items-center justify-center shadow-md shadow-[#F05423]/25">
              <span className="font-extrabold text-white text-base tracking-wider">K</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">KAOS</span>
          </button>
        </div>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          {navLinks.map((link) => {
            const isActive = currentTab === link.key;
            const isExplore = link.key === 'explore';
            const isMessages = link.key === 'messages';

            return (
              <button
                key={link.key}
                onClick={() => onTabSelected(link.key)}
                className={`py-1 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'text-[#F05423] font-bold border-b-2 border-[#F05423]'
                    : 'hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {isExplore && hasNewQuests && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F05423] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-tr from-[#F05423] to-amber-400"></span>
                  </span>
                )}
                {isMessages && unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#F05423] text-white text-[9px] font-mono font-bold">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Command Palette Trigger (Cmd+K) */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18161D] hover:bg-[#24212c] border border-[#26242C] hover:border-[#F05423]/50 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm group"
              title="Search landmarks, zones, quests, and secret perks (⌘K)"
            >
              <span className="material-symbols-outlined text-[16px] text-zinc-400 group-hover:text-[#F05423] transition-colors">
                search
              </span>
              <span className="text-xs hidden md:inline">Quick Finder</span>
              <kbd className="hidden lg:inline text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#121114] border border-[#26242C] text-zinc-500 group-hover:text-zinc-300">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Pure Offline Safe & Sync Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18161D] border border-[#26242C] shadow-sm select-none"
            title="Your progress, stamps, and custom trails are synchronized and saved offline on your device"
          >
            <div className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
              {syncInfo.state === 'syncing' ? (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#F05423] border-t-transparent animate-spin" />
              ) : syncInfo.state === 'error' ? (
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm" />
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono leading-none">
              <span className="font-bold text-zinc-400">Vault</span>
              <span className="text-zinc-600 hidden sm:inline">:</span>
              <span
                className={`text-[10px] uppercase font-semibold hidden sm:inline tracking-wider ${
                  syncInfo.state === 'synced'
                    ? 'text-emerald-400'
                    : syncInfo.state === 'syncing'
                    ? 'text-cyan-300 animate-pulse'
                    : 'text-rose-400'
                }`}
              >
                {syncInfo.state === 'synced' ? 'Ready' : syncInfo.state === 'syncing' ? 'Saving' : 'Offline'}
              </span>
            </div>

            <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-semibold leading-none">
              OFFLINE
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 pl-1">
            <span className="flex items-center gap-1 text-amber-400">
              <span>🔥</span>
              <span className="tabular-nums font-semibold">{streak}d</span>
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300">
              Lvl <span className="tabular-nums font-bold text-[#F05423]">{level}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
