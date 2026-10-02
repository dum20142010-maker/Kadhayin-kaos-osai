import React, { useState, useRef, useEffect } from 'react';
import { MasterSpot } from '../types';
import { KaosAppContext } from '../services/kaosContext';
import { motion } from 'framer-motion';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  actionableItem?: {
    type: 'spot' | 'quest' | 'screen';
    title: string;
    id?: string;
  };
}

interface KaosBotScreenProps {
  messages: Message[];
  onSendMessage: (text: string, context?: KaosAppContext) => void;
  loading: boolean;
  activeSpot: MasterSpot | null;
  activeQuest: any | null;
  appContext: KaosAppContext;
  onSpotSelected?: (spot: MasterSpot) => void;
  onShowToast: (msg: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const KaosBotScreen: React.FC<KaosBotScreenProps> = ({
  messages,
  onSendMessage,
  loading,
  activeSpot,
  activeQuest,
  appContext,
  onSpotSelected,
  onShowToast,
  onNavigateTab,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onShowToast('Speech Recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsRecording(true);
        onShowToast('Listening... Speak your message now.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition failed to start:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText, appContext);
    setInputText('');
  };

  // Context-aware suggestion chips based on what the user is currently looking at
  const suggestionChips = activeSpot
    ? [
        `Explain the architectural significance of ${activeSpot.title} 🏛️`,
        `What is the historical chronicle of ${activeSpot.title}? 📜`,
        `Suggest a walking trail starting from ${activeSpot.title} 🚶‍♂️`,
      ]
    : activeQuest
    ? [
        `How do I complete the quest "${activeQuest.title}"? 🎯`,
        `Give me historical hints for this active quest 💡`,
        `What nearby places relate to this quest? 📍`,
      ]
    : [
        "What should I explore in Chennai today? 🧭",
        "Suggest a filter coffee walking trail in Triplicane ☕",
        "What architectural style is Senate House? 🏛️",
        "Explain the cosmic alignments of Mylapore Teppakulam 🪔",
      ];

  return (
    <div className="pb-24 p-3 md:p-8 max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col font-sans select-none">
      {/* Upper Title banner with Active Context HUD */}
      <div className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl p-5 md:p-6 shadow-2xl mb-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-purple-400 text-2xl">smart_toy</span>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">KAOS AI Companion</h2>

            {/* Context-Aware Gemini AI Badge */}
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              <span>Gemini Neural AI</span>
            </span>
          </div>

          <p className="text-xs text-zinc-400 mt-1">
            Intelligent, application-aware guide for Chennai heritage, urban secrets, quests, and walking itineraries
          </p>
        </div>

        {/* Live Context Chip */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeSpot ? (
            <div className="flex items-center gap-2 bg-[#121114] border border-[#F05423]/50 px-3 py-1.5 rounded-xl text-xs shadow-md">
              <span className="text-[#F05423] font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">location_on</span>
                Focused Landmark:
              </span>
              <span className="text-white font-bold truncate max-w-[180px]">{activeSpot.title}</span>
            </div>
          ) : activeQuest ? (
            <div className="flex items-center gap-2 bg-[#121114] border border-cyan-500/50 px-3 py-1.5 rounded-xl text-xs shadow-md">
              <span className="text-cyan-400 font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                Active Quest:
              </span>
              <span className="text-white font-bold truncate max-w-[180px]">{activeQuest.title}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-[#121114] border border-[#26242C] px-3 py-1.5 rounded-xl text-xs">
              <span className="text-emerald-400 font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">explore</span>
                Active Screen:
              </span>
              <span className="text-zinc-300 capitalize">{appContext.currentScreen || 'Explore'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area Container */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex flex-col bg-[#1C1A1F] border border-[#26242C] rounded-3xl overflow-hidden h-full shadow-2xl">
          
          {/* Scrollable messages box */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin">
            {messages.map((msg, index) => {
              const isBot = msg.sender === 'bot';
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} space-y-1 group`}
                >
                  <div className="flex items-center gap-1.5 px-1">
                    {isBot && (
                      <span className="text-[10px] font-mono font-bold text-[#F05423] uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                        KAOS Bot · Gemini AI
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-[88%] md:max-w-[80%] rounded-2xl px-4 py-3.5 text-xs leading-relaxed ${
                      isBot
                        ? 'bg-[#121114] border border-purple-500/20 text-zinc-200 rounded-tl-sm shadow-sm'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-sm shadow-md'
                    }`}
                  >
                    {/* Render Formatted Markdown Body */}
                    {msg.text.split('\n').map((line, lIdx) => (
                      <p key={lIdx} className={lIdx > 0 ? 'mt-1.5' : ''}>
                        {line.split('**').map((chunk, cIdx) =>
                          cIdx % 2 === 1 ? (
                            <strong key={cIdx} className="font-bold text-white">
                              {chunk}
                            </strong>
                          ) : (
                            chunk
                          )
                        )}
                      </p>
                    ))}
                  </div>

                  <span className="text-[9px] text-zinc-500 px-1 font-mono">{msg.timestamp}</span>
                </motion.div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2.5 text-xs text-purple-400 font-mono p-3 bg-[#121114] border border-purple-500/30 rounded-2xl w-fit animate-pulse">
                <span className="material-symbols-outlined text-base animate-spin">smart_toy</span>
                <span>KAOS AI Companion is evaluating application context & historical vault...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Context Suggestion Chips */}
          <div className="p-3 bg-[#121114]/80 border-t border-[#26242C] flex items-center gap-2 overflow-x-auto scrollbar-none">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => onSendMessage(chip, appContext)}
                className="px-3.5 py-1.5 rounded-full bg-[#1C1A1F] hover:bg-[#26242C] border border-[#26242C] hover:border-[#F05423]/60 text-[11px] text-zinc-300 hover:text-white transition-all whitespace-nowrap cursor-pointer shrink-0 font-medium"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-[#121114] border-t border-[#26242C] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeSpot
                  ? `Ask KAOS Bot about ${activeSpot.title}...`
                  : 'Ask KAOS Bot about landmarks, walking routes, architectural styles, or coffee lore...'
              }
              className="flex-1 bg-[#1C1A1F] border border-[#26242C] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423] transition-colors"
            />
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title="Hold to Record Voice Message"
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border select-none shrink-0 ${
                isRecording
                  ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                  : 'bg-[#1C1A1F] border-[#26242C] text-zinc-300 hover:text-white hover:border-[#F05423]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {isRecording ? 'mic' : 'mic_none'}
              </span>
              <span className="hidden md:inline">{isRecording ? 'Recording...' : 'Hold to Record'}</span>
            </button>
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-[#F05423] to-[#FF8A00] hover:opacity-95 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <span>Ask</span>
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
