import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  subscribeToMessages, 
  sendMessage, 
  markConversationAsRead,
  Message,
  Conversation 
} from '../services/chatService';

interface ChatDetailViewProps {
  conversation: Conversation;
  onBack: () => void;
  onShowToast: (msg: string) => void;
}

export const ChatDetailView: React.FC<ChatDetailViewProps> = ({ conversation, onBack, onShowToast }) => {
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages for active conversation
  useEffect(() => {
    if (!conversation.id) return;
    const unsubscribe = subscribeToMessages(conversation.id, setMessages);
    return () => unsubscribe();
  }, [conversation.id]);

  // Mark as read on entry
  useEffect(() => {
    if (conversation.id) {
      markConversationAsRead(conversation.id);
    }
  }, [conversation.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setMessageText('');
    try {
      const sender: ChatUser = {
        id: auth.currentUser?.uid || 'anonymous',
        displayName: auth.currentUser?.displayName || 'User',
        avatarUrl: '👤'
      };
      await sendMessage(conversation.id, sender, messageText);
    } catch (err) {
      console.error('Failed to send message:', err);
      onShowToast('Failed to send message.');
    }
  };

  // Helper for date formatting
  const formatMessageDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const dateKey = new Date(message.timestamp).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(message);
    return groups;
  }, {});

  return (
    <div className="h-full w-full flex flex-col bg-background-primary overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-kaos-pink to-kaos-purple p-4 flex items-center gap-3 shrink-0 shadow-lg z-10 border-b border-white/10">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-kaos-offwhite transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-lg border border-white/20 shadow-inner">
          {conversation.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-kaos-offwhite truncate tracking-tight">{conversation.name}</h2>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-kaos-teal shadow-[0_0_8px_#2DD4BF]"></span>
            <p className="text-[9px] font-bold text-kaos-teal uppercase tracking-widest opacity-80">Connected</p>
          </div>
        </div>
        <button className="text-kaos-offwhite/50 hover:text-kaos-offwhite">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-none">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center p-8">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-kaos-offwhite flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl">chat_bubble</span>
            </div>
            <p className="text-sm font-bold uppercase tracking-tighter">Signal clear.</p>
            <p className="text-[10px] mt-1">Begin your transmission.</p>
          </div>
        ) : (
          Object.keys(groupedMessages).map((dateKey) => (
            <div key={dateKey} className="flex flex-col gap-4">
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-[1px] bg-white/5"></div>
                <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest px-2">
                  {formatMessageDate(groupedMessages[dateKey][0].timestamp)}
                </span>
                <div className="flex-1 h-[1px] bg-white/5"></div>
              </div>
              
              {groupedMessages[dateKey].map((msg) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`group relative p-3.5 rounded-2xl max-w-[85%] shadow-lg transition-all duration-300 ${
                        isMe 
                          ? 'bg-gradient-to-br from-kaos-pink to-kaos-purple text-white rounded-tr-none hover:shadow-kaos-pink/20' 
                          : 'bg-surface-secondary text-kaos-offwhite rounded-tl-none border border-progress-track hover:border-kaos-purple/50'
                      }`}
                    >
                      <p className="text-[13px] leading-relaxed break-words font-medium">{msg.text}</p>
                    </div>
                    <div className={`flex items-center gap-1 mt-1.5 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[8px] font-bold text-text-secondary uppercase opacity-40">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && (
                        <span className={`material-symbols-outlined text-[10px] ${msg.status === 'read' ? 'text-kaos-teal' : 'text-text-secondary'}`}>
                          {msg.status === 'read' ? 'done_all' : 'done'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>
      
      {/* Composer Area */}
      <div className="p-4 bg-background-primary border-t border-white/5 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          <div className="flex-1 relative group">
            <input 
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full bg-surface-secondary/50 hover:bg-surface-secondary rounded-2xl py-3.5 px-5 text-xs text-kaos-offwhite border border-white/5 focus:border-kaos-pink/50 focus:outline-none focus:ring-1 focus:ring-kaos-pink/20 transition-all placeholder:text-text-secondary/50 shadow-inner"
              placeholder="Your message..."
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button type="button" className="text-text-secondary hover:text-kaos-teal transition-colors">
                <span className="material-symbols-outlined text-lg">image</span>
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={!messageText.trim()}
            className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
              messageText.trim() 
                ? 'bg-gradient-to-r from-kaos-pink to-kaos-purple text-white shadow-xl shadow-kaos-pink/30 scale-100 rotate-0' 
                : 'bg-surface-secondary text-text-secondary scale-90 opacity-40 -rotate-12'
            }`}
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};


export default ChatDetailView;
