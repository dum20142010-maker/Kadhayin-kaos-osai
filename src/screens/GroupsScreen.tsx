import React, { useState, useEffect } from 'react';
import { mockSquad, mockActivityFeed, mockChatThreads } from '../data/mockData';
import { ActivityFeedItem, ChatThread, FriendUser, TabType } from '../types';
import { triggerHaptic } from '../lib/haptic';
import { GoogleGenAI } from '@google/genai';
import { InstagramChatView } from '../components/InstagramChatView';
import { FriendRequestsView } from '../components/FriendRequestsView';

interface GroupsScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onUnreadCountChange?: (count: number) => void;
  onNavigateTab?: (tab: TabType) => void;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({
  onShowToast,
  onUnreadCountChange,
  onNavigateTab,
}) => {
  const [squad] = useState(mockSquad);
  const [feed, setFeed] = useState<ActivityFeedItem[]>(mockActivityFeed);
  const [activeSubTab, setActiveSubTab] = useState<'messages' | 'friends' | 'feed' | 'squad'>('messages');
  
  // Instagram Chat Threads state
  const [threads, setThreads] = useState<ChatThread[]>(mockChatThreads);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [chatSearch, setChatSearch] = useState('');

  // Squad P2P live pings
  const [squadPings, setSquadPings] = useState<string[]>([
    'Ananya S.: Just reached Armenian Church belfry, waiting for the 9 AM bell chime! 🔔',
    'Karthik R.: Found the 1924 roasting drum in Triplicane. Scent is incredible. ☕',
  ]);
  const [pingInput, setPingInput] = useState('');

  // Calculate total unread messages count across all direct threads
  const totalUnread = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

  // Sync unread badge count with App level navigation bar
  useEffect(() => {
    onUnreadCountChange?.(totalUnread);
  }, [totalUnread, onUnreadCountChange]);

  // Real-time simulated message listener (Instagram activity alert experience)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Simulate an incoming DM from a friend after 6 seconds if not chatting with them
      const incomingSender = threads.find(t => t.id === 'thread-1');
      if (incomingSender && selectedThread?.id !== 'thread-1') {
        const newMsg = {
          id: `msg-live-${Date.now()}`,
          senderId: 'usr-ananya',
          senderName: 'Ananya S.',
          text: 'Found a 1910 Madras survey map near Parry’s Corner! Want to check it out? 🗺️✨',
          timestamp: 'Just now',
          isMe: false,
        };

        setThreads(prev =>
          prev.map(t =>
            t.id === 'thread-1'
              ? {
                  ...t,
                  unreadCount: t.unreadCount + 1,
                  lastMessageText: newMsg.text,
                  lastMessageTime: 'Just now',
                  messages: [...t.messages, newMsg],
                }
              : t
          )
        );

        onShowToast('New message from @ananya_walks 💬', 'chat');
        triggerHaptic([30, 60, 90]);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const [isAiReplyingToPing, setIsAiReplyingToPing] = useState(false);

  const handleSendPing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pingInput.trim() || isAiReplyingToPing) return;

    const userPing = pingInput.trim();
    triggerHaptic('light');
    setSquadPings(prev => [...prev, `You: ${userPing}`]);
    setPingInput('');
    onShowToast('Squad Ping Broadcasted to Live Walkers! 📡', 'cell_tower');

    // Trigger Maya AI Lore Scout response if /ai is used or mentioned
    if (userPing.toLowerCase().includes('/ai') || userPing.toLowerCase().includes('maya')) {
      setIsAiReplyingToPing(true);
      try {
        const ai = new GoogleGenAI();
        const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: `You are Maya, the Squad Lore Scout for DÌ DiscoverIt. 
You are responding to a message in the live Squad Walking Radio for Chennai explorers.
User message: "${userPing}"

Rules:
1. Be charismatic, sharp, and culturally rich.
2. Share a quick Madras secret or heritage tip related to their message.
3. Keep it very brief (1-2 sentences) as it's a radio ping.
4. Use 1 relevant emoji.`
        });

        const reply = response.text || "Maya here! Keep your eyes on the horizon, the heritage trail holds many secrets. 🧭";
        setTimeout(() => {
          setSquadPings(prev => [...prev, `Maya (Lore Scout): ${reply}`]);
          setIsAiReplyingToPing(false);
          triggerHaptic('medium');
        }, 1200);
      } catch {
        setIsAiReplyingToPing(false);
        setSquadPings(prev => [...prev, "Maya (Lore Scout): My signal is fuzzy, but the trail is clear! 📡"]);
      }
    }
  };

  const handleOpenChatWithUser = (user: FriendUser) => {
    // Check if an existing thread exists
    const existing = threads.find(t => t.username === user.username);
    if (existing) {
      setSelectedThread(existing);
    } else {
      // Create new direct thread
      const newThread: ChatThread = {
        id: `thread-${user.id}`,
        type: 'direct',
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen || 'Active now',
        showActivityStatus: user.showActivityStatus !== false,
        unreadCount: 0,
        lastMessageText: 'Started a new chat',
        lastMessageTime: 'Just now',
        messages: [
          {
            id: `msg-init-${Date.now()}`,
            senderId: user.id,
            senderName: user.name,
            text: `Hey! Excited to explore Chennai heritage trails with you! 👋✨`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe: false,
          }
        ]
      };
      setThreads([newThread, ...threads]);
      setSelectedThread(newThread);
    }
  };

  const handleSelectThread = (thread: ChatThread) => {
    triggerHaptic('light');
    // Clear unread count when opening thread (mimicking Instagram DM read receipt)
    const updated = threads.map(t => (t.id === thread.id ? { ...t, unreadCount: 0 } : t));
    setThreads(updated);
    setSelectedThread({ ...thread, unreadCount: 0 });
  };

  const handleToggleLike = (item: ActivityFeedItem) => {
    triggerHaptic('light');
    setFeed(prev =>
      prev.map(f => {
        if (f.id === item.id) {
          const nextLiked = !f.hasLiked;
          const nextCount = nextLiked ? f.likesCount + 1 : f.likesCount - 1;
          onShowToast(
            nextLiked ? `Sent Filter Coffee Cheers to ${f.explorerName}! ☕` : 'Cheers removed',
            nextLiked ? 'local_cafe' : 'favorite_border'
          );
          return { ...f, hasLiked: nextLiked, likesCount: nextCount };
        }
        return f;
      })
    );
  };

  // If a chat thread is selected, render the full-screen Instagram DM interface
  if (selectedThread) {
    return (
      <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-2">
        <InstagramChatView
          thread={selectedThread}
          onBack={() => {
            setSelectedThread(null);
            triggerHaptic('light');
          }}
          onShowToast={onShowToast}
          onUpdateThreadMessages={(updatedMessages) => {
            setThreads(prev =>
              prev.map(t =>
                t.id === selectedThread.id
                  ? {
                      ...t,
                      messages: updatedMessages,
                      lastMessageText: updatedMessages[updatedMessages.length - 1]?.text || '',
                      lastMessageTime: 'Just now',
                    }
                  : t
              )
            );
          }}
        />
      </div>
    );
  }

  const filteredThreads = threads.filter(t =>
    chatSearch.trim() === ''
      ? true
      : t.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
        t.username.toLowerCase().includes(chatSearch.toLowerCase()) ||
        t.lastMessageText.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-24 max-w-4xl mx-auto px-4 space-y-4">
      {/* Header */}
      <div className="pt-4 pb-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="material-symbols-outlined text-[16px] text-orange-400" style={{ fontVariationSettings: "'FILL' 1" }}>
            chat_bubble
          </span>
          <span className="text-xs text-orange-400 uppercase tracking-widest font-bold">Explorer Social Hub</span>
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-headline text-3xl text-white">Squad & Chat</h1>
          <span className="text-xs text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            {squad.xpMultiplier}
          </span>
        </div>
      </div>

      {/* Segmented Top Tabs: DMs / Friends / Activity Feed / Squad Room */}
      <div className="flex bg-[#18181c] p-1 rounded-2xl border border-[#26262b] overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            setActiveSubTab('messages');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap relative ${
            activeSubTab === 'messages'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">mail</span>
          <span>DMs</span>
          {totalUnread > 0 && (
            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveSubTab('friends');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'friends'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">person_add</span>
          <span>Friends & Requests</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('feed');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'feed'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">dynamic_feed</span>
          <span>Activity Feed</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('squad');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'squad'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">hiking</span>
          <span>Squad Room</span>
        </button>
      </div>

      {/* SUB-TAB 1: INSTAGRAM-STYLE DIRECT MESSAGES LIST */}
      {activeSubTab === 'messages' && (
        <div className="space-y-3">
          {/* DM Search Bar */}
          <div className="relative">
            <div className="bg-[#18181c] rounded-2xl border border-[#26262b] flex items-center px-3.5 shadow-sm focus-within:border-orange-500">
              <span className="material-symbols-outlined text-[#9898a0] text-[18px]">search</span>
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search direct messages..."
                className="w-full bg-transparent text-white placeholder:text-[#9898a0] text-xs px-2.5 py-2.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Active Online Friends Story Bubble Row */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 border-b border-[#26262b]">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectThread(t)}
                className="flex flex-col items-center shrink-0 group focus:outline-none"
              >
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-500">
                  <div className="p-0.5 rounded-full bg-[#121214]">
                    <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                  </div>
                  {t.isOnline && (
                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#121214] shadow-sm"></span>
                  )}
                </div>
                <span className="text-[10px] text-[#9898a0] group-hover:text-white font-medium mt-1 truncate w-14 text-center">
                  {t.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Messages List Threads */}
          <div className="space-y-1.5">
            {filteredThreads.map((thread) => {
              const isUnread = thread.unreadCount > 0;

              return (
                <div
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isUnread
                      ? 'bg-[#221a16] border-orange-500/40 shadow-sm'
                      : 'bg-[#18181c] border-[#26262b] hover:border-orange-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={thread.avatar}
                        alt={thread.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-[#26262b]"
                      />
                      {thread.isOnline && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#18181c]"></span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-semibold text-white'}`}>
                          {thread.name}
                        </h4>
                        {thread.verifiedBadge && (
                          <span className="material-symbols-outlined text-[14px] text-sky-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                            verified
                          </span>
                        )}
                        <span className="text-[10px] text-[#9898a0]">@{thread.username}</span>
                      </div>

                      <p className={`text-[11px] truncate mt-0.5 ${isUnread ? 'font-bold text-white' : 'text-[#9898a0]'}`}>
                        {thread.lastMessageText}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[10px] ${isUnread ? 'text-orange-400 font-bold' : 'text-[#9898a0]'}`}>
                      {thread.lastMessageTime}
                    </span>
                    {isUnread && (
                      <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FRIENDS & FRIEND REQUESTS */}
      {activeSubTab === 'friends' && (
        <FriendRequestsView
          onOpenChatWithUser={handleOpenChatWithUser}
          onShowToast={onShowToast}
          onNavigateToProfile={() => onNavigateTab?.('me-profile')}
        />
      )}

      {/* SUB-TAB 3: DISCOVERY ACTIVITY FEED (Strava-Style Explorer Timeline) */}
      {activeSubTab === 'feed' && (
        <div className="space-y-4">
          {feed.map((act) => (
            <div
              key={act.id}
              className="bg-[#18181c] rounded-2xl p-5 border border-[#26262b] shadow-sm space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={act.explorerAvatar} alt={act.explorerName} className="w-10 h-10 rounded-xl object-cover" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{act.explorerName}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono font-bold">
                        +{act.stats.xpGained} XP
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9898a0]">
                      {act.actionType === 'scanned_gem' ? 'Scanned Landmark' : act.actionType === 'claimed_perk' ? 'Redeemed Secret Pass' : 'Completed Quest'} • {act.timestamp}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                  {act.zone}
                </span>
              </div>

              {act.photoUrl && (
                <div className="rounded-xl overflow-hidden h-44 border border-[#26262b]">
                  <img src={act.photoUrl} alt={act.locationName} className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <h4 className="font-headline text-base text-white font-bold">{act.locationName}</h4>
                {act.note && <p className="text-xs text-[#9898a0] mt-1 leading-relaxed">"{act.note}"</p>}
              </div>

              {/* Step & Distance Stats */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#121214] border border-[#26262b] text-center">
                <div>
                  <span className="text-[9px] text-[#9898a0] uppercase block">Steps</span>
                  <span className="font-mono text-xs font-bold text-white">{act.stats.steps.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#9898a0] uppercase block">Distance</span>
                  <span className="font-mono text-xs font-bold text-orange-400">{act.stats.distanceKm} km</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#9898a0] uppercase block">XP Earned</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">+{act.stats.xpGained}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#26262b] flex items-center justify-between">
                <button
                  onClick={() => handleToggleLike(act)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    act.hasLiked
                      ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                      : 'bg-[#121214] text-[#9898a0] hover:text-white border border-[#26262b]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: act.hasLiked ? "'FILL' 1" : "'FILL' 0" }}>
                    local_cafe
                  </span>
                  <span>{act.hasLiked ? 'Filter Coffee Cheers!' : 'Give Filter Coffee Cheers'}</span>
                  <span className="font-mono ml-1">({act.likesCount})</span>
                </button>

                <button
                  onClick={() => {
                    onShowToast(`Shared ${act.explorerName}’s walk! 📤`, 'share');
                    triggerHaptic('light');
                  }}
                  className="text-[#9898a0] hover:text-white text-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                  <span>Share</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 4: MULTIPLAYER SQUAD ROOM */}
      {activeSubTab === 'squad' && (
        <div className="space-y-4">
          <section className="bg-gradient-to-br from-[#18181c] to-[#241c16] rounded-2xl p-5 border border-orange-500/40 shadow-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Active Collective Expedition</span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold">
                    🔥 {squad.squadStreak} Day Squad Streak
                  </span>
                </div>
                <h3 className="font-headline text-xl text-white font-bold">{squad.name}</h3>
                <p className="text-xs text-[#9898a0] mt-0.5">{squad.motto}</p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-[#9898a0] uppercase block">Squad Multiplier</span>
                <span className="font-headline text-lg font-bold text-orange-400">+25% XP</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121214] border border-[#26262b] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-400 text-[16px]">flag</span>
                  <span>{squad.activeRaidTitle}</span>
                </span>
                <span className="font-mono text-orange-400 font-bold">{squad.raidProgressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#26262b] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${squad.raidProgressPct}%` }}
                ></div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-headline text-lg text-white font-bold">Squad Roster ({squad.members.length} Explorers)</h4>
              <button
                onClick={() => {
                  setActiveSubTab('friends');
                  triggerHaptic('light');
                }}
                className="text-xs font-bold text-orange-400 hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">person_add</span>
                <span>Invite Friends</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {squad.members.map((member) => (
                <div
                  key={member.id}
                  className="p-3.5 rounded-2xl bg-[#18181c] border border-[#26262b] flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src={member.avatar} alt={member.name} className="w-11 h-11 rounded-xl object-cover" />
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#18181c] ${
                          member.status === 'walking'
                            ? 'bg-emerald-400 animate-pulse'
                            : member.status === 'online'
                            ? 'bg-teal-400'
                            : 'bg-zinc-500'
                        }`}
                      ></span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{member.name}</span>
                        <span className="text-[10px] text-orange-400 font-semibold font-mono">+{member.xpContributed} XP</span>
                      </div>
                      <span className="text-[11px] text-[#9898a0] block">{member.role} • {member.distanceAway}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onShowToast(`Pinging ${member.name} on the map... 📍`, 'near_me');
                      triggerHaptic('light');
                    }}
                    className="w-8 h-8 rounded-xl bg-[#121214] text-orange-400 hover:bg-[#26262b] flex items-center justify-center border border-[#26262b]"
                  >
                    <span className="material-symbols-outlined text-[16px]">near_me</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#18181c] rounded-2xl p-4 border border-[#26262b] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-orange-400 text-[16px]">sensors</span>
                <span>Live Squad Walking Radio</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Encrypted • P2P</span>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1 text-xs">
              {squadPings.map((ping, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b] text-[#9898a0]">
                  {ping}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendPing} className="flex gap-2">
              <input
                type="text"
                value={pingInput}
                onChange={(e) => setPingInput(e.target.value)}
                placeholder="Broadcast a waypoint clue or landmark..."
                className="flex-1 bg-[#121214] text-white p-2.5 rounded-xl border border-[#26262b] text-xs focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
