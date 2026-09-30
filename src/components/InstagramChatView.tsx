import React, { useState, useRef, useEffect } from 'react';
import { ChatThread, DirectMessage } from '../types';
import { GoogleGenAI } from '@google/genai';
import { triggerHaptic } from '../lib/haptic';

interface InstagramChatViewProps {
  thread: ChatThread;
  onBack: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onUpdateThreadMessages?: (updatedMessages: DirectMessage[]) => void;
}

export const InstagramChatView: React.FC<InstagramChatViewProps> = ({ thread, onBack, onShowToast, onUpdateThreadMessages }) => {
  const [messages, setMessages] = useState<DirectMessage[]>(thread.messages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    onUpdateThreadMessages?.(messages);
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userMsgText = inputText.trim();
    setInputText('');
    triggerHaptic('light');

    const newMsg: DirectMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      senderName: 'You',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    const updated = [...messages, newMsg];
    setMessages(updated);

    // If chatting with the DÌ AI Explorer Bot, generate a hyper-context-aware Gen Z response!
    if (thread.type === 'ai_bot') {
      setIsTyping(true);
      try {
        const ai = new GoogleGenAI();
        const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: `You are "DÌ AI Explorer Bot", a hyper-knowledgeable, effortlessly cool Chennai city insider who speaks fluent Gen Z slang + Madras vibes.
          
Key Personality & Language Style:
- Use authentic Gen Z slang naturally: "no cap", "it's giving main character energy", "fr fr", "lowkey/highkey", "bet", "slay", "rizz", "certified banger", "aesthetic on point", "valid", "cooked", "say less", "core memory unlocked", mixed with Chennai phrases ("semma vibe macha", "filter coffee drip", "pure dopamine").
- Be hyper context-aware: if the user mentions any available time (e.g. "15 mins", "got 40m before my bus", "2 hours"), budget, location, or mood, immediately tailor exact turn-by-turn spot recommendations, off-menu food orders, and photo angles for the gram.
- Keep responses snappy, punchy, fun, full of visual vibes and emojis.

User's message: "${userMsgText}"`
        });

        const replyText = response.text || "yo that's valid fr! pull up to the nearest heritage thinnai and sip some 80:20 filter brew no cap ☕✨";
        
        setIsTyping(false);
        const botMsg: DirectMessage = {
          id: `msg-${Date.now() + 1}`,
          senderId: 'ai-bot',
          senderName: 'DÌ AI Explorer Bot',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false,
          reactionEmoji: '🔥'
        };
        setMessages(prev => [...prev, botMsg]);
        triggerHaptic('medium');
      } catch {
        setIsTyping(false);
        const fallbackMsg: DirectMessage = {
          id: `msg-${Date.now() + 1}`,
          senderId: 'ai-bot',
          senderName: 'DÌ AI Explorer Bot',
          text: "say less bestie! slide over to Rayar's Mess for off-menu ghee podi idlis or check out the stained glass at Senate House. 10/10 aesthetic, no cap ✨☕",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false,
          reactionEmoji: '❤️'
        };
        setMessages(prev => [...prev, fallbackMsg]);
      }
    } else {
      // Simulate real friend reply
      setTimeout(() => {
        const friendReplies = [
          "Bet! Meet you there in 10 mins 🔥",
          "Bro that spot looks insane on the map! Omw",
          "Did you scan it with the Live Lens yet? Need those XP points haha",
          "Sending you filter coffee cheers right now ☕✨",
          "Wait no cap that’s actually valid, let’s do it!"
        ];
        const randomReply = friendReplies[Math.floor(Math.random() * friendReplies.length)];
        const replyMsg: DirectMessage = {
          id: `msg-${Date.now() + 1}`,
          senderId: thread.id,
          senderName: thread.name,
          text: randomReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false,
        };
        setMessages(prev => [...prev, replyMsg]);
        triggerHaptic('light');
      }, 1400);
    }
  };

  const handleReactToMessage = (msgId: string, emoji: string) => {
    triggerHaptic('medium');
    setMessages(prev =>
      prev.map(m => {
        if (m.id === msgId) {
          return { ...m, reactionEmoji: m.reactionEmoji === emoji ? undefined : emoji };
        }
        return m;
      })
    );
    setActiveReactionMsgId(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] sm:h-[82vh] bg-[#121214] text-white rounded-3xl overflow-hidden border border-[#26262b] shadow-2xl">
      {/* INSTAGRAM DM HEADER */}
      <div className="px-4 py-3 bg-[#18181c] border-b border-[#26262b] flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-[#121214] flex items-center justify-center text-[#9898a0] hover:text-white active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>

          <div className="relative">
            <img
              src={thread.avatar}
              alt={thread.name}
              className="w-10 h-10 rounded-full object-cover border border-[#32323a]"
            />
            {thread.isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#18181c] rounded-full"></span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight">{thread.name}</span>
              {thread.verifiedBadge && (
                <span className="material-symbols-outlined text-sky-400 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              )}
            </div>
            <span className="text-[11px] text-[#9898a0] block leading-none">
              {thread.isOnline ? 'Active now' : thread.lastSeen || `@${thread.username}`}
            </span>
          </div>
        </div>

        {/* Action Icons (Instagram Style: Audio, Video, Info) */}
        <div className="flex items-center gap-1 text-[#9898a0]">
          <button
            onClick={() => {
              onShowToast('Voice call feature connected via WebRTC!', 'call');
              triggerHaptic('light');
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:text-white hover:bg-[#26262b] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">call</span>
          </button>
          <button
            onClick={() => {
              onShowToast('Video expedition stream ready!', 'videocam');
              triggerHaptic('light');
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:text-white hover:bg-[#26262b] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">videocam</span>
          </button>
          <button
            onClick={() => {
              onShowToast(`Viewing info for @${thread.username}`, 'info');
              triggerHaptic('light');
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:text-white hover:bg-[#26262b] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">info</span>
          </button>
        </div>
      </div>

      {/* MESSAGES SCROLL CONTAINER */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#121214] no-scrollbar">
        {/* Profile Card at Top of Thread */}
        <div className="text-center py-6 space-y-2 border-b border-[#1a1a1e] mb-2">
          <img
            src={thread.avatar}
            alt={thread.name}
            className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-orange-500/40 shadow-lg"
          />
          <div className="flex items-center justify-center gap-1">
            <h4 className="font-headline text-lg font-bold text-white">{thread.name}</h4>
            {thread.verifiedBadge && (
              <span className="material-symbols-outlined text-sky-400 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
            )}
          </div>
          <span className="text-xs text-[#9898a0]">@{thread.username} • DÌ Chennai Explorer</span>
          {thread.type === 'ai_bot' && (
            <span className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
              ✨ Gen Z Context-Aware City Insider
            </span>
          )}
        </div>

        {/* Message Bubbles */}
        {messages.map((msg) => {
          const isMe = msg.isMe;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
            >
              <div
                onDoubleClick={() => handleReactToMessage(msg.id, '❤️')}
                onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                className={`max-w-[78%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative cursor-pointer select-none transition-all ${
                  isMe
                    ? 'bg-gradient-to-tr from-orange-600 via-rose-600 to-purple-600 text-white rounded-br-xs shadow-md'
                    : 'bg-[#26262b] text-[#f4f4f6] rounded-bl-xs border border-[#32323a]'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Reaction Badge */}
                {msg.reactionEmoji && (
                  <span className="absolute -bottom-2 right-2 bg-[#1a1a1e] border border-[#32323a] text-xs px-1.5 py-0.5 rounded-full shadow-md scale-95 animate-bounce">
                    {msg.reactionEmoji}
                  </span>
                )}
              </div>

              {/* Reaction Picker Bar (appears on tap) */}
              {activeReactionMsgId === msg.id && (
                <div className="flex gap-1.5 p-1.5 bg-[#1e1e24] border border-[#32323a] rounded-full shadow-2xl my-1 z-20 animate-scale-in">
                  {['❤️', '🔥', '☕', '😂', '✨', '🚀'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReactToMessage(msg.id, emoji)}
                      className="w-7 h-7 rounded-full hover:bg-[#26262b] text-sm flex items-center justify-center transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[9px] text-[#9898a0] mt-0.5 px-1">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-[#9898a0] text-xs py-1">
            <div className="w-8 h-8 rounded-full bg-[#26262b] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce"></span>
            </div>
            <span className="italic text-[11px]">{thread.name} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INSTAGRAM DM BOTTOM INPUT BAR */}
      <div className="p-3 bg-[#18181c] border-t border-[#26262b]">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Camera Button */}
          <button
            type="button"
            onClick={() => {
              onShowToast('Camera capture attached to DM 📸', 'photo_camera');
              triggerHaptic('light');
            }}
            className="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
          </button>

          {/* Text Input */}
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message (speak slang, ask spots, drop time)..."
              className="w-full bg-[#121214] text-white text-xs sm:text-sm pl-4 pr-20 py-2.5 rounded-full border border-[#26262b] focus:outline-none focus:border-orange-500"
            />

            {/* Quick Action Icons inside Input (Microphone / Sticker) */}
            <div className="absolute right-2 flex items-center gap-1 text-[#9898a0]">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
                    const SpeechRec = (window as any).webkitSpeechRecognition;
                    const recognition = new SpeechRec();
                    recognition.onstart = () => onShowToast('Listening for Gen Z prompts...', 'mic');
                    recognition.onresult = (event: any) => {
                      const transcript = event.results[0][0].transcript;
                      setInputText(transcript);
                    };
                    recognition.start();
                  } else {
                    onShowToast('Voice input ready!', 'mic');
                  }
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">mic</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onShowToast('Sent Chennai heritage filter coffee sticker! ☕', 'sentiment_satisfied');
                  triggerHaptic('light');
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">sentiment_satisfied</span>
              </button>
            </div>
          </div>

          {/* Send Button (Pops out when typing, Instagram style) */}
          {inputText.trim() ? (
            <button
              type="submit"
              className="px-3.5 py-2 rounded-full bg-gradient-to-r from-orange-600 to-pink-600 text-white font-bold text-xs shrink-0 active:scale-95 transition-transform shadow-md"
            >
              Send
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                handleSend();
              }}
              className="w-9 h-9 rounded-full bg-[#26262b] text-red-400 flex items-center justify-center shrink-0 hover:bg-[#32323a]"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                favorite
              </span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
