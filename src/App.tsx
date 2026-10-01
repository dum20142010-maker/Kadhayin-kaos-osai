import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Header } from './components/Header';
import { BottomBar, TabType } from './components/BottomBar';
import { ExploreScreen } from './screens/ExploreScreen';
import { MapScreen } from './screens/MapScreen';
import { SocialScreen } from './screens/SocialScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { KaosBotScreen } from './screens/KaosBotScreen';
import { SpotDetailModal } from './components/SpotDetailModal';
import { ShareToChatModal } from './components/ShareToChatModal';
import { SqlExplorerModal } from './components/SqlExplorerModal';
import { CommandPalette } from './components/CommandPalette';
import { SoundscapeMiniPlayer } from './components/SoundscapeMiniPlayer';
import { LevelUpCelebrationModal } from './components/LevelUpCelebrationModal';
import { ActiveQuestHud } from './components/ActiveQuestHud';
import { QuestBox } from './components/QuestBox';
import { SoundscapeProvider } from './context/SoundscapeContext';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { sqlDb } from './lib/sqlDatabase';
import { MasterSpot } from './types';
import { ChatAttachment } from './types/chat';
import { buildKaosContext, KaosAppContext } from './services/kaosContext';
import { KAOS_SPOTS } from './data/kaosData';

