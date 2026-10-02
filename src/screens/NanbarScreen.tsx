import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../lib/firebase';
import { 
  subscribeConversations, 
  deleteConversation, 
  archiveConversation,
  Conversation 
} from '../services/chatService';
import { 
  subscribeIncomingRequests, 
  acceptFriendRequest, 
  declineFriendRequest,
  FriendRequest 
} from '../services/socialService';

import { PlayerSearchView } from '../components/PlayerSearchView';
import { createDirectConversation, ChatUser } from '../services/chatService';
import { MasterSpot } from '../types';
import { ChatDetailView } from '../components/ChatDetailView';

export interface NanbarScreenProps {
  onShowToast: (msg: string) => void;
  masterSpots?: MasterSpot[];
}

export const NanbarScreen: React.FC<NanbarScreenProps> = ({ onShowToast, masterSpots = [] }) => {
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  // Load conversations
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeConversations(auth.currentUser.uid, setConversations);
    return () => unsubscribe();
  }, []);

  // Load friend requests
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeIncomingRequests(auth.currentUser.uid, setFriendRequests);
    return () => unsubscribe();
  }, []);

  const handleAcceptRequest = async (req: FriendRequest) => {
    if (!auth.currentUser) return;
    try {
      await acceptFriendRequest(req);
      
      // Create a direct conversation automatically upon connection
      const targetUser: ChatUser = {
        id: req.senderId,
        displayName: req.senderName,
        avatarUrl: req.senderAvatar
      };
      
      await createDirectConversation(auth.currentUser.uid, targetUser);
      
      onShowToast(`Connected with ${req.senderName}!`);
    } catch (err) {
      console.error('Accept error:', err);
      onShowToast('Failed to connect.');
    }
  };

  const handleDeclineRequest = async (reqId: string) => {
    try {
      await declineFriendRequest(reqId);
      onShowToast('Request declined.');
    } catch (err) {
      onShowToast('Failed to decline.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      onShowToast('Conversation deleted.');
    } catch (err) {
      onShowToast('Failed to delete.');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveConversation(id);
      onShowToast('Conversation archived.');
    } catch (err) {
      onShowToast('Failed to archive.');
    }
  };

  if (activeConvId) {
    const conversation = conversations.find(c => c.id === activeConvId);
    if (conversation) {
      return (
        <ChatDetailView 
          conversation={conversation} 
          onBack={() => setActiveConvId(null)} 
          onShowToast={onShowToast}
        />
      );
    }
  }

  if (isSearching) {
    return (
      <PlayerSearchView 
        onBack={() => setIsSearching(false)} 
        onShowToast={onShowToast} 
      />
    );
  }

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full w-full flex flex-col bg-background-primary text-kaos-offwhite">
      <div className="bg-gradient-to-r from-kaos-pink to-kaos-purple p-4 shadow-xl shrink-0 z-10 border-b border-white/5">
        <h2 className="text-lg font-black text-kaos-offwhite tracking-wider mb-3">INBOX</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button 
            onClick={() => setIsSearching(true)}
            className="px-3 py-1.5 rounded-xl bg-kaos-navy/80 hover:bg-kaos-navy text-kaos-teal font-extrabold text-[10px] flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer border border-kaos-teal/20 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[10px]">search</span>
            Search Players
          </button>
          <button className="px-3 py-1.5 rounded-xl bg-kaos-navy/80 hover:bg-kaos-navy text-kaos-pink font-extrabold text-[10px] flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer border border-kaos-pink/20 transition-all active:scale-95">
            <span className="material-symbols-outlined text-[10px]">group_add</span>
            Create Group
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-none pb-20">
          {/* Friend Requests Section */}
          {friendRequests.length > 0 && (
            <div className="p-4 border-b border-progress-track bg-surface-secondary/20">
               <div className="flex items-center gap-2 mb-3">
                 <span className="w-1 h-1 rounded-full bg-kaos-pink animate-pulse"></span>
                 <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Incoming Requests ({friendRequests.length})</h3>
               </div>
               <div className="flex flex-col gap-2">
                 {friendRequests.map((req) => (
                   <div key={req.id} className="flex items-center justify-between p-3 bg-surface-secondary/50 rounded-2xl border border-white/5 backdrop-blur-sm group hover:border-kaos-pink/30 transition-all">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-kaos-navy flex items-center justify-center text-sm shadow-inner border border-white/10">
                         {req.senderAvatar || '👤'}
                       </div>
                       <div className="flex flex-col">
                         <span className="text-xs font-black text-kaos-offwhite">{req.senderName}</span>
                         <span className="text-[9px] font-bold text-text-secondary uppercase tracking-tighter">LVL {req.senderLevel} EXPLORER</span>
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <button 
                         onClick={() => handleAcceptRequest(req)}
                         className="px-3 py-1.5 text-[9px] font-black text-kaos-teal bg-kaos-teal/10 rounded-lg hover:bg-kaos-teal hover:text-kaos-navy transition-all"
                       >
                         ACCEPT
                       </button>
                       <button 
                         onClick={() => handleDeclineRequest(req.id)}
                         className="px-3 py-1.5 text-[9px] font-black text-kaos-pink bg-kaos-pink/10 rounded-lg hover:bg-kaos-pink hover:text-kaos-navy transition-all"
                       >
                         REJECT
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
          
          <div className="p-4 py-3 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Recent Transmissions</h3>
            <button className="text-[9px] font-bold text-kaos-purple uppercase tracking-widest opacity-60">Mark All Read</button>
          </div>

          <div className="flex flex-col">
            <AnimatePresence mode="popLayout">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <span className="material-symbols-outlined text-5xl mb-2">inbox</span>
                  <p className="text-xs font-black uppercase tracking-tighter">Frequency Silent.</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <motion.div 
                    key={conv.id} 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="relative w-full overflow-hidden"
                  >
                    <div className="absolute inset-0 flex justify-end items-center bg-surface-secondary">
                      <button onClick={() => handleArchive(conv.id)} className="h-full px-6 text-[10px] font-black uppercase tracking-widest text-kaos-teal bg-surface-secondary/50 hover:bg-kaos-teal hover:text-kaos-navy transition-all">Archive</button>
                      <button onClick={() => handleDelete(conv.id)} className="h-full px-6 text-[10px] font-black uppercase tracking-widest text-kaos-pink bg-surface-secondary/80 hover:bg-kaos-pink hover:text-kaos-navy transition-all">Delete</button>
                    </div>
                    <motion.button
                      drag="x"
                      dragConstraints={{ left: -160, right: 0 }}
                      dragDirectionLock
                      onClick={() => setActiveConvId(conv.id)}
                      className="relative w-full p-4 bg-background-primary flex items-center gap-4 hover:bg-white/5 active:bg-white/10 transition-colors border-b border-white/5"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center text-xl shrink-0 border border-white/10 shadow-lg">
                          {conv.avatar || '👤'}
                        </div>
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-kaos-pink text-kaos-navy rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background-primary animate-bounce">
                            {conv.unreadCount}
                          </div>
                        ) : (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-kaos-teal rounded-full border-2 border-background-primary shadow-[0_0_5px_#2DD4BF]"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-black text-kaos-offwhite truncate tracking-tight">{conv.name}</h4>
                          <span className="text-[9px] font-bold text-text-secondary opacity-50">{formatRelativeTime(conv.lastMessage?.createdAt || conv.updatedAt)}</span>
                        </div>
                        <p className={`text-[11px] truncate ${conv.unreadCount && conv.unreadCount > 0 ? 'text-kaos-offwhite font-bold' : 'text-text-secondary opacity-60'}`}>
                          {conv.lastMessage?.text || 'No messages yet.'}
                        </p>
                      </div>
                    </motion.button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NanbarScreen;
