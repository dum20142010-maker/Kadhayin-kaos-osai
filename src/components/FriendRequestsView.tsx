import React, { useState, useEffect } from 'react';
import { FriendUser, FriendRequest } from '../types';
import { mockSuggestedFriends, mockFriendRequests } from '../data/mockData';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FriendRequestsViewProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenChatWithUser: (user: FriendUser) => void;
  onNavigateToProfile?: () => void;
}

export const FriendRequestsView: React.FC<FriendRequestsViewProps> = ({
  onShowToast,
  onOpenChatWithUser,
  onNavigateToProfile,
}) => {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'suggested'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState<FriendRequest[]>(mockFriendRequests);
  const [suggested, setSuggested] = useState<FriendUser[]>(mockSuggestedFriends);
  
  // Current user's availability status state (synced with Firestore)
  const [myAvailabilityStatus, setMyAvailabilityStatus] = useState<'Available Now' | 'Away'>(
    (userProfile?.availabilityStatus as 'Available Now' | 'Away') || 'Available Now'
  );

  // Reciprocal Activity Privacy: If user turns off their status, friends can't see them, and they can't see friends
  const [myActivityStatusEnabled, setMyActivityStatusEnabled] = useState(true);

  // Filter mode for Friends list: 'all' vs 'online'
  const [friendsFilter, setFriendsFilter] = useState<'all' | 'online'>('all');

  // Fetch current user status from Firestore on mount
  useEffect(() => {
    if (!user) return;
    const loadMyStatus = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.availabilityStatus) {
            setMyAvailabilityStatus(data.availabilityStatus as 'Available Now' | 'Away');
          }
        }
      } catch (err) {
        console.warn('Could not read user status from Firestore:', err);
      }
    };
    loadMyStatus();
  }, [user]);

  // Connected friends list
  const [friendsList, setFriendsList] = useState<FriendUser[]>([
    {
      id: 'f-1',
      name: 'Ananya S.',
      username: 'ananya_walks',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      bio: 'Squad Captain • Mapping George Town mercantile lanes & bell towers.',
      streak: 19,
      isFollowing: true,
      hasRequested: false,
      mutualFriendsCount: 12,
      isOnline: true,
      availabilityStatus: 'Available Now',
      lastSeen: 'Active now',
      showActivityStatus: true,
      privacySetting: 'everyone',
      locationZone: 'George Town',
    },
    {
      id: 'f-2',
      name: 'Karthik R.',
      username: 'karthik_mylapore',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      bio: 'Lore Scout • 1924 filter coffee roasts & sacred Dravidian gopurams.',
      streak: 21,
      isFollowing: true,
      hasRequested: false,
      mutualFriendsCount: 15,
      isOnline: true,
      availabilityStatus: 'Available Now',
      lastSeen: 'Active now',
      showActivityStatus: true,
      privacySetting: 'friends_only',
      locationZone: 'Mylapore',
    },
    {
      id: 'f-3',
      name: 'Meera Iyer',
      username: 'meera_chepauk',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      bio: 'Chepauk Byzantine vaults researcher • Night walker.',
      streak: 24,
      isFollowing: true,
      hasRequested: false,
      mutualFriendsCount: 8,
      isOnline: false,
      availabilityStatus: 'Away',
      lastSeen: 'Active 14m ago',
      showActivityStatus: true,
      privacySetting: 'friends_only',
      locationZone: 'Chepauk',
    },
    {
      id: 'f-4',
      name: 'David H.',
      username: 'david_fort',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      bio: 'Fort St. George 1644 bastions chronicler.',
      streak: 6,
      isFollowing: true,
      hasRequested: false,
      mutualFriendsCount: 3,
      isOnline: false,
      availabilityStatus: 'Away',
      lastSeen: 'Active 2h ago',
      showActivityStatus: false, // Privacy mode active
      privacySetting: 'nobody',
      locationZone: 'Fort St. George',
    }
  ]);

  const handleAcceptRequest = (req: FriendRequest) => {
    triggerHaptic('medium');
    setRequests(prev => prev.filter(r => r.id !== req.id));
    const newFriend: FriendUser = {
      ...req.fromUser,
      isFollowing: true,
      isOnline: req.fromUser.isOnline ?? true,
      availabilityStatus: req.fromUser.availabilityStatus || 'Available Now',
      lastSeen: req.fromUser.lastSeen ?? 'Active now',
      showActivityStatus: req.fromUser.showActivityStatus ?? true,
    };
    setFriendsList(prev => [newFriend, ...prev]);
    onShowToast(`Accepted friend request from @${req.fromUser.username}! 🎉`, 'person_add');
  };

  const handleDeclineRequest = (reqId: string, username: string) => {
    triggerHaptic('light');
    setRequests(prev => prev.filter(r => r.id !== reqId));
    onShowToast(`Removed request from @${username}`, 'close');
  };

  const handleToggleFollowSuggested = (targetUser: FriendUser) => {
    triggerHaptic('light');
    setSuggested(prev =>
      prev.map(s => {
        if (s.id === targetUser.id) {
          const nextState = !s.hasRequested;
          onShowToast(
            nextState ? `Friend request sent to @${s.username}! 📩` : `Cancelled request to @${s.username}`,
            nextState ? 'send' : 'undo'
          );
          return { ...s, hasRequested: nextState };
        }
        return s;
      })
    );
  };

  const toggleMyActivityStatus = () => {
    const next = !myActivityStatusEnabled;
    setMyActivityStatusEnabled(next);
    triggerHaptic('medium');
    onShowToast(
      next
        ? 'Activity Status enabled (Friends can see when you are active)'
        : 'Activity Status hidden (Private mode active)',
      next ? 'visibility' : 'visibility_off'
    );
  };

  // Filter friends based on search and online status
  const filteredFriends = friendsList.filter(f => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.locationZone && f.locationZone.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (friendsFilter === 'online') {
      return (
        myActivityStatusEnabled &&
        f.showActivityStatus !== false &&
        (f.availabilityStatus === 'Available Now' || f.isOnline)
      );
    }
    return true;
  });

  const onlineFriendsCount = friendsList.filter(
    f => (f.availabilityStatus === 'Available Now' || f.isOnline) && f.showActivityStatus !== false
  ).length;

  const filteredSuggested = suggested.filter(s =>
    searchQuery.trim() === ''
      ? true
      : s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search Bar (Instagram Explorer Search) */}
      <div className="relative">
        <div className="bg-[#18181c] rounded-2xl border border-[#26262b] flex items-center px-3.5 shadow-sm focus-within:border-orange-500">
          <span className="material-symbols-outlined text-[#9898a0] text-[20px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @username, or district..."
            className="w-full bg-transparent text-white placeholder:text-[#9898a0] text-xs px-3 py-3 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="w-6 h-6 rounded-full bg-[#26262b] flex items-center justify-center text-[#9898a0] hover:text-white"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Segmented Tabs: Friends List / Friend Requests / Discover */}
      <div className="flex bg-[#18181c] p-1 rounded-2xl border border-[#26262b]">
        <button
          onClick={() => {
            setActiveTab('friends');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'friends'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          <span>Friends ({friendsList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('requests');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
            activeTab === 'requests'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          <span>Requests</span>
          {requests.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
              {requests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('suggested');
            triggerHaptic('light');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'suggested'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-[#9898a0] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">explore</span>
          <span>Suggested</span>
        </button>
      </div>

      {/* TAB 1: FRIENDS LIST WITH LAST SEEN / AVAILABLE NOW & PRIVACY CONTROLS */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {/* Current User Availability Status Banner */}
          <div className="p-3.5 rounded-2xl bg-[#1a1a1e] border border-orange-500/30 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 font-bold flex items-center justify-center border border-orange-500/40">
                  {user?.displayName?.[0] || 'U'}
                </div>
                {/* Green or Grey dot next to current user avatar */}
                <span
                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#1a1a1e] ${
                    myAvailabilityStatus === 'Available Now'
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]'
                      : 'bg-zinc-500'
                  }`}
                  title={`Your Status: ${myAvailabilityStatus}`}
                ></span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Your Presence:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      myAvailabilityStatus === 'Available Now'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        myAvailabilityStatus === 'Available Now'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-zinc-500'
                      }`}
                    ></span>
                    <span>{myAvailabilityStatus}</span>
                  </span>
                </div>
                <p className="text-[10px] text-[#9898a0] mt-0.5">
                  {myAvailabilityStatus === 'Available Now'
                    ? 'Friends see a green dot next to your name'
                    : 'Friends see a grey dot next to your name'}
                </p>
              </div>
            </div>

            {onNavigateToProfile && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  onNavigateToProfile();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-orange-400 text-xs font-semibold border border-orange-500/20 flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>Change in Profile</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            )}
          </div>

          {/* Instagram-Style Privacy Control Banner */}
          <div className="p-3.5 rounded-2xl bg-[#18181c] border border-[#26262b] flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  myActivityStatusEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {myActivityStatusEnabled ? 'wifi_tethering' : 'visibility_off'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Show Activity Status</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#121214] text-[9px] font-mono text-[#9898a0] border border-[#26262b]">
                    Privacy
                  </span>
                </div>
                <p className="text-[10px] text-[#9898a0]">
                  {myActivityStatusEnabled
                    ? 'Friends see when you are online or your last active time'
                    : 'Activity hidden. You also cannot see friends’ online status'}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={toggleMyActivityStatus}
              aria-label="Toggle Activity Status"
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                myActivityStatusEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  myActivityStatusEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></div>
            </button>
          </div>

          {/* Quick Filter: All vs Online Now */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFriendsFilter('all');
                  triggerHaptic('light');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  friendsFilter === 'all'
                    ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                    : 'bg-[#18181c] text-[#9898a0] border-[#26262b] hover:text-white'
                }`}
              >
                All Friends ({friendsList.length})
              </button>

              <button
                onClick={() => {
                  setFriendsFilter('online');
                  triggerHaptic('light');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                  friendsFilter === 'online'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-[#18181c] text-[#9898a0] border-[#26262b] hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Available Now ({onlineFriendsCount})</span>
              </button>
            </div>

            <span className="text-[10px] text-[#9898a0] font-mono">
              Strictly Connected Friends
            </span>
          </div>

          {/* Friends Cards Grid */}
          <div className="space-y-2.5">
            {filteredFriends.length === 0 ? (
              <div className="p-8 text-center bg-[#18181c] rounded-2xl border border-[#26262b] space-y-2">
                <span className="material-symbols-outlined text-[#9898a0] text-3xl">person_off</span>
                <p className="text-xs text-[#9898a0]">
                  {friendsFilter === 'online'
                    ? 'No friends currently online or sharing activity status.'
                    : 'No friends matching your search.'}
                </p>
              </div>
            ) : (
              filteredFriends.map((friend) => {
                // Determine whether activity status can be displayed:
                const canShowStatus = myActivityStatusEnabled && friend.showActivityStatus !== false;
                const isAvailableNow =
                  canShowStatus && (friend.availabilityStatus === 'Available Now' || friend.isOnline);
                const statusLabel = !myActivityStatusEnabled
                  ? 'Activity hidden (Turn on your status to view)'
                  : friend.showActivityStatus === false
                  ? 'Activity status hidden'
                  : isAvailableNow
                  ? 'Available Now'
                  : friend.lastSeen || 'Away';

                return (
                  <div
                    key={friend.id}
                    className="p-3.5 rounded-2xl bg-[#18181c] border border-[#26262b] hover:border-orange-500/40 transition-all flex items-center justify-between gap-3 shadow-sm group"
                  >
                    {/* Left: Avatar with dynamic online presence dot & metadata */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-[#26262b]"
                        />

                        {/* Real-time Online / Offline Indicator Badge on Avatar */}
                        {canShowStatus && (
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#18181c] ${
                              isAvailableNow
                                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                                : 'bg-zinc-500'
                            }`}
                            title={isAvailableNow ? 'Available Now' : 'Away'}
                          ></span>
                        )}
                      </div>

                      <div className="min-w-0">
                        {/* Name with Green or Grey Dot */}
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">{friend.name}</h4>

                          {/* Green or Grey dot next to friend's name */}
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isAvailableNow
                                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                                : 'bg-zinc-500'
                            }`}
                            title={isAvailableNow ? 'Available Now (Green Dot)' : 'Away (Grey Dot)'}
                          ></span>

                          <span className="text-[10px] text-[#9898a0]">@{friend.username}</span>
                        </div>

                        {/* 'Last Seen' or 'Available Now' Status Line */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isAvailableNow ? (
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Available Now</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#9898a0] flex items-center gap-1 truncate">
                              {!canShowStatus ? (
                                <span className="material-symbols-outlined text-[12px] text-zinc-500">
                                  visibility_off
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-[12px] text-zinc-400">
                                  bedtime
                                </span>
                              )}
                              <span>{statusLabel}</span>
                            </span>
                          )}

                          {friend.locationZone && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="text-[10px] text-orange-400/90 font-medium truncate">
                                {friend.locationZone}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-[10px] text-[#9898a0] line-clamp-1 mt-0.5">{friend.bio}</p>
                      </div>
                    </div>

                    {/* Right Action: Direct Instagram DM Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          onOpenChatWithUser(friend);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
                      >
                        <span className="material-symbols-outlined text-[14px]">send</span>
                        <span>Message</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING FRIEND REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#9898a0] px-1">
            <span>Incoming Friend Requests</span>
            <span className="font-mono">{requests.length} Pending</span>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 text-center bg-[#18181c] rounded-2xl border border-[#26262b] space-y-2">
              <span className="material-symbols-outlined text-[#9898a0] text-3xl">mark_email_read</span>
              <p className="text-xs text-[#9898a0]">
                No pending friend requests. Check Suggested to connect with more explorers!
              </p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b] space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={req.fromUser.avatar}
                      alt={req.fromUser.name}
                      className="w-12 h-12 rounded-2xl object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white">{req.fromUser.name}</h4>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            req.fromUser.availabilityStatus === 'Available Now' || req.fromUser.isOnline
                              ? 'bg-emerald-400'
                              : 'bg-zinc-500'
                          }`}
                        ></span>
                        <span className="text-[10px] text-[#9898a0]">@{req.fromUser.username}</span>
                      </div>
                      <p className="text-[10px] text-[#9898a0] line-clamp-1">{req.fromUser.bio}</p>
                      <span className="text-[9px] text-orange-400/90 font-medium">
                        {req.fromUser.mutualFriendsCount} mutual explorer friends • {req.timestamp}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAcceptRequest(req)}
                    className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Confirm</span>
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(req.id, req.fromUser.username)}
                    className="flex-1 py-2.5 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-[#9898a0] hover:text-white font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: SUGGESTED EXPLORERS */}
      {activeTab === 'suggested' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#9898a0] px-1">
            <span>Suggested for you in Chennai</span>
            <span className="text-orange-400 font-bold">Discover</span>
          </div>

          <div className="space-y-2.5">
            {filteredSuggested.map((sug) => (
              <div
                key={sug.id}
                className="p-3.5 rounded-2xl bg-[#18181c] border border-[#26262b] flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={sug.avatar}
                    alt={sug.name}
                    className="w-11 h-11 rounded-2xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate">{sug.name}</h4>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          sug.availabilityStatus === 'Available Now' || sug.isOnline
                            ? 'bg-emerald-400'
                            : 'bg-zinc-500'
                        }`}
                      ></span>
                      <span className="text-[10px] text-[#9898a0]">@{sug.username}</span>
                    </div>
                    <p className="text-[10px] text-[#9898a0] truncate">{sug.bio}</p>
                    <span className="text-[9px] text-orange-400 font-medium">
                      {sug.mutualFriendsCount} mutual friends • {sug.locationZone}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleFollowSuggested(sug)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1 active:scale-95 ${
                    sug.hasRequested
                      ? 'bg-[#26262b] text-[#9898a0] border border-[#32323a]'
                      : 'bg-orange-600 hover:bg-orange-500 text-white shadow'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {sug.hasRequested ? 'hourglass_top' : 'person_add'}
                  </span>
                  <span>{sug.hasRequested ? 'Requested' : 'Add Friend'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
