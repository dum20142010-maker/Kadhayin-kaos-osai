import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MasterSpot } from '../types';

// ==========================================================================
// CENTRAL CONTROLLED CHAOS COHERENT SCHEMAS & TOKENS
// ==========================================================================

interface SocialUser {
  id: string;
  displayName: string;
  handle: string;
  avatar: string;
  level: number;
  xp: number;
  badge: string;
  bio: string;
  questsCompleted: number;
  isOnline: boolean;
  role: 'Admin' | 'Member';
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'read' | 'failed';
  attachedSpot?: MasterSpot;
  attachedLocation?: string;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  type: 'direct' | 'group';
  lastMessageText: string;
  lastMessageTime: string;
  unreadCount: number;
  memberIds: string[];
  groupQuestProgress?: number; // 0 - 100
  groupQuestName?: string;
  admins?: string[];
  groupColor?: string; // Group-specific accent color
}

interface FriendRequest {
  id: string;
  sender: SocialUser;
}

interface SocialNotification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'message' | 'group_invitation' | 'group_activity' | 'achievement';
  title: string;
  text: string;
  time: string;
  colorClass: string; // Pink, Lime, Teal, Purple, etc.
}

export interface MessagesScreenProps {
  onShowToast: (msg: string) => void;
  onSelectSpot?: (spot: MasterSpot) => void;
  onSelectQuest?: (quest: any) => void;
  onNavigateToMap?: () => void;
  initialConversationId?: string | null;
  masterSpots?: MasterSpot[];
}

// Global seed of available explorers
const INITIAL_EXPLORERS: SocialUser[] = [
  {
    id: 'user_alex',
    displayName: 'Alex Morgan',
    handle: 'alex_explorer',
    avatar: '🧭',
    level: 14,
    xp: 4200,
    badge: 'Senior Cartographer',
    bio: 'Surveying colonial 1920s buildings and coastal filter coffee trails.',
    questsCompleted: 24,
    isOnline: true,
    role: 'Member',
  },
  {
    id: 'user_priya',
    displayName: 'Priya Sundaram',
    handle: 'priya_madrasi',
    avatar: '🏛️',
    level: 18,
    xp: 5800,
    badge: 'Sacred Tank Specialist',
    bio: 'Exploring acoustic reflections across ancient gopurams and temple stepwells.',
    questsCompleted: 38,
    isOnline: true,
    role: 'Admin',
  },
  {
    id: 'user_sam',
    displayName: 'Sam Ramachandran',
    handle: 'sam_peaberry',
    avatar: '☕',
    level: 9,
    xp: 2600,
    badge: 'Filter Coffee Master',
    bio: 'Tracking down ancestral coffee houses and old peaberry recipes.',
    questsCompleted: 15,
    isOnline: false,
    role: 'Member',
  },
  {
    id: 'user_kavi',
    displayName: 'Kavitha Vasudev',
    handle: 'kavi_sounds',
    avatar: '🎹',
    level: 12,
    xp: 3500,
    badge: 'Sound Mapper',
    bio: 'Documenting the acoustic footprints of Chennai bazaar lanes at dawn.',
    questsCompleted: 22,
    isOnline: true,
    role: 'Member',
  },
];