const tabVariants = {
  initial: {
    opacity: 0,
    y: 16,
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.99,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC-8sz-WC5Bh4KEuFafiB15MIPr2rE-1Mk';

export function AppContent() {
  const [currentTab, setCurrentTab] = useState<TabType>('explore');
  const [selectedSpot, setSelectedSpot] = useState<MasterSpot | null>(null);

  // Standalone Chat Sharing State
  const [shareToChatAttachment, setShareToChatAttachment] = useState<ChatAttachment | null>(null);
  const [targetChatConversationId, setTargetChatConversationId] = useState<string | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(2);

  // Recent user action telemetry tracker for KAOS Bot context
  const [recentActions, setRecentActions] = useState<string[]>(['Opened KAOS Exploration App']);

  // Globally persisted active dynamic quest states
  const [activeQuest, setActiveQuest] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('kaos_active_quest');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [sqlExplorerOpen, setSqlExplorerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Level & XP State
  const [level, setLevel] = useState<number>(() => sqlDb.getProfile().level || 1);
  const [xp, setXp] = useState<number>(() => sqlDb.getProfile().xp || 0);
  const [streak, setStreak] = useState<number>(() => sqlDb.getProfile().streak || 3);

  // Persistent, Globally maintained chat messages for KAOS Bot screen
  const [kaosBotMessages, setKaosBotMessages] = useState<any[]>([
    {
      sender: 'bot',
      text: "Greetings, Explorer! I am KAOS Bot, your application-aware Gemini AI Assistant. I understand what landmark you are viewing, your active quests, and your current task. Ask me anything about Chennai heritage, architectural lore, or walking itineraries!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [kaosLoading, setKaosLoading] = useState(false);
  const [levelUpCelebration, setLevelUpCelebration] = useState<{
    isOpen: boolean;
    level: number;
    xp: number;
  }>({
    isOpen: false,
    level: 1,
    xp: 0,
  });

  const { isOffline } = useOfflineStatus();

  // Track action helper
  const logAction = (action: string) => {
    setRecentActions((prev) => [...prev.slice(-6), action]);
  };

  // Initialize Client SQL Database on app startup
  useEffect(() => {
    sqlDb.init();
  }, []);

  const [showQuestBox, setShowQuestBox] = useState<boolean>(false);

  // Parse incoming deep-link (?spot=spotId) to auto-open shared discovery
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const spotId = params.get('spot');
        if (spotId) {
          const found = KAOS_SPOTS.find((s) => s.id === spotId);
          if (found) {
            setSelectedSpot(found);
            logAction(`Opened deep-linked spot: ${found.title}`);
            showToast(`Opened shared discovery: ${found.title} 🧭`);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse deep link query param:', e);
    }
  }, []);

  // Synchronize active spot in browser URL query parameters
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (selectedSpot) {
          url.searchParams.set('spot', selectedSpot.id);
          logAction(`Viewing landmark: ${selectedSpot.title}`);
        } else {
          url.searchParams.delete('spot');
        }
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [selectedSpot]);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K / / to open Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Send message to KAOS Bot with full structured application context
  const handleSendKaosBotMessage = async (text: string, overrideContext?: KaosAppContext) => {
    const clean = text.trim();
    if (!clean || kaosLoading) return;

    logAction(`Asked KAOS Bot: "${clean.substring(0, 30)}..."`);

    const userMsg = {
      sender: 'user',
      text: clean,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Append user message and placeholder bot message for live streaming updates
    const botPlaceholder = {
      sender: 'bot' as const,
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setKaosBotMessages((prev) => [...prev, userMsg, botPlaceholder]);
    setKaosLoading(true);

    const builtContext = overrideContext || buildKaosContext(
      currentTab,
      selectedSpot,
      activeQuest,
      { level, xp, streak },
      recentActions,
      kaosBotMessages
    );

    try {
      const res = await fetch('/api/kaos/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: kaosBotMessages,
          context: builtContext,
          stream: true,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataContent = line.slice(6).trim();
                if (dataContent === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataContent);
                  if (parsed.text) {
                    accumulatedText += parsed.text;
                    setKaosBotMessages((prev) => {
                      const copy = [...prev];
                      if (copy.length > 0 && copy[copy.length - 1].sender === 'bot') {
                        copy[copy.length - 1] = {
                          ...copy[copy.length - 1],
                          text: accumulatedText,
                        };
                      }
                      return copy;
                    });
                  }
                } catch {
                  // Ignore JSON parse error
                }
              }
            }
          }
        }
      } else {
        const data = await res.json();
        const fullText = data.reply || data.text || "I am connected to the KAOS platform vault.";
        setKaosBotMessages((prev) => {
          const copy = [...prev];
          if (copy.length > 0 && copy[copy.length - 1].sender === 'bot') {
            copy[copy.length - 1] = { ...copy[copy.length - 1], text: fullText };
          }
          return copy;
        });
      }
    } catch {
      setKaosBotMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].sender === 'bot') {
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            text: "I am currently syncing with local offline archives. Senate House and Mylapore temples remain accessible!",
          };
        }
        return copy;
      });
    } finally {
      setKaosLoading(false);
    }
  };

  const handleAwardXp = (amount: number, reason: string) => {
    setXp((prevXp) => {
      const nextXp = prevXp + amount;
      const calculatedLevel = Math.floor(nextXp / 500) + 1;

      sqlDb.saveProfile(calculatedLevel, nextXp, streak);

      if (calculatedLevel > level) {
        setLevel(calculatedLevel);
        setLevelUpCelebration({
          isOpen: true,
          level: calculatedLevel,
          xp: nextXp,
        });
      }
      return nextXp;
    });
    showToast(`+${amount} XP Unlocked: ${reason}! 🌟`);
  };

  const handleStartDynamicQuest = (spot: MasterSpot) => {
    setSelectedSpot(null);
    setShowQuestBox(true);
    logAction(`Started Dynamic Quest for ${spot.title}`);
    showToast(`Initiated Heritage Quest for ${spot.title}! 🎯`);
  };

  const handleVerifyQuest = () => {
    if (activeQuest) {
      const xpReward = activeQuest.xpReward || activeQuest.xp || 150;
      handleAwardXp(xpReward, `Completed Quest: ${activeQuest.title}`);
      logAction(`Completed Quest: ${activeQuest.title}`);
      localStorage.removeItem('kaos_active_quest');
      setActiveQuest(null);
      setShowQuestBox(false);
    } else {
      handleAwardXp(150, 'Completed Heritage Exploration Task');
      setShowQuestBox(false);
    }
  };

  const currentAppContext = buildKaosContext(
    currentTab,
    selectedSpot,
    activeQuest,
    { level, xp, streak },
    recentActions,
    kaosBotMessages
  );

  return (
    <SoundscapeProvider>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <div className="min-h-screen bg-[#121114] text-zinc-100 flex flex-col font-sans selection:bg-[#F05423]/30 selection:text-white">
          {/* Top Offline Notification Toast */}
          {isOffline && (
            <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-300 text-xs py-1.5 px-4 text-center font-mono font-medium flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">wifi_off</span>
              <span>Offline Mode Active: All 1,000+ Chennai places & soundscapes remain accessible</span>
            </div>
          )}

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1C1A1F]/95 border border-[#F05423]/50 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F05423] animate-ping" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Active Persistent Quest HUD Bar */}
          {activeQuest && !showQuestBox && (
            <ActiveQuestHud
              quest={activeQuest}
              onComplete={handleVerifyQuest}
              onSkip={() => {
                localStorage.removeItem('kaos_active_quest');
                setActiveQuest(null);
                showToast('Dynamic quest skipped.');
              }}
              onNavigateTab={(tab) => {
                setCurrentTab(tab);
                logAction(`Switched tab to ${tab}`);
              }}
              onShowToast={showToast}
            />
          )}

          {/* Header Bar */}
          <Header
            currentTab={currentTab}
            onTabSelected={(tab) => {
              if (tab === 'messages') setUnreadChatCount(0);
              setCurrentTab(tab);
              logAction(`Navigated to ${tab} tab`);
            }}
            level={level}
            streak={streak}
            onOpenSqlExplorer={() => setSqlExplorerOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            unreadChatCount={unreadChatCount}
          />

          {/* Main Animated View Area */}
          <main className="flex-1 w-full max-w-6xl mx-auto relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full h-full"
              >
                {currentTab === 'explore' && (
                  <ExploreScreen
                    onSpotSelected={(spot) => {
                      setSelectedSpot(spot);
                      logAction(`Selected spot ${spot.title}`);
                    }}
                    onAwardXp={handleAwardXp}
                    onShowToast={showToast}
                  />
                )}
                {currentTab === 'map' && (
                  <MapScreen onShowToast={showToast} onAwardXp={handleAwardXp} />
                )}
                {currentTab === 'messages' && (
                  <MessagesScreen
                    onShowToast={showToast}
                    onSelectSpot={(spot) => {
                      setSelectedSpot(spot);
                      logAction(`Selected spot ${spot.title} from chat`);
                    }}
                    onSelectQuest={(quest) => {
                      setActiveQuest(quest);
                      setShowQuestBox(true);
                      logAction(`Opened quest ${quest.title} from chat`);
                    }}
                    onNavigateToMap={() => setCurrentTab('map')}
                    initialConversationId={targetChatConversationId}
                    masterSpots={KAOS_SPOTS}
                  />
                )}
                {currentTab === 'social' && (
                  <SocialScreen
                    onShowToast={showToast}
                    onSpotSelected={(spot) => setSelectedSpot(spot)}
                  />
                )}
                {currentTab === 'profile' && (
                  <ProfileScreen
                    onShowToast={showToast}
                    onSpotSelected={(spot) => setSelectedSpot(spot)}
                  />
                )}
                {currentTab === 'assistant' && (
                  <KaosBotScreen
                    messages={kaosBotMessages}
                    onSendMessage={handleSendKaosBotMessage}
                    loading={kaosLoading}
                    activeSpot={selectedSpot}
                    activeQuest={activeQuest}
                    appContext={currentAppContext}
                    onSpotSelected={(spot) => setSelectedSpot(spot)}
                    onShowToast={showToast}
                    onNavigateTab={setCurrentTab}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Spot Detail & Audio Guide Modal */}
          <SpotDetailModal
            spot={selectedSpot}
            onClose={() => setSelectedSpot(null)}
            onShowToast={showToast}
            onStartQuest={handleStartDynamicQuest}
            onOpenShareToChat={(attachment) => setShareToChatAttachment(attachment)}
          />

          {/* Standalone Share to Messages Chat Modal */}
          <ShareToChatModal
            isOpen={!!shareToChatAttachment}
            onClose={() => setShareToChatAttachment(null)}
            attachment={shareToChatAttachment}
            onShowToast={showToast}
            onNavigateToChat={(convId) => {
              setTargetChatConversationId(convId);
              setUnreadChatCount(0);
              setCurrentTab('messages');
            }}
          />

          {showQuestBox && activeQuest && (
            <QuestBox
              quest={activeQuest}
              onVerify={handleVerifyQuest}
              onClose={() => setShowQuestBox(false)}
              onOpenShareToChat={(attachment) => setShareToChatAttachment(attachment)}
            />
          )}

          {/* SQL Deep Intelligence & Offline Database Modal */}
          <SqlExplorerModal
            isOpen={sqlExplorerOpen}
            onClose={() => setSqlExplorerOpen(false)}
            onShowToast={showToast}
          />

          {/* Global Instant Command Palette (Cmd+K) */}
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onSelectSpot={(spot) => setSelectedSpot(spot)}
            onNavigateTab={setCurrentTab}
            onOpenSqlExplorer={() => setSqlExplorerOpen(true)}
          />

          {/* Persistent Floating Soundscape Mini-Player */}
          <SoundscapeMiniPlayer
            onOpenSpotDossier={(spot) => setSelectedSpot(spot)}
          />

          {/* Level Up Celebration Modal */}
          <LevelUpCelebrationModal
            isOpen={levelUpCelebration.isOpen}
            newLevel={levelUpCelebration.level}
            totalXp={levelUpCelebration.xp}
            onClose={() =>
              setLevelUpCelebration((prev) => ({ ...prev, isOpen: false }))
            }
          />

          {/* Persistent Bottom Navigation */}
          <BottomBar
            currentTab={currentTab}
            onTabSelected={(tab) => {
              if (tab === 'messages') setUnreadChatCount(0);
              setCurrentTab(tab);
              logAction(`Switched to ${tab} tab`);
            }}
            unreadChatCount={unreadChatCount}
          />
        </div>
      </APIProvider>
    </SoundscapeProvider>
  );
}

export function App() {
  return <AppContent />;
}

export default App;
