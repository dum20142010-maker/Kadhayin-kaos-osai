import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Conversation,
  ChatMessage,
  ChatUser,
  ChatAttachment,
  MessageType,
} from '../types/chat';
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  CURRENT_USER,
  EXPLORER_DIRECTORY,
  createDirectConversation,
  createGroupConversation,
  markConversationAsRead,
  toggleMuteConversation,
  renameGroup,
  removeMemberFromGroup,
  addMembersToGroup,
  leaveGroup,
  deleteMessage,
} from '../services/chatService';
import { MasterSpot } from '../types';

interface MessagesScreenProps {
  onShowToast: (msg: string) => void;
  onSelectSpot?: (spot: MasterSpot) => void;
  onSelectQuest?: (quest: any) => void;
  onNavigateToMap?: (lat?: number, lng?: number) => void;
  initialConversationId?: string | null;
  masterSpots?: MasterSpot[];
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  onShowToast,
  onSelectSpot,
  onSelectQuest,
  onNavigateToMap,
  initialConversationId,
  masterSpots = [],
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  const [inputText, setInputText] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // New Group State
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200');
  const [selectedUserIdsForGroup, setSelectedUserIdsForGroup] = useState<string[]>([]);

  // Selected Message Options Popup
  const [selectedMsgForMenu, setSelectedMsgForMenu] = useState<ChatMessage | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Subscribe to Conversation List
  useEffect(() => {
    const unsubscribe = subscribeConversations(CURRENT_USER.id, (list) => {
      setConversations(list);
      if (!activeConvId && list.length > 0) {
        setActiveConvId(list[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Messages inside active conversation
  useEffect(() => {
    if (!activeConvId) return;

    markConversationAsRead(activeConvId, CURRENT_USER.id);

    const unsubscribe = subscribeMessages(activeConvId, (msgList) => {
      setMessages(msgList);
    });

    return () => unsubscribe();
  }, [activeConvId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  // Search filtering
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.lastMessage && c.lastMessage.text.toLowerCase().includes(q)) ||
      (c.lastMessage && c.lastMessage.senderName.toLowerCase().includes(q))
    );
  });

  const filteredMessages = messages.filter((m) => {
    const q = inChatSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return m.text.toLowerCase().includes(q) || (m.attachment && m.attachment.title.toLowerCase().includes(q));
  });

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedPhotoPreview) return;
    if (!activeConvId) return;

    const textToSend = inputText;
    const photoToSend = selectedPhotoPreview;

    setInputText('');
    setSelectedPhotoPreview(null);
    setShowAttachmentMenu(false);

    try {
      if (photoToSend) {
        const imageAttachment: ChatAttachment = {
          type: 'image',
          id: 'img_' + Date.now(),
          title: 'Photo Attachment',
          imageUrl: photoToSend,
        };
        await sendMessage(activeConvId, CURRENT_USER, textToSend || 'Sent an image photo', imageAttachment, 'image');
      } else {
        await sendMessage(activeConvId, CURRENT_USER, textToSend, undefined, 'text');
      }
    } catch (err) {
      onShowToast('Failed to send message.');
    }
  };

  // Start direct conversation with contact
  const handleStartDirectChat = async (user: ChatUser) => {
    setIsNewChatModalOpen(false);
    try {
      const conv = await createDirectConversation(CURRENT_USER.id, user);
      setActiveConvId(conv.id);
      onShowToast(`Opened conversation with ${user.displayName}`);
    } catch (e) {
      onShowToast('Error starting chat.');
    }
  };

  // Create group chat
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      onShowToast('Please enter a group name.');
      return;
    }
    if (selectedUserIdsForGroup.length === 0) {
      onShowToast('Please select at least one group member.');
      return;
    }

    const selectedUsers = EXPLORER_DIRECTORY.filter((u) => selectedUserIdsForGroup.includes(u.id));
    try {
      const group = await createGroupConversation(
        CURRENT_USER.id,
        groupName,
        groupImage,
        selectedUsers
      );
      setActiveConvId(group.id);
      setIsNewGroupModalOpen(false);
      setGroupName('');
      setSelectedUserIdsForGroup([]);
      onShowToast(`Created group "${group.name}"`);
    } catch (e) {
      onShowToast('Error creating group.');
    }
  };

  // Quick Attach Spot / Quest / Location
  const handleQuickAttachSpot = (spot: MasterSpot) => {
    if (!activeConvId) return;
    const attachment: ChatAttachment = {
      type: 'place',
      id: spot.id,
      title: spot.title,
      description: spot.description,
      imageUrl: spot.imageUrl,
      location: spot.zone + ' Sector',
      extraData: { zone: spot.zone },
    };
    sendMessage(activeConvId, CURRENT_USER, `Check out ${spot.title}!`, attachment, 'place');
    setShowAttachmentMenu(false);
    onShowToast(`Attached ${spot.title} to chat`);
  };

  const handleQuickAttachLocation = () => {
    if (!activeConvId) return;
    const attachment: ChatAttachment = {
      type: 'map_location',
      id: 'loc_' + Date.now(),
      title: 'Current Live Geolocation',
      description: 'Chepauk Stadium Quadrangle',
      location: '13.0642° N, 80.2811° E',
      extraData: { lat: 13.0642, lng: 80.2811 },
    };
    sendMessage(activeConvId, CURRENT_USER, 'Sharing my active map coordinates', attachment, 'map_location');
    setShowAttachmentMenu(false);
    onShowToast('Shared location map pin to chat');
  };

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPhotoPreview(reader.result as string);
        setShowAttachmentMenu(false);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="pb-24 p-2 md:p-6 max-w-7xl mx-auto h-[calc(100vh-120px)] flex flex-col font-sans select-none">
      {/* 2-Panel Chat Layout Container */}
      <div className="flex-1 bg-[#1C1A1F] border border-[#26242C] rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl min-h-0">
        
        {/* LEFT PANEL: Conversation List & Search */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-[#26242C] flex flex-col bg-[#121114] ${
            activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Top Panel Header & Search Bar */}
          <div className="p-4 border-b border-[#26242C] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F05423]">forum</span>
                <span>Messages</span>
              </h2>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="w-8 h-8 rounded-xl bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="New Direct Chat"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                </button>
                <button
                  onClick={() => setIsNewGroupModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#F05423] to-[#FF8A00] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-md"
                  title="Create New Group Chat"
                >
                  <span className="material-symbols-outlined text-sm">group_add</span>
                  <span className="hidden sm:inline">New Group</span>
                </button>
              </div>
            </div>

            {/* Conversation Search Bar */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-zinc-500 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats, contacts, or messages..."
                className="w-full bg-[#1C1A1F] border border-[#26242C] rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-zinc-600">chat_bubble_outline</span>
                <p className="text-xs text-zinc-400 font-bold">No conversations found</p>
                <p className="text-[11px] text-zinc-600">Start a new 1-on-1 chat or group conversation</p>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#F05423] text-white text-xs font-bold hover:bg-[#d64a1e] transition-colors cursor-pointer"
                >
                  Start a Conversation
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = activeConvId === conv.id;
                const isMuted = conv.mutedUserIds?.includes(CURRENT_USER.id);

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full p-3 rounded-2xl text-left transition-all flex items-center justify-between cursor-pointer border ${
                      isActive
                        ? 'bg-[#1C1A1F] border-[#F05423]/60 text-white shadow-md'
                        : 'bg-transparent border-transparent hover:bg-[#1C1A1F]/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={
                            conv.imageUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                          }
                          alt={conv.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-[#26242C]"
                        />
                        {conv.type === 'group' && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md bg-[#F05423] text-white flex items-center justify-center text-[9px] shadow-sm">
                            <span className="material-symbols-outlined text-[10px]">groups</span>
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-white truncate">{conv.name}</h4>
                          {conv.lastMessage?.createdAt && (
                            <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                              {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                          {isMuted && (
                            <span className="material-symbols-outlined text-[12px] text-zinc-500">
                              notifications_off
                            </span>
                          )}
                          <span>
                            {conv.lastMessage
                              ? `${conv.lastMessage.senderName}: ${conv.lastMessage.text}`
                              : 'No messages yet'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {conv.unreadCount && conv.unreadCount > 0 ? (
                      <span className="ml-2 w-5 h-5 rounded-full bg-[#F05423] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                        {conv.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Active Chat Conversation View */}
        <div
          className={`flex-1 flex flex-col bg-[#1C1A1F] ${
            !activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* CHAT HEADER */}
              <div className="p-4 border-b border-[#26242C] bg-[#121114] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => setActiveConvId(null)}
                    className="md:hidden w-8 h-8 rounded-full bg-[#1C1A1F] border border-[#26242C] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                  </button>

                  <img
                    src={
                      activeConversation.imageUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                    }
                    alt={activeConversation.name}
                    className="w-10 h-10 rounded-2xl object-cover border border-[#26242C] shrink-0"
                  />

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate flex items-center gap-2">
                      <span>{activeConversation.name}</span>
                      {activeConversation.type === 'group' && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[9px] font-mono font-bold uppercase">
                          {activeConversation.participantIds.length} members
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      {activeConversation.type === 'group'
                        ? 'Group Conversation'
                        : 'Active Direct Message'}
                    </p>
                  </div>
                </div>

                {/* Header Action Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInChatSearch(!showInChatSearch)}
                    className="w-8 h-8 rounded-xl bg-[#1C1A1F] border border-[#26242C] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Search conversation"
                  >
                    <span className="material-symbols-outlined text-sm">search</span>
                  </button>

                  <button
                    onClick={async () => {
                      const newMutedState = await toggleMuteConversation(
                        activeConversation.id,
                        CURRENT_USER.id,
                        activeConversation.mutedUserIds
                      );
                      onShowToast(newMutedState ? 'Conversation muted' : 'Notifications unmuted');
                    }}
                    className="w-8 h-8 rounded-xl bg-[#1C1A1F] border border-[#26242C] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Toggle Mute Notifications"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {activeConversation.mutedUserIds?.includes(CURRENT_USER.id)
                        ? 'notifications_off'
                        : 'notifications'}
                    </span>
                  </button>

                  {activeConversation.type === 'group' && (
                    <button
                      onClick={() => setIsGroupInfoModalOpen(true)}
                      className="w-8 h-8 rounded-xl bg-[#1C1A1F] border border-[#26242C] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Group Info & Settings"
                    >
                      <span className="material-symbols-outlined text-sm">info</span>
                    </button>
                  )}
                </div>
              </div>

              {/* IN-CHAT SEARCH BAR OVERLAY */}
              <AnimatePresence>
                {showInChatSearch && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-2.5 bg-[#121114]/90 border-b border-[#26242C] flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inChatSearchQuery}
                      onChange={(e) => setInChatSearchQuery(e.target.value)}
                      placeholder="Search messages in this conversation..."
                      className="flex-1 bg-[#1C1A1F] border border-[#26242C] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423]"
                    />
                    <button
                      onClick={() => {
                        setShowInChatSearch(false);
                        setInChatSearchQuery('');
                      }}
                      className="text-xs text-zinc-400 hover:text-white px-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* MESSAGES SCROLL AREA */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {filteredMessages.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <span className="material-symbols-outlined text-4xl text-zinc-600">chat</span>
                    <h4 className="text-sm font-bold text-white">Start the conversation</h4>
                    <p className="text-xs text-zinc-500">
                      Send a greeting or share a place, quest, or trail attachment
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isMe = msg.senderId === CURRENT_USER.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 group`}
                      >
                        {/* Sender Name in Group Chat */}
                        {!isMe && activeConversation.type === 'group' && (
                          <span className="text-[10px] font-bold text-[#F05423] px-1">
                            {msg.senderName}
                          </span>
                        )}

                        <div className="flex items-center gap-2 max-w-[85%]">
                          {/* Options menu button on hover */}
                          {isMe && (
                            <button
                              onClick={() => setSelectedMsgForMenu(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-500 hover:text-white cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">more_vert</span>
                            </button>
                          )}

                          {/* Message Bubble Container */}
                          <div
                            className={`rounded-2xl p-3 text-xs leading-relaxed ${
                              isMe
                                ? 'bg-[#F05423] text-white rounded-tr-sm shadow-md'
                                : 'bg-[#121114] border border-[#26242C] text-zinc-200 rounded-tl-sm'
                            }`}
                          >
                            {/* Text Body */}
                            {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                            {/* ATTACHMENT CARDS */}
                            {msg.attachment && (
                              <div className="mt-2 p-2.5 rounded-xl bg-black/30 border border-white/10 space-y-2">
                                <div className="flex items-center gap-2.5">
                                  {msg.attachment.imageUrl ? (
                                    <img
                                      src={msg.attachment.imageUrl}
                                      alt={msg.attachment.title}
                                      onClick={() => setLightboxImage(msg.attachment?.imageUrl || null)}
                                      className="w-14 h-14 rounded-lg object-cover cursor-pointer border border-white/20 hover:scale-105 transition-transform"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
                                      <span className="material-symbols-outlined text-lg">
                                        {msg.attachment.type === 'place'
                                          ? 'location_on'
                                          : msg.attachment.type === 'quest'
                                          ? 'auto_awesome'
                                          : msg.attachment.type === 'trail'
                                          ? 'route'
                                          : 'map'}
                                      </span>
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <span className="text-[9px] font-mono uppercase font-bold text-amber-300 block">
                                      {msg.attachment.type} card
                                    </span>
                                    <h5 className="text-xs font-bold text-white truncate">
                                      {msg.attachment.title}
                                    </h5>
                                    {msg.attachment.description && (
                                      <p className="text-[10px] text-zinc-300 line-clamp-1">
                                        {msg.attachment.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Attachment Action Button */}
                                {msg.attachment.type === 'place' && (
                                  <button
                                    onClick={() => {
                                      const spotMatch = masterSpots.find((s) => s.id === msg.attachment?.id);
                                      if (spotMatch && onSelectSpot) {
                                        onSelectSpot(spotMatch);
                                      } else {
                                        onShowToast(`Opening ${msg.attachment?.title}...`);
                                      }
                                    }}
                                    className="w-full py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <span>View Place</span>
                                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                  </button>
                                )}

                                {msg.attachment.type === 'quest' && (
                                  <button
                                    onClick={() => {
                                      if (onSelectQuest) onSelectQuest({ title: msg.attachment?.title });
                                      onShowToast(`Quest "${msg.attachment?.title}" selected`);
                                    }}
                                    className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <span>Open Quest</span>
                                    <span className="material-symbols-outlined text-xs">auto_awesome</span>
                                  </button>
                                )}

                                {msg.attachment.type === 'map_location' && (
                                  <button
                                    onClick={() => {
                                      if (onNavigateToMap) onNavigateToMap(13.0642, 80.2811);
                                      onShowToast('Navigating to map coordinates');
                                    }}
                                    className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <span>View on AR Map</span>
                                    <span className="material-symbols-outlined text-xs">view_in_ar</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {!isMe && (
                            <button
                              onClick={() => setSelectedMsgForMenu(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-500 hover:text-white cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">more_vert</span>
                            </button>
                          )}
                        </div>

                        {/* Timestamp & Status Icon */}
                        <div className="flex items-center gap-1 px-1 text-[9px] font-mono text-zinc-500">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMe && (
                            <span className="material-symbols-outlined text-[12px] text-zinc-400">
                              {msg.status === 'sending'
                                ? 'schedule'
                                : msg.status === 'read'
                                ? 'done_all'
                                : 'done'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* PHOTO ATTACHMENT PREVIEW BANNER */}
              {selectedPhotoPreview && (
                <div className="p-3 bg-[#121114] border-t border-[#26242C] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedPhotoPreview}
                      alt="Selected preview"
                      className="w-12 h-12 rounded-xl object-cover border border-[#F05423]"
                    />
                    <div>
                      <span className="text-[10px] font-mono text-[#F05423] font-bold block">
                        Photo Ready
                      </span>
                      <p className="text-xs text-white">Press Send to post image</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPhotoPreview(null)}
                    className="text-zinc-400 hover:text-white text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* QUICK ATTACHMENT TRAY */}
              <AnimatePresence>
                {showAttachmentMenu && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-3 bg-[#121114] border-t border-[#26242C] grid grid-cols-2 sm:grid-cols-4 gap-2"
                  >
                    <label className="p-2.5 rounded-2xl bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] flex items-center gap-2 text-xs text-white cursor-pointer transition-all">
                      <span className="material-symbols-outlined text-[#F05423]">image</span>
                      <span>Attach Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoFileSelect}
                        className="hidden"
                      />
                    </label>

                    {masterSpots[0] && (
                      <button
                        onClick={() => handleQuickAttachSpot(masterSpots[0])}
                        className="p-2.5 rounded-2xl bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] flex items-center gap-2 text-xs text-white cursor-pointer transition-all truncate"
                      >
                        <span className="material-symbols-outlined text-amber-400">location_on</span>
                        <span className="truncate">Share {masterSpots[0].title}</span>
                      </button>
                    )}

                    <button
                      onClick={handleQuickAttachLocation}
                      className="p-2.5 rounded-2xl bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] flex items-center gap-2 text-xs text-white cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-cyan-400">my_location</span>
                      <span>Live GPS Map Pin</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CHAT INPUT COMPOSER */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-[#121114] border-t border-[#26242C] flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all cursor-pointer ${
                    showAttachmentMenu
                      ? 'bg-[#F05423] text-white border-[#F05423]'
                      : 'bg-[#1C1A1F] border-[#26242C] text-zinc-400 hover:text-white'
                  }`}
                  title="Share attachments"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Write a message or share an exploration card..."
                  className="flex-1 bg-[#1C1A1F] border border-[#26242C] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423] transition-colors"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() && !selectedPhotoPreview}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#F05423] to-[#FF8A00] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-md"
                >
                  <span>Send</span>
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#121114] border border-[#26242C] flex items-center justify-center text-[#F05423]">
                <span className="material-symbols-outlined text-3xl">chat</span>
              </div>
              <h3 className="text-base font-bold text-white">No active conversation selected</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Select a conversation from the list or start a new direct message or group chat.
              </p>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#F05423] text-white text-xs font-bold hover:bg-[#d64a1e] transition-colors cursor-pointer"
              >
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: NEW DIRECT CHAT MODAL */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
            onClick={() => setIsNewChatModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#F05423]">chat</span>
                  <span>Start New Chat</span>
                </h3>
                <button
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                {EXPLORER_DIRECTORY.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleStartDirectChat(user)}
                    className="w-full p-3 bg-[#121114] hover:bg-[#121114]/80 border border-[#26242C] rounded-2xl flex items-center justify-between transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-[#26242C]"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-white">{user.displayName}</h4>
                        <p className="text-[10px] text-zinc-400">{user.role}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-sm text-[#F05423]">send</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: NEW GROUP CHAT MODAL */}
      <AnimatePresence>
        {isNewGroupModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
            onClick={() => setIsNewGroupModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#F05423]">group_add</span>
                  <span>Create Group Chat</span>
                </h3>
                <button
                  onClick={() => setIsNewGroupModalOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Triplicane Coffee Pioneers"
                    className="w-full bg-[#121114] border border-[#26242C] rounded-2xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                    Select Members
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {EXPLORER_DIRECTORY.map((user) => {
                      const isSelected = selectedUserIdsForGroup.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUserIdsForGroup(
                                selectedUserIdsForGroup.filter((id) => id !== user.id)
                              );
                            } else {
                              setSelectedUserIdsForGroup([...selectedUserIdsForGroup, user.id]);
                            }
                          }}
                          className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#F05423]/10 border-[#F05423] text-white'
                              : 'bg-[#121114] border-[#26242C] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatarUrl}
                              alt={user.displayName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span className="text-xs font-bold">{user.displayName}</span>
                          </div>
                          <span className="material-symbols-outlined text-sm">
                            {isSelected ? 'check_box' : 'checkbox_outline_blank'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#26242C]">
                <button
                  onClick={() => setIsNewGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#121114] border border-[#26242C] text-zinc-400 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroup}
                  className="px-5 py-2 rounded-xl bg-[#F05423] text-white text-xs font-bold hover:bg-[#d64a1e] transition-colors cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: GROUP INFO & MANAGEMENT MODAL */}
      <AnimatePresence>
        {isGroupInfoModalOpen && activeConversation && activeConversation.type === 'group' && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
            onClick={() => setIsGroupInfoModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#26242C] pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#F05423]">info</span>
                  <span>Group Settings</span>
                </h3>
                <button
                  onClick={() => setIsGroupInfoModalOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="text-center space-y-2">
                <img
                  src={activeConversation.imageUrl}
                  alt={activeConversation.name}
                  className="w-16 h-16 rounded-2xl object-cover mx-auto border border-[#26242C]"
                />
                <h4 className="text-base font-bold text-white">{activeConversation.name}</h4>
                <p className="text-xs text-zinc-400 font-mono">
                  {activeConversation.participantIds.length} members
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-[10px] font-mono text-zinc-400 uppercase">Members List</h5>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {activeConversation.participantIds.map((pId) => {
                    const matchedUser = EXPLORER_DIRECTORY.find((u) => u.id === pId) || {
                      id: pId,
                      displayName: pId === CURRENT_USER.id ? 'You (Admin)' : 'Group Member',
                      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                    };

                    return (
                      <div
                        key={pId}
                        className="p-2.5 bg-[#121114] border border-[#26242C] rounded-2xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={matchedUser.avatarUrl}
                            alt={matchedUser.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-white">
                            {matchedUser.displayName}
                          </span>
                        </div>

                        {pId !== CURRENT_USER.id &&
                          activeConversation.createdBy === CURRENT_USER.id && (
                            <button
                              onClick={async () => {
                                await removeMemberFromGroup(activeConversation.id, pId);
                                onShowToast('Member removed');
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer font-bold"
                            >
                              Remove
                            </button>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#26242C] flex justify-between">
                <button
                  onClick={async () => {
                    await leaveGroup(activeConversation.id, CURRENT_USER.id);
                    setIsGroupInfoModalOpen(false);
                    setActiveConvId(null);
                    onShowToast('You left the group');
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold cursor-pointer hover:bg-rose-500/30 transition-colors"
                >
                  Leave Group
                </button>
                <button
                  onClick={() => setIsGroupInfoModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-[#F05423] text-white text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: MESSAGE OPTIONS POPUP */}
      <AnimatePresence>
        {selectedMsgForMenu && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
            onClick={() => setSelectedMsgForMenu(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1C1A1F] border border-[#26242C] rounded-2xl w-full max-w-xs p-3 space-y-2 shadow-2xl"
            >
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedMsgForMenu.text);
                  onShowToast('Text copied to clipboard!');
                  setSelectedMsgForMenu(null);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-[#26242C] text-left text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                <span>Copy Message</span>
              </button>

              {selectedMsgForMenu.senderId === CURRENT_USER.id && activeConvId && (
                <button
                  onClick={async () => {
                    await deleteMessage(activeConvId, selectedMsgForMenu.id);
                    onShowToast('Message deleted');
                    setSelectedMsgForMenu(null);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-rose-500/20 text-left text-xs font-bold text-rose-400 flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete Message</span>
                </button>
              )}

              <button
                onClick={() => setSelectedMsgForMenu(null)}
                className="w-full p-2 rounded-xl bg-[#121114] text-center text-xs font-bold text-zinc-400 cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX EXPANDED IMAGE MODAL */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <img
              src={lightboxImage}
              alt="Expanded view"
              className="max-w-full max-h-[90vh] rounded-2xl object-contain border border-white/20"
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