// Current signed-in explorer (You)
const CURRENT_USER: SocialUser = {
  id: 'me',
  displayName: 'Usha Baskar',
  handle: 'usha_explorer',
  avatar: '🛡️',
  level: 15,
  xp: 4500,
  badge: 'Chennai Legend',
  bio: 'Mapping the beating heart of Tamil heritage from Mylapore to George Town.',
  questsCompleted: 31,
  isOnline: true,
  role: 'Admin',
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  onShowToast,
  onSelectSpot,
  onSelectQuest,
  onNavigateToMap,
  initialConversationId,
  masterSpots = [],
}) => {
  // Nanbar Core Navigation: 'friends' | 'messages' | 'groups'
  const [activeTab, setActiveTab] = useState<'friends' | 'messages' | 'groups'>('friends');

  // Secondary Overlay Actions
  const [showFindFriends, setShowFindFriends] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Handle Find Friends Search
  const [friendSearchInput, setFriendSearchInput] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);

  // Friends & Requests list
  const [myFriends, setMyFriends] = useState<SocialUser[]>([
    INITIAL_EXPLORERS[0],
    INITIAL_EXPLORERS[1],
    INITIAL_EXPLORERS[2],
  ]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([
    { id: 'req_1', sender: INITIAL_EXPLORERS[3] },
  ]);

  // Social Notification logs
  const [socialNotifications, setSocialNotifications] = useState<SocialNotification[]>([
    { id: 'not_1', type: 'friend_accepted', title: 'Friend Request Accepted', text: 'Priya Sundaram accepted your team explorer invitation!', time: '10m ago', colorClass: 'border-kaos-lime text-kaos-lime bg-kaos-lime/10' },
    { id: 'not_2', type: 'message', title: 'New Direct Message', text: 'Alex Morgan sent: "Found a vintage filter coffee ledger!"', time: '1h ago', colorClass: 'border-kaos-teal text-kaos-teal bg-kaos-teal/10' },
    { id: 'not_3', type: 'group_invitation', title: 'Group Faction Invitation', text: 'You were added to Mylapore Heritage Seekers.', time: '2h ago', colorClass: 'border-kaos-purple text-kaos-purple bg-kaos-purple/10' },
    { id: 'not_4', type: 'achievement', title: 'Group Achievement unlocked!', text: 'Mylapore water survey reached +2,000 XP milestone!', time: '1 day ago', colorClass: 'border-kaos-yellow text-kaos-yellow bg-kaos-yellow/10' },
  ]);

  // Chats states with approved Controlled Chaos features colors
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'conv_group_mylapore',
      name: 'Mylapore Heritage Seekers',
      avatar: '🏛️',
      type: 'group',
      lastMessageText: 'Ready for the morning stepwell survey?',
      lastMessageTime: '09:42 AM',
      unreadCount: 2,
      memberIds: ['me', 'user_alex', 'user_priya', 'user_sam'],
      groupQuestName: 'Decipher Kapaleeshwarar Gopuram geometry',
      groupQuestProgress: 68,
      admins: ['user_priya'],
      groupColor: 'border-kaos-teal text-kaos-teal',
    },
    {
      id: 'conv_alex',
      name: 'Alex Morgan',
      avatar: '🧭',
      type: 'direct',
      lastMessageText: 'Found a vintage filter coffee ledger!',
      lastMessageTime: 'Yesterday',
      unreadCount: 0,
      memberIds: ['me', 'user_alex'],
      groupColor: 'border-kaos-pink text-kaos-pink',
    },
    {
      id: 'conv_sam',
      name: 'Sam Ramachandran',
      avatar: '☕',
      type: 'direct',
      lastMessageText: 'Can we check out Triplicane tomorrow?',
      lastMessageTime: 'Tuesday',
      unreadCount: 1,
      memberIds: ['me', 'user_sam'],
      groupColor: 'border-kaos-orange text-kaos-orange',
    },
  ]);

  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || 'conv_group_mylapore');
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({
    conv_group_mylapore: [
      { id: '1', senderId: 'user_priya', senderName: 'Priya S', senderAvatar: '🏛️', text: 'Hey guys! Look at this incredible sound map of Mylapore tank!', timestamp: '09:30 AM', status: 'read' },
      { id: '2', senderId: 'user_alex', senderName: 'Alex M', senderAvatar: '🧭', text: 'Stunning! The acoustic echo aligns exactly with the gopuram step counts.', timestamp: '09:32 AM', status: 'read' },
      { id: '3', senderId: 'user_sam', senderName: 'Sam R', senderAvatar: '☕', text: 'Ready for the morning stepwell survey?', timestamp: '09:42 AM', status: 'read' },
    ],
    conv_alex: [
      { id: 'a1', senderId: 'user_alex', senderName: 'Alex M', senderAvatar: '🧭', text: 'Check this out, I found an old archive.', timestamp: '04:10 PM', status: 'read' },
      { id: 'a2', senderId: 'me', senderName: 'Usha B', senderAvatar: '🛡️', text: 'Oh nice! Is that from colonial George Town?', timestamp: '04:12 PM', status: 'read' },
      { id: 'a3', senderId: 'user_alex', senderName: 'Alex M', senderAvatar: '🧭', text: 'Yes! Found a vintage filter coffee ledger!', timestamp: '04:15 PM', status: 'read' },
    ],
    conv_sam: [
      { id: 's1', senderId: 'user_sam', senderName: 'Sam R', senderAvatar: '☕', text: 'Can we check out Triplicane tomorrow?', timestamp: '01:05 PM', status: 'read' },
    ],
  });

  // Current typed message
  const [composeText, setComposeText] = useState('');

  // Block/Report/Profile systems
  const [blockedUsers, setBlockedUsers] = useState<SocialUser[]>([]);
  const [viewingProfileUser, setViewingProfileUser] = useState<SocialUser | null>(null);
  const [reportingUser, setReportingUser] = useState<SocialUser | null>(null);
  const [reportCategory, setReportCategory] = useState('Spam');
  const [reportDesc, setReportDesc] = useState('');

  // Attachment controls inside chat
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Group Details Modal / Creation State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);

  // Active Group Nav subtab
  const [activeGroupTab, setActiveGroupTab] = useState<'home' | 'chat' | 'quests' | 'leaderboard' | 'members' | 'activity'>('home');

  // Ref for scroll to bottom
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // Group Administrator state
  const [selectedGroupMemberAction, setSelectedGroupMemberAction] = useState<SocialUser | null>(null);

  // Real-time activity feeds for group quest completions
  const [groupActivities, setGroupActivities] = useState<string[]>([
    'Priya completed the Kapaleeshwarar Tank Soundscape Quest! (+150 XP)',
    'Alex contributed +100 Quest Progress points with photo proof.',
    'Sam shared Triplicane Coffee House live coordinates.',
  ]);

  // Clean unread count on opening conversation
  useEffect(() => {
    if (activeConvId) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, unreadCount: 0 } : c))
      );
      // Ensure group tab is home on open
      setActiveGroupTab('home');
    }
    scrollToBottom();
  }, [activeConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Unique handle validation rules
  const validateAndAddFriendByHandle = (e: React.FormEvent) => {
    e.preventDefault();
    setHandleError(null);

    const raw = friendSearchInput.trim().replace(/^@/, '');
    if (!raw) {
      setHandleError('Please enter a handle.');
      return;
    }

    if (raw.length < 3) {
      setHandleError('Handle must be at least 3 characters.');
      return;
    }
    if (raw.length > 20) {
      setHandleError('Handle must be 20 characters or fewer.');
      return;
    }
    if (/[A-Z]/.test(raw)) {
      setHandleError('Handle must use lowercase letters.');
      return;
    }
    if (/\s/.test(raw)) {
      setHandleError('Handle cannot contain spaces.');
      return;
    }
    if (/[^a-z0-9_]/.test(raw)) {
      setHandleError('Handle can only contain lowercase letters, numbers, and underscores.');
      return;
    }
    if (raw.startsWith('_') || raw.endsWith('_')) {
      setHandleError('Handle cannot start or end with an underscore.');
      return;
    }
    if (/__/.test(raw)) {
      setHandleError('Handle cannot contain consecutive underscores.');
      return;
    }
    if (!/[a-z]/.test(raw)) {
      setHandleError('Handle must contain at least one letter.');
      return;
    }

    const foundUser = INITIAL_EXPLORERS.find(
      (u) => u.handle.toLowerCase() === raw.toLowerCase()
    );

    if (!foundUser) {
      setHandleError('This handle is unavailable. Please choose another.');
      return;
    }

    if (foundUser.id === CURRENT_USER.id) {
      setHandleError('You cannot send a friend request to yourself.');
      return;
    }

    const isAlreadyFriend = myFriends.some((f) => f.id === foundUser.id);
    if (isAlreadyFriend) {
      setHandleError('You are already friends with this explorer!');
      return;
    }

    onShowToast(`Friend request sent to @${foundUser.handle}!`);
    setFriendSearchInput('');
    setShowFindFriends(false);
  };

  const handleAcceptRequest = (reqId: string, sender: SocialUser) => {
    setIncomingRequests((prev) => prev.filter((r) => r.id !== reqId));
    setMyFriends((prev) => [...prev, sender]);
    onShowToast(`Friend request accepted from @${sender.handle}! 🎉`);
  };

  const handleDeclineRequest = (reqId: string) => {
    setIncomingRequests((prev) => prev.filter((r) => r.id !== reqId));
    onShowToast('Declined friend request.');
  };

  const handleRemoveFriend = (userId: string) => {
    setMyFriends((prev) => prev.filter((f) => f.id !== userId));
    onShowToast('Removed friend from explorer squad.');
    setViewingProfileUser(null);
  };

  const handleBlockUser = (user: SocialUser) => {
    setMyFriends((prev) => prev.filter((f) => f.id !== user.id));
    setIncomingRequests((prev) => prev.filter((r) => r.sender.id !== user.id));
    setConversations((prev) => prev.filter((c) => {
      if (c.type === 'direct') {
        return !c.memberIds.includes(user.id);
      }
      return true;
    }));
    setBlockedUsers((prev) => [...prev, user]);
    onShowToast(`Blocked user @${user.handle}. Safety protocol updated.`);
    setViewingProfileUser(null);
  };

  const handleUnblockUser = (userId: string) => {
    setBlockedUsers((prev) => prev.filter((b) => b.id !== userId));
    onShowToast('Unblocked user. Friendship is not automatically restored.');
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingUser) return;
    onShowToast('Report submitted. Thank you for helping keep KAOS safe.');
    setReportingUser(null);
    setReportDesc('');
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = composeText.trim();
    if (!clean || !activeConvId) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      senderId: 'me',
      senderName: CURRENT_USER.displayName,
      senderAvatar: CURRENT_USER.avatar,
      text: clean,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    };

    setChatMessages((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, lastMessageText: clean, lastMessageTime: 'Just now' }
          : c
      )
    );

    setComposeText('');
    scrollToBottom();
  };

  const handleAttachSpotToChat = (spot: MasterSpot) => {
    if (!activeConvId) return;
    const newMsg: Message = {
      id: `msg_spot_${Date.now()}`,
      senderId: 'me',
      senderName: CURRENT_USER.displayName,
      senderAvatar: CURRENT_USER.avatar,
      text: `Let us explore: ${spot.title}!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      attachedSpot: spot,
    };
    setChatMessages((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));
    setShowAttachMenu(false);
    onShowToast(`Attached spot "${spot.title}" directly to chat!`);
  };

  const handleAttachCoordinates = () => {
    if (!activeConvId) return;
    const newMsg: Message = {
      id: `msg_coords_${Date.now()}`,
      senderId: 'me',
      senderName: CURRENT_USER.displayName,
      senderAvatar: CURRENT_USER.avatar,
      text: 'Shared current map tracking pin',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      attachedLocation: '13.0628° N, 80.2707° E (Chennai Central Clock Tower)',
    };
    setChatMessages((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));
    setShowAttachMenu(false);
    onShowToast('Map coordinates pins attached successfully!');
  };

  const handleConfirmCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;

    const newGroupId = `conv_group_${Date.now()}`;
    const newGroup: Conversation = {
      id: newGroupId,
      name: groupNameInput,
      avatar: '🛡️',
      type: 'group',
      lastMessageText: 'New exploration squad formed!',
      lastMessageTime: 'Just now',
      unreadCount: 0,
      memberIds: ['me', ...selectedFriendsForGroup],
      groupQuestName: 'Survey traditional peaberry roasteries',
      groupQuestProgress: 10,
      groupColor: 'border-kaos-pink text-kaos-pink',
    };

    setConversations((prev) => [newGroup, ...prev]);
    setChatMessages((prev) => ({
      ...prev,
      [newGroupId]: [
        {
          id: 'init_1',
          senderId: 'me',
          senderName: CURRENT_USER.displayName,
          senderAvatar: CURRENT_USER.avatar,
          text: `Welcome to the "${groupNameInput}" faction group!`,
          timestamp: 'Just now',
          status: 'sent',
        },
      ],
    }));

    setGroupNameInput('');
    setSelectedFriendsForGroup([]);
    setShowCreateGroupModal(false);
    setActiveConvId(newGroupId);
    onShowToast(`Squad Faction "${newGroup.name}" created! ⚔️`);
  };

  const handleKickMember = (userId: string, groupName: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          return {
            ...c,
            memberIds: c.memberIds.filter((m) => m !== userId),
          };
        }
        return c;
      })
    );
    setSelectedGroupMemberAction(null);
    onShowToast(`Removed surveyor from group ${groupName}.`);
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const currentGroupMembers: SocialUser[] = activeConv
    ? [CURRENT_USER, ...INITIAL_EXPLORERS].filter((u) => activeConv.memberIds.includes(u.id))
    : [];

  return (
    <div className="pb-28 p-4 md:p-8 max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col font-sans select-none text-kaos-offwhite selection:bg-kaos-pink/20">
      
      {/* 1. NANBAR HOME BANNER */}
      <div className="bg-gradient-to-r from-kaos-pink to-kaos-purple rounded-3xl p-5 md:p-6 mb-6 shadow-xl relative overflow-hidden border border-kaos-pink/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative z-10 flex items-center gap-3">
          <span className="material-symbols-outlined text-kaos-yellow text-4xl animate-pulse">diversity_3</span>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-kaos-offwhite tracking-wider">NANBAR</h2>
            <p className="text-xs text-kaos-offwhite/95 font-semibold mt-1">Explore Chennai together. Complete quests, chat and conquer leaderboards.</p>
          </div>
        </div>

        {/* Secondary Navigation actions in the header */}
        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <button
            onClick={() => setShowFindFriends(true)}
            className="p-2.5 rounded-xl bg-kaos-navy/80 hover:bg-kaos-navy text-kaos-teal font-extrabold text-xs flex items-center gap-1.5 shadow-md border border-kaos-teal/20 cursor-pointer"
            title="Search explorers by handle"
          >
            <span className="material-symbols-outlined text-sm font-bold">search</span>
            <span>Find People</span>
          </button>

          <button
            onClick={() => setShowRequestsModal(true)}
            className="p-2.5 rounded-xl bg-kaos-navy/80 hover:bg-kaos-navy text-kaos-pink font-extrabold text-xs flex items-center gap-1.5 shadow-md border border-kaos-pink/20 relative cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">person_add</span>
            <span>Requests</span>
            {incomingRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full bg-kaos-yellow text-kaos-navy text-[8px] font-black animate-bounce">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowNotificationsModal(true)}
            className="p-2.5 rounded-xl bg-kaos-navy/80 hover:bg-kaos-navy text-kaos-yellow font-extrabold text-xs flex items-center gap-1.5 shadow-md border border-kaos-yellow/20 relative cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">notifications</span>
            <span>Inbox</span>
          </button>

          <button
            onClick={() => setShowPrivacyModal(true)}
            className="p-2.5 rounded-xl bg-kaos-navy/80 hover:bg-kaos-navy text-kaos-red font-extrabold text-xs flex items-center gap-1.5 shadow-md border border-kaos-red/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">shield_lock</span>
            <span>Safety</span>
          </button>
        </div>
      </div>

      {/* 2. NANBAR CORE NAVIGATION: Friends | Messages | Groups */}
      <div className="flex items-center gap-1.5 bg-surface-primary border border-progress-track p-1.5 rounded-2xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'friends' ? 'bg-kaos-pink text-white shadow-lg' : 'text-text-secondary hover:text-kaos-offwhite'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">groups</span>
          <span>FRIENDS</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-secondary text-text-secondary text-[9px] font-mono font-bold">
            {myFriends.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'messages' ? 'bg-kaos-teal text-kaos-navy shadow-lg' : 'text-text-secondary hover:text-kaos-offwhite'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">forum</span>
          <span>DIRECT MESSAGES</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'groups' ? 'bg-kaos-purple text-white shadow-lg' : 'text-text-secondary hover:text-kaos-offwhite'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">diversity_3</span>
          <span>GROUPS</span>
        </button>
      </div>

      {/* 3. CORE DISPLAY LAYOUT PANELS */}
      <div className="flex-1 bg-surface-primary border border-progress-track rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl min-h-0">
        
        {/* TAB A: FRIENDS DIRECTORY */}
        {activeTab === 'friends' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-background-secondary/30">
            <div className="border-b border-progress-track pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-kaos-offwhite">My Explorer Squad</h3>
                <p className="text-xs text-text-secondary">Directly track which teammates are active on Chennai heritage trails.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myFriends.map((f) => (
                <div
                  key={f.id}
                  className="bg-surface-primary border border-progress-track rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-md relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-kaos-pink to-kaos-purple flex items-center justify-center text-2xl shrink-0 shadow-md">
                        {f.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-kaos-offwhite">{f.displayName}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${f.isOnline ? 'bg-online animate-pulse shadow-md' : 'bg-text-muted'}`} />
                        </div>
                        <span className="text-[10px] text-text-secondary block">@{f.handle}</span>
                        <p className="text-[9px] font-bold text-kaos-yellow mt-1 font-mono uppercase bg-surface-secondary border border-kaos-yellow/15 px-1.5 py-0.2 rounded-full w-fit">
                          Lv {f.level} · {f.badge}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-secondary leading-relaxed min-h-[32px] border-t border-progress-track/50 pt-2 italic">
                    "{f.bio}"
                  </p>

                  <div className="flex items-center gap-2 border-t border-progress-track pt-3 text-xs">
                    <button
                      onClick={() => {
                        const existing = conversations.find((c) => c.type === 'direct' && c.memberIds.includes(f.id));
                        if (existing) {
                          setActiveConvId(existing.id);
                        } else {
                          const newId = `conv_${f.id}_${Date.now()}`;
                          const dConv: Conversation = {
                            id: newId,
                            name: f.displayName,
                            avatar: f.avatar,
                            type: 'direct',
                            lastMessageText: 'Say hello to your teammate!',
                            lastMessageTime: 'Just now',
                            unreadCount: 0,
                            memberIds: ['me', f.id],
                          };
                          setConversations((prev) => [dConv, ...prev]);
                          setActiveConvId(newId);
                        }
                        setActiveTab('messages');
                        onShowToast(`Opened message thread with @${f.handle}`);
                      }}
                      className="flex-1 py-1.5 rounded-xl bg-surface-secondary hover:bg-kaos-pink text-kaos-pink hover:text-white border border-kaos-pink/15 text-center font-bold cursor-pointer transition-all"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => setViewingProfileUser(f)}
                      className="py-1.5 px-3 rounded-xl bg-surface-secondary text-text-secondary hover:text-kaos-offwhite border border-progress-track text-center font-bold cursor-pointer transition-all"
                    >
                      View Cards
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB B: DIRECT MESSAGES */}
        {activeTab === 'messages' && (
          <>
            {/* Sidebar threads */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-progress-track flex flex-col bg-background-secondary ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-progress-track space-y-2.5">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Chat Inboxes</h4>
                <input
                  type="text"
                  placeholder="Filter conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-primary border border-progress-track rounded-xl px-3 py-2 text-xs text-kaos-offwhite focus:outline-none focus:border-kaos-pink placeholder-text-muted"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <AnimatePresence mode="popLayout">
                  {conversations
                    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((conv) => {
                      const isSelected = activeConvId === conv.id;
                      return (
                        <motion.button
                          layout
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96, x: -10 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          key={conv.id}
                          onClick={() => setActiveConvId(conv.id)}
                          className={`w-full p-3 rounded-2xl text-left border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-surface-secondary border-kaos-pink/30'
                              : 'bg-surface-primary border-transparent hover:bg-surface-secondary/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-kaos-pink to-kaos-purple flex items-center justify-center text-xl shrink-0">
                              {conv.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-xs font-bold text-kaos-offwhite truncate">{conv.name}</h4>
                                <span className="text-[9px] text-text-muted font-mono">{conv.lastMessageTime}</span>
                              </div>
                              <p className="text-[11px] text-text-secondary truncate mt-0.5">{conv.lastMessageText}</p>
                            </div>
                          </div>

                          {conv.unreadCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-kaos-pink text-white font-bold font-mono text-[10px] flex items-center justify-center shrink-0 shadow-md">
                              {conv.unreadCount}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                </AnimatePresence>
              </div>
            </div>

            {/* Chat Pane */}
            <div className={`flex-1 flex flex-col bg-surface-primary ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
              {activeConv ? (
                <>
                  <div className="p-4 border-b border-progress-track flex items-center justify-between gap-4 bg-background-secondary shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveConvId(null)}
                        className="md:hidden p-2 rounded-xl hover:bg-surface-secondary text-text-secondary"
                      >
                        <span className="material-symbols-outlined font-bold text-base text-kaos-pink">arrow_back</span>
                      </button>
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-kaos-pink to-kaos-purple flex items-center justify-center text-xl shadow-md">
                        {activeConv.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-kaos-offwhite">{activeConv.name}</h4>
                        <p className="text-[10px] text-text-secondary mt-0.5 font-mono">@{activeConv.type} private line</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const contact = INITIAL_EXPLORERS.find((u) => activeConv.memberIds.includes(u.id) && u.id !== 'me');
                        if (contact) setViewingProfileUser(contact);
                      }}
                      className="p-2 rounded-xl bg-surface-primary border border-progress-track text-text-secondary hover:text-kaos-pink cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">info</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background-primary/40">
                    <AnimatePresence mode="popLayout">
                      {(chatMessages[activeConv.id] || []).map((msg) => {
                        const isMe = msg.senderId === 'me';
                        return (
                          <motion.div
                            layout
                            initial={{ opacity: 0, y: 15, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92, y: -8 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            key={msg.id}
                            className={`flex gap-3 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                          >
                            <div className="w-8 h-8 rounded-xl bg-surface-secondary border border-progress-track flex items-center justify-center text-sm shrink-0">
                              {msg.senderAvatar}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-kaos-offwhite">{msg.senderName}</span>
                                <span className="text-[8px] text-text-muted font-mono">{msg.timestamp}</span>
                              </div>
                              <div
                                className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                  isMe
                                    ? 'bg-kaos-pink text-white rounded-tr-none shadow-md'
                                    : 'bg-surface-secondary text-kaos-offwhite rounded-tl-none border border-progress-track'
                                }`}
                              >
                                {msg.text}

                                {msg.attachedSpot && (
                                  <div className="mt-3 bg-surface-primary border border-progress-track p-3 rounded-xl text-kaos-offwhite space-y-2 text-left shadow-lg">
                                    <img
                                      src={msg.attachedSpot.imageUrl}
                                      alt={msg.attachedSpot.title}
                                      className="w-full h-24 object-cover rounded-lg"
                                    />
                                    <div>
                                      <p className="font-extrabold text-xs text-kaos-teal">{msg.attachedSpot.title}</p>
                                      <p className="text-[10px] text-text-secondary mt-0.5 truncate">{msg.attachedSpot.description}</p>
                                    </div>
                                    <button
                                      onClick={() => onSelectSpot?.(msg.attachedSpot!)}
                                      className="w-full text-center py-1.5 rounded-lg bg-kaos-teal text-kaos-navy font-black text-[10px]"
                                    >
                                      Inspect Landmark
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    <div ref={messageEndRef} />
                  </div>

                  {/* Composer */}
                  <div className="p-4 border-t border-progress-track bg-background-secondary shrink-0 relative">
                    {showAttachMenu && (
                      <div className="absolute bottom-16 left-4 bg-surface-primary border border-progress-track rounded-2xl p-2.5 space-y-1.5 shadow-2xl w-48 z-40 animate-in fade-in">
                        <p className="text-[9px] font-bold text-text-secondary uppercase px-2 mb-1">Quick Attach Clue</p>
                        {masterSpots.slice(0, 2).map((spot) => (
                          <button
                            key={spot.id}
                            onClick={() => handleAttachSpotToChat(spot)}
                            className="w-full px-2 py-1.5 rounded-lg hover:bg-surface-secondary text-left text-xs font-semibold text-kaos-offwhite flex items-center gap-2 cursor-pointer"
                          >
                            🗺️ {spot.title}
                          </button>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className="p-2.5 rounded-xl bg-surface-primary border border-progress-track text-text-secondary hover:text-kaos-pink flex items-center justify-center cursor-pointer shadow-md shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">add_location_alt</span>
                      </button>

                      <input
                        type="text"
                        placeholder="Type a secure message..."
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        className="flex-1 bg-surface-primary border border-progress-track rounded-xl px-4 py-2.5 text-xs text-kaos-offwhite focus:outline-none focus:border-kaos-pink placeholder-text-muted"
                      />

                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-kaos-pink hover:bg-kaos-purple text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background-secondary">
                  <span className="material-symbols-outlined text-4xl text-kaos-pink mb-2">forum</span>
                  <h4 className="text-sm font-bold text-kaos-offwhite">No direct message threads selected</h4>
                  <p className="text-xs text-text-secondary mt-1">Select a teammate explorer on the left to initiate private DM routes.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB C: FACTION GROUPS */}
        {activeTab === 'groups' && (
          <>
            {/* Left groups sidebar */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-progress-track flex flex-col bg-background-secondary ${activeConvId?.startsWith('conv_group') ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-progress-track flex items-center justify-between">
                <span className="text-xs font-bold text-text-secondary uppercase">My active groups</span>
                <button
                  onClick={() => {
                    setSelectedFriendsForGroup([]);
                    setGroupNameInput('');
                    setShowCreateGroupModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-kaos-purple hover:bg-kaos-pink text-white font-extrabold text-[10px] flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">group_add</span>
                  <span>Form Group</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations
                  .filter((c) => c.type === 'group')
                  .map((group) => {
                    const isSelected = activeConvId === group.id;
                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          setActiveConvId(group.id);
                          setActiveGroupTab('home');
                        }}
                        className={`w-full p-3 rounded-2xl text-left border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-surface-secondary border-kaos-purple/30'
                            : 'bg-surface-primary border-transparent hover:bg-surface-secondary/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-kaos-purple to-kaos-pink flex items-center justify-center text-xl shrink-0">
                            {group.avatar}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-kaos-offwhite truncate">{group.name}</h4>
                            <p className="text-[10px] text-text-secondary mt-0.5 truncate">{group.memberIds.length} active surveyors</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Right Group Portal details */}
            <div className={`flex-1 flex flex-col bg-surface-primary ${!activeConvId?.startsWith('conv_group') ? 'hidden md:flex' : 'flex'}`}>
              {activeConv && activeConv.type === 'group' ? (
                <>
                  {/* Group header identity */}
                  <div className="p-4 border-b border-progress-track bg-background-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-kaos-purple to-kaos-pink flex items-center justify-center text-2xl shadow-md">
                        {activeConv.avatar}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-kaos-offwhite uppercase tracking-wider">{activeConv.name}</h4>
                        <p className="text-[10px] text-text-secondary mt-0.5 font-mono">
                          {activeConv.memberIds.length} active explorers · Level {Math.floor(activeConv.groupQuestProgress! / 20) + 1}
                        </p>
                      </div>
                    </div>

                    {/* Group Tab navigation: Home | Chat | Quests | Leaderboard | Members | Activity */}
                    <div className="flex items-center gap-1 bg-surface-primary border border-progress-track p-1 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
                      {['home', 'chat', 'quests', 'leaderboard', 'members', 'activity'].map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setActiveGroupTab(sub as any)}
                          className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer shrink-0 ${
                            activeGroupTab === sub
                              ? 'bg-kaos-purple text-white'
                              : 'text-text-secondary hover:text-kaos-offwhite'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ACTIVE TAB: HOME SCREEN SUMMARY */}
                  {activeGroupTab === 'home' && (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                      
                      {/* Active shared quest poster - Style C Hero */}
                      <div className="bg-gradient-to-r from-kaos-orange to-kaos-yellow rounded-2xl p-5 border border-kaos-orange/15 shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative z-10">
                          <span className="px-2 py-0.5 rounded bg-kaos-navy text-kaos-yellow text-[9px] font-mono font-bold uppercase">
                            Active Group Quest Target
                          </span>
                          <h4 className="text-sm font-black text-kaos-navy mt-1.5 uppercase leading-snug">
                            "{activeConv.groupQuestName}"
                          </h4>
                          <p className="text-[11px] text-kaos-navy/90 mt-1 font-semibold">Decipher architectural alignments & unlock group points.</p>
                        </div>
                        <div className="relative z-10 shrink-0 text-center bg-kaos-navy/80 px-4 py-3.5 rounded-xl border border-kaos-yellow/20">
                          <span className="text-[9px] font-bold text-text-secondary uppercase block">Progress</span>
                          <span className="text-xl font-extrabold text-kaos-yellow font-mono mt-0.5 block">{activeConv.groupQuestProgress}%</span>
                        </div>
                      </div>

                      {/* Members preview summary & chat buttons */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-surface-secondary border border-progress-track rounded-2xl p-4 space-y-3 shadow-md">
                          <h4 className="text-xs font-bold text-text-secondary uppercase">Explorers Team Preview</h4>
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {currentGroupMembers.map((m) => (
                              <div
                                key={m.id}
                                className="w-9 h-9 rounded-xl bg-surface-primary border border-progress-track flex items-center justify-center text-lg shadow-sm shrink-0 cursor-pointer"
                                title={m.displayName}
                                onClick={() => setViewingProfileUser(m)}
                              >
                                {m.avatar}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => setActiveGroupTab('members')}
                            className="w-full text-center py-2 rounded-xl bg-surface-primary hover:bg-surface-secondary text-text-secondary hover:text-kaos-offwhite border border-progress-track text-xs font-bold transition-all cursor-pointer"
                          >
                            Manage Faction Members
                          </button>
                        </div>

                        {/* Leaderboard Preview */}
                        <div className="bg-surface-secondary border border-progress-track rounded-2xl p-4 space-y-3 shadow-md">
                          <h4 className="text-xs font-bold text-text-secondary uppercase">Leaderboard #1 Champion</h4>
                          {currentGroupMembers.length > 0 && (
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">👑</div>
                              <div>
                                <span className="text-xs font-bold text-kaos-yellow block">
                                  {currentGroupMembers.sort((a,b)=>b.xp-a.xp)[0].displayName}
                                </span>
                                <span className="text-[10px] text-text-secondary font-mono">
                                  {currentGroupMembers.sort((a,b)=>b.xp-a.xp)[0].xp.toLocaleString()} XP
                                </span>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => setActiveGroupTab('leaderboard')}
                            className="w-full text-center py-2 rounded-xl bg-surface-primary hover:bg-surface-secondary text-text-secondary hover:text-kaos-offwhite border border-progress-track text-xs font-bold transition-all cursor-pointer"
                          >
                            Inspect Full Standings
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIVE TAB: CHAT ROOM */}
                  {activeGroupTab === 'chat' && (
                    <>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background-primary/40">
                        <AnimatePresence mode="popLayout">
                          {(chatMessages[activeConv.id] || []).map((msg) => {
                            const isMe = msg.senderId === 'me';
                            return (
                              <motion.div
                                layout
                                initial={{ opacity: 0, y: 15, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                key={msg.id}
                                className={`flex gap-3 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                              >
                                <div className="w-8 h-8 rounded-xl bg-surface-secondary border border-progress-track flex items-center justify-center text-sm shrink-0">
                                  {msg.senderAvatar}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-kaos-offwhite">{msg.senderName}</span>
                                    <span className="text-[8px] text-text-muted font-mono">{msg.timestamp}</span>
                                  </div>
                                  <div
                                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                      isMe
                                        ? 'bg-kaos-purple text-white rounded-tr-none shadow-md'
                                        : 'bg-surface-secondary text-kaos-offwhite rounded-tl-none border border-progress-track'
                                    }`}
                                  >
                                    {msg.text}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        <div ref={messageEndRef} />
                      </div>

                      <div className="p-4 border-t border-progress-track bg-background-secondary shrink-0">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Type a group message..."
                            value={composeText}
                            onChange={(e) => setComposeText(e.target.value)}
                            className="flex-1 bg-surface-primary border border-progress-track rounded-xl px-4 py-2.5 text-xs text-kaos-offwhite focus:outline-none focus:border-kaos-purple"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2.5 rounded-xl bg-kaos-purple text-white text-xs font-bold shadow-md cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                          </button>
                        </form>
                      </div>
                    </>
                  )}

                  {/* ACTIVE TAB: SQUAD QUEST TARGETS */}
                  {activeGroupTab === 'quests' && (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                      <div className="bg-surface-secondary p-5 rounded-2xl border border-progress-track space-y-3 shadow-md">
                        <span className="px-2 py-0.5 rounded bg-kaos-orange/15 border border-kaos-orange/30 text-kaos-orange text-[9px] font-mono font-bold uppercase">
                          ACTIVE FACTION QUEST
                        </span>
                        <h4 className="text-sm font-black text-kaos-offwhite uppercase">"{activeConv.groupQuestName}"</h4>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          Collaborate to check in geofenced map coordinates at Kapaleeshwarar Tank stepwell systems. Verification is validated socially in real-time.
                        </p>

                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-[10px] font-mono font-bold">
                            <span>SQUAD VERIFICATION PROGRESS</span>
                            <span className="text-kaos-orange">{activeConv.groupQuestProgress}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-background-primary border border-progress-track rounded-full overflow-hidden">
                            <div className="h-full bg-kaos-orange rounded-full transition-all" style={{ width: `${activeConv.groupQuestProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIVE TAB: LEADERBOARD */}
                  {activeGroupTab === 'leaderboard' && (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                      <div className="border-b border-progress-track pb-2">
                        <h4 className="text-sm font-bold text-kaos-offwhite uppercase tracking-wider">Internal Standings</h4>
                        <p className="text-xs text-text-secondary">Ranks updated automatically as group members complete quests.</p>
                      </div>

                      <div className="space-y-2">
                        {currentGroupMembers
                          .sort((a,b)=>b.xp-a.xp)
                          .map((m,idx) => {
                            const rank = idx + 1;
                            const isMe = m.id === 'me';
                            return (
                              <div
                                key={m.id}
                                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                                  isMe ? 'bg-surface-secondary border-kaos-teal/30' : 'bg-surface-secondary/40 border-progress-track'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-lg text-[10px] font-extrabold font-mono flex items-center justify-center shrink-0 ${
                                    rank === 1 ? 'bg-kaos-yellow text-kaos-navy' : rank === 2 ? 'bg-text-secondary text-kaos-navy' : 'bg-surface-secondary text-text-secondary'
                                  }`}>
                                    #{rank}
                                  </span>
                                  <div className="w-8 h-8 rounded-xl bg-surface-primary border border-progress-track flex items-center justify-center text-sm">
                                    {m.avatar}
                                  </div>
                                  <div>
                                    <span className="font-bold text-kaos-offwhite block">{m.displayName}</span>
                                    <span className="text-[9px] text-text-secondary">@{m.handle}</span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="font-bold text-kaos-yellow font-mono">{m.xp.toLocaleString()} XP</span>
                                  {isMe && <span className="text-[8px] text-kaos-teal block font-mono">ACTIVE (YOU)</span>}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* ACTIVE TAB: MEMBERS PRIVILEGES */}
                  {activeGroupTab === 'members' && (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-progress-track pb-2">
                        <h4 className="text-sm font-bold text-kaos-offwhite uppercase tracking-wider">Members Directory</h4>
                        <button
                          onClick={() => {
                            onShowToast('Group invitations dispatched!');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-kaos-purple hover:bg-kaos-pink text-white text-xs font-black cursor-pointer shadow-md"
                        >
                          + Invite Team
                        </button>
                      </div>

                      <div className="space-y-2">
                        {currentGroupMembers.map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-surface-secondary border border-progress-track rounded-xl flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-surface-primary border border-progress-track flex items-center justify-center text-sm">
                                {m.avatar}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-kaos-offwhite">{m.displayName}</span>
                                  {m.role === 'Admin' && (
                                    <span className="px-1.5 py-0.2 rounded bg-kaos-yellow text-kaos-navy text-[8px] font-black uppercase font-mono">
                                      ADMIN / OWNER
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-text-secondary block">@{m.handle}</span>
                              </div>
                            </div>

                            {CURRENT_USER.role === 'Admin' && m.id !== 'me' ? (
                              <button
                                onClick={() => setSelectedGroupMemberAction(m)}
                                className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-kaos-red/15 text-kaos-red border border-kaos-red/20 text-[10px] font-bold cursor-pointer transition-all"
                              >
                                Kick Member
                              </button>
                            ) : (
                              <span className="text-[10px] text-text-secondary italic">Standard permissions</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ACTIVE TAB: ACTIVITY FEED */}
                  {activeGroupTab === 'activity' && (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                      <h4 className="text-sm font-bold text-kaos-offwhite uppercase tracking-wider">Meaningful group events</h4>
                      <div className="space-y-2">
                        {groupActivities.map((act, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-surface-secondary border border-progress-track rounded-xl flex items-center gap-3 text-xs text-text-secondary shadow-md"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-kaos-lime shrink-0" />
                            <span>{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background-secondary">
                  <span className="material-symbols-outlined text-4xl text-kaos-purple mb-2">diversity_3</span>
                  <h4 className="text-sm font-bold text-kaos-offwhite">No group faction selected</h4>
                  <p className="text-xs text-text-secondary mt-1">Select an active squad faction on the left sidebar to coordinate team targets.</p>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* OVERLAY A: FIND FRIENDS SEARCH DIALOG */}
      <AnimatePresence>
        {showFindFriends && (
          <div
            onClick={() => setShowFindFriends(false)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3">
                <h3 className="text-sm font-black text-kaos-pink uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined">person_add</span>
                  <span>Find Explorers by Handle</span>
                </h3>
                <button
                  onClick={() => {
                    setFriendSearchInput('');
                    setHandleError(null);
                    setShowFindFriends(false);
                  }}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={validateAndAddFriendByHandle} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Unique Explorer Handle</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-xs text-text-secondary font-mono">@</span>
                    <input
                      type="text"
                      placeholder="e.g. priya_madrasi"
                      value={friendSearchInput}
                      onChange={(e) => setFriendSearchInput(e.target.value)}
                      className="w-full bg-surface-secondary border border-progress-track focus:border-kaos-pink rounded-xl pl-8 pr-4 py-2.5 text-xs text-kaos-offwhite focus:outline-none placeholder-text-muted"
                    />
                  </div>
                </div>

                {handleError && (
                  <p className="text-[11px] font-bold text-kaos-red bg-error-bg border border-kaos-red/20 p-2.5 rounded-lg flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs font-bold">error</span>
                    <span>{handleError}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full text-center py-2.5 rounded-xl bg-kaos-pink hover:bg-kaos-purple text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Send Friend Request
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY B: PENDING REQUESTS DIALOG */}
      <AnimatePresence>
        {showRequestsModal && (
          <div
            onClick={() => setShowRequestsModal(false)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3">
                <h3 className="text-sm font-black text-kaos-pink uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined">person_add</span>
                  <span>Friend Requests Received</span>
                </h3>
                <button
                  onClick={() => setShowRequestsModal(false)}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-text-secondary italic text-center py-4">No pending explorer invitations.</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 bg-surface-secondary border border-progress-track rounded-2xl flex items-center justify-between gap-4 shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-surface-primary border border-progress-track flex items-center justify-center text-xl shrink-0">
                            {req.sender.avatar}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-kaos-offwhite block">{req.sender.displayName}</span>
                            <span className="text-[10px] text-text-secondary">@{req.sender.handle} · Level {req.sender.level}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                          <button
                            onClick={() => handleDeclineRequest(req.id)}
                            className="px-3 py-1.5 rounded-xl bg-surface-primary border border-progress-track text-text-secondary hover:text-kaos-offwhite cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAcceptRequest(req.id, req.sender)}
                            className="px-3.5 py-1.5 rounded-xl bg-kaos-pink text-white cursor-pointer hover:opacity-95"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY C: SOCIAL NOTIFICATIONS LOGS */}
      <AnimatePresence>
        {showNotificationsModal && (
          <div
            onClick={() => setShowNotificationsModal(false)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3">
                <h3 className="text-sm font-black text-kaos-yellow uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined">notifications</span>
                  <span>Social Activity Inbox</span>
                </h3>
                <button
                  onClick={() => setShowNotificationsModal(false)}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {socialNotifications.map((not) => (
                  <div
                    key={not.id}
                    className={`p-3 border rounded-xl shadow-sm text-xs leading-relaxed ${not.colorClass}`}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold mb-1">
                      <span>{not.title}</span>
                      <span className="text-[9.5px] opacity-75 font-mono">{not.time}</span>
                    </div>
                    <p className="opacity-95">{not.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY D: SAFETY CONFIG */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div
            onClick={() => setShowPrivacyModal(false)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3">
                <h3 className="text-sm font-black text-kaos-red uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined">shield_lock</span>
                  <span>Safety & Privacy Center</span>
                </h3>
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-secondary uppercase">Blocked Users List</h4>
                  {blockedUsers.length === 0 ? (
                    <p className="text-xs text-text-secondary italic">Zero blocked explorers on your list.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {blockedUsers.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 bg-surface-secondary border border-progress-track rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm"
                        >
                          <span>{b.displayName} (@{b.handle})</span>
                          <button
                            onClick={() => handleUnblockUser(b.id)}
                            className="px-2.5 py-1 rounded bg-surface-primary hover:bg-kaos-teal hover:text-kaos-navy text-kaos-teal text-[10px] font-bold border border-kaos-teal/20"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-surface-secondary rounded-xl text-[11px] text-text-secondary leading-relaxed border border-progress-track">
                  Your current physical GPS coordinates, primary phone number, and explorer contact logs are strictly secured and never broadcasted to non-mutual contacts. Explore privately!
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: VIEW PROFILE */}
      <AnimatePresence>
        {viewingProfileUser && (
          <div
            onClick={() => setViewingProfileUser(null)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3 shrink-0">
                <h3 className="text-sm font-bold text-kaos-offwhite flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-kaos-pink animate-pulse">badge</span>
                  <span>Explorer Credentials</span>
                </h3>
                <button
                  onClick={() => setViewingProfileUser(null)}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-kaos-pink to-kaos-purple flex items-center justify-center text-3xl shadow-lg shrink-0">
                  {viewingProfileUser.avatar}
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-kaos-offwhite">{viewingProfileUser.displayName}</h4>
                  <p className="text-xs text-text-secondary">@{viewingProfileUser.handle}</p>
                  <p className="text-[10px] font-bold text-kaos-pink font-mono mt-2 uppercase tracking-wider bg-surface-secondary border border-kaos-pink/20 px-2.5 py-1 rounded-full w-fit">
                    {viewingProfileUser.badge}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-text-secondary leading-relaxed bg-surface-secondary p-4 rounded-2xl border border-progress-track shadow-inner">
                <p className="italic">"{viewingProfileUser.bio}"</p>
                <div className="grid grid-cols-2 gap-2 border-t border-progress-track/60 pt-2 text-[10px] font-mono">
                  <p>🏛️ QUESTS COMPLETED: <span className="font-bold text-kaos-offwhite">{viewingProfileUser.questsCompleted}</span></p>
                  <p>⭐ LEVEL ACHIEVED: <span className="font-bold text-kaos-yellow">Lv {viewingProfileUser.level}</span></p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs pt-2">
                <button
                  onClick={() => {
                    setReportingUser(viewingProfileUser);
                    setViewingProfileUser(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-transparent border border-kaos-red/30 text-kaos-red hover:text-kaos-offwhite hover:bg-kaos-red font-bold cursor-pointer"
                >
                  Report Explorer
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBlockUser(viewingProfileUser)}
                    className="px-3.5 py-2 rounded-xl bg-surface-secondary border border-progress-track text-text-secondary hover:text-kaos-offwhite font-bold cursor-pointer"
                  >
                    Block
                  </button>

                  <button
                    onClick={() => handleRemoveFriend(viewingProfileUser.id)}
                    className="px-4 py-2 rounded-xl bg-kaos-red text-white font-bold cursor-pointer hover:opacity-95"
                  >
                    Remove Friend
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: SAFETY REPORT */}
      <AnimatePresence>
        {reportingUser && (
          <div
            onClick={() => setReportingUser(null)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3">
                <h3 className="text-sm font-bold text-kaos-offwhite flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-kaos-red">gavel</span>
                  <span>Submit Safety Incident Report</span>
                </h3>
                <button
                  onClick={() => setReportingUser(null)}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary uppercase font-bold">Reporting User</label>
                  <p className="text-xs font-bold text-kaos-offwhite bg-surface-secondary p-2.5 rounded-xl border border-progress-track">
                    {reportingUser.displayName} (@{reportingUser.handle})
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary uppercase font-bold">Report Reason Category</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full bg-surface-secondary border border-progress-track rounded-xl px-3 py-2 text-xs text-kaos-offwhite focus:outline-none focus:border-kaos-pink"
                  >
                    <option value="Spam">Spam / Bots</option>
                    <option value="Harassment">Harassment / Bullying</option>
                    <option value="Inappropriate">Inappropriate Geo-evidence upload</option>
                    <option value="Impersonation">Impersonation</option>
                    <option value="Other">Other Issues</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary uppercase font-bold">Details (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Provide additional details regarding safety violations..."
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    className="w-full bg-surface-secondary border border-progress-track rounded-xl px-3 py-2.5 text-xs text-kaos-offwhite focus:outline-none resize-none"
                  />
                </div>

                <p className="text-[10px] text-text-secondary italic">
                  *Your identity will remain 100% confidential. Submitted reports are evaluated by faction server-moderators.
                </p>

                <div className="pt-2 flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setReportingUser(null)}
                    className="px-4 py-2 rounded-xl bg-surface-secondary border border-progress-track text-text-secondary font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-kaos-red text-white font-bold cursor-pointer hover:opacity-95"
                  >
                    Submit Confidential Report
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CREATE GROUP */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <div
            onClick={() => setShowCreateGroupModal(false)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-progress-track pb-3">
                <h3 className="text-base font-bold text-kaos-offwhite flex items-center gap-2">
                  <span className="material-symbols-outlined text-kaos-purple">groups</span>
                  <span>Form Faction Group Chat</span>
                </h3>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="text-text-muted hover:text-kaos-offwhite cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmCreateGroup} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary uppercase font-bold">Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Madras peaberry alliance"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    className="w-full bg-surface-secondary border border-progress-track focus:border-kaos-purple rounded-xl px-3 py-2.5 text-xs text-kaos-offwhite focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-text-secondary uppercase font-bold">Invite Initial Members</label>
                  <div className="max-h-36 overflow-y-auto border border-progress-track rounded-xl p-2.5 bg-surface-secondary space-y-1.5">
                    {myFriends.map((friend) => {
                      const selected = selectedFriendsForGroup.includes(friend.id);
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setSelectedFriendsForGroup((prev) => prev.filter((id) => id !== friend.id));
                            } else {
                              setSelectedFriendsForGroup((prev) => [...prev, friend.id]);
                            }
                          }}
                          className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                            selected ? 'bg-kaos-pink/15 text-kaos-pink font-bold' : 'hover:bg-surface-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{friend.avatar}</span>
                            <span>{friend.displayName} (@{friend.handle})</span>
                          </div>
                          <span className="material-symbols-outlined text-sm">
                            {selected ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(false)}
                    className="px-4 py-2 rounded-xl bg-surface-secondary border border-progress-track text-text-secondary font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-kaos-pink text-white font-bold cursor-pointer hover:opacity-95 animate-pulse"
                  >
                    Form Group Chat
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: MEMBER ACTION */}
      <AnimatePresence>
        {selectedGroupMemberAction && (
          <div
            onClick={() => setSelectedGroupMemberAction(null)}
            className="fixed inset-0 bg-kaos-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-primary border border-progress-track rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-error-bg text-kaos-red flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-kaos-offwhite">Remove Surveyor From Faction?</h4>
                <p className="text-xs text-text-secondary">
                  Are you sure you want to remove **{selectedGroupMemberAction.displayName}** from "{activeConv?.name}"? They will lose access to team quests immediately.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-bold pt-1">
                <button
                  onClick={() => setSelectedGroupMemberAction(null)}
                  className="px-4 py-2 rounded-xl bg-surface-secondary border border-progress-track text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleKickMember(selectedGroupMemberAction.id, activeConv?.name || 'group')}
                  className="px-4 py-2 rounded-xl bg-kaos-red text-white cursor-pointer hover:opacity-95"
                >
                  Yes, Remove Member
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default MessagesScreen;
