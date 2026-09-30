import React, { useState, useEffect } from 'react';
import {
  ActiveDailyChallenge,
  LocationAgnosticQuestion,
  getOrFetchActiveDailyChallenge,
  hasUserClaimedToday,
  claimDailyChallengeReward,
  getTodayCycleKey,
  getCycleTimeRemaining,
  UserClaimResult,
  getUserStreak,
  getUserChallengeClaims,
  DailyChallengeClaim,
  getDailyTopExplorers,
  LeaderboardEntry,
  getRecentGlobalCompletions,
  FeedEntry,
} from '../services/challengeService';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';

const formatRelativeTime = (isoString: string) => {
  if (!isoString) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
};

interface DailyDiscoveryChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToMapWithLocation?: (locationName: string) => void;
}

export const DailyDiscoveryChallengeModal: React.FC<DailyDiscoveryChallengeModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onNavigateToMapWithLocation,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [challenge, setChallenge] = useState<ActiveDailyChallenge | null>(null);
  const [alreadyClaimedToday, setAlreadyClaimedToday] = useState<boolean>(false);

  // Gamified Leaderboard & Hint states
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userXp, setUserXp] = useState<number>(1280);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [hintUnlocked, setHintUnlocked] = useState<boolean>(false);

  // Modal Step State: 'story' | 'quiz' | 'completed'
  const [currentStep, setCurrentStep] = useState<'story' | 'quiz' | 'completed'>('story');

  // Tab Navigation: 'quest' | 'feed'
  const [activeTab, setActiveTab] = useState<'quest' | 'feed'>('quest');
  const [feedCompletions, setFeedCompletions] = useState<FeedEntry[]>([]);
  const [feedLoading, setFeedLoading] = useState<boolean>(false);

  // Load global social completions feed when feed tab is opened
  useEffect(() => {
    if (activeTab === 'feed' && isOpen) {
      setFeedLoading(true);
      getRecentGlobalCompletions()
        .then((data) => {
          setFeedCompletions(data);
          setFeedLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load global feed completions:", err);
          setFeedLoading(false);
        });
    }
  }, [activeTab, isOpen]);

  // Quiz State
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [claimedXp, setClaimedXp] = useState<number>(0);
  const [completedClaims, setCompletedClaims] = useState<DailyChallengeClaim[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => new Date());
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('daily_quest_reminders_enabled') === 'true' && ('Notification' in window) && Notification.permission === 'granted';
    }
    return false;
  });

  // Time remaining until 24-hour cycle reset (Midnight IST)
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');

  // Countdown timer to midnight IST
  useEffect(() => {
    const updateTimer = () => {
      const { formatted } = getCycleTimeRemaining();
      setTimeLeftStr(formatted);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active 24-hour challenge and check if user has claimed today
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    async function loadData() {
      setLoading(true);
      const todayKey = getTodayCycleKey();

      const activeChallenge = await getOrFetchActiveDailyChallenge(todayKey);
      let claimed = false;
      let streak = 0;
      let claimsList: DailyChallengeClaim[] = [];
      let profileXp = 1280;

      if (user?.uid) {
        claimed = await hasUserClaimedToday(user.uid, todayKey);
        streak = await getUserStreak(user.uid);
        claimsList = await getUserChallengeClaims(user.uid);
        
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const profileSnap = await getDoc(doc(db, 'users', user.uid));
          if (profileSnap.exists()) {
            profileXp = profileSnap.data().xp || 1280;
          }
        } catch (e) {
          console.warn("Error loading user XP:", e);
        }
      } else {
        claimed = localStorage.getItem(`daily_claimed_guest_${todayKey}`) === 'true';
        const storedStreak = localStorage.getItem('daily_streak_guest') || '0';
        streak = parseInt(storedStreak, 10);
        const storedClaims = localStorage.getItem('daily_claims_guest');
        claimsList = storedClaims ? JSON.parse(storedClaims) : [];
        profileXp = parseInt(localStorage.getItem('daily_xp_guest') || '1280', 10);
      }

      const lbEntries = await getDailyTopExplorers(todayKey);
      const hintIsUnlocked = localStorage.getItem(`hint_unlocked_${user?.uid || 'guest'}_${todayKey}`) === 'true';

      if (isSubscribed) {
        setChallenge(activeChallenge);
        setAlreadyClaimedToday(claimed);
        setStreakDays(streak);
        setCompletedClaims(claimsList);
        setLeaderboard(lbEntries);
        setUserXp(profileXp);
        setHintUnlocked(hintIsUnlocked);
        setShowHint(hintIsUnlocked);

        if (claimed) {
          setCurrentStep('completed');
          setClaimedXp(activeChallenge.xpReward || 175);
        } else {
          setCurrentStep('story');
          setActiveQuestionIdx(0);
          setSelectedOptionIdx(null);
          setIsSubmitted(false);
          setCorrectAnswersCount(0);
          setQuizStartTime(null); // Reset timer on start
        }
        setLoading(false);
      }
    }

    loadData();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const currentQuestion: LocationAgnosticQuestion | undefined = challenge?.questions[activeQuestionIdx];

  const handleOptionSelect = (optionIdx: number) => {
    if (isSubmitted) return;
    triggerHaptic('light');
    setSelectedOptionIdx(optionIdx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOptionIdx === null || !currentQuestion || isSubmitted) return;

    setIsSubmitted(true);
    const isCorrect = selectedOptionIdx === currentQuestion.correctIndex;

    if (isCorrect) {
      triggerHaptic([60, 100, 140]);
      setCorrectAnswersCount((prev) => prev + 1);
      onShowToast('Correct! Knowledge Mastered 🎯', 'check_circle');
    } else {
      triggerHaptic('heavy');
      onShowToast('Incorrect. Review the explanation below.', 'error');
    }
  };

  const handleNextQuestion = async () => {
    if (!challenge) return;

    if (activeQuestionIdx < challenge.questions.length - 1) {
      triggerHaptic('medium');
      setActiveQuestionIdx((prev) => prev + 1);
      setSelectedOptionIdx(null);
      setIsSubmitted(false);
    } else {
      // Quiz complete! Calculate time spent
      triggerHaptic('legendary');
      const timeTakenSeconds = quizStartTime ? Math.round((Date.now() - quizStartTime) / 1000) : 45;
      const baseReward = challenge.xpReward || 175;
      const totalXp = baseReward + (correctAnswersCount * 25);

      if (user?.uid) {
        const claimRes: UserClaimResult = await claimDailyChallengeReward(user.uid, challenge, correctAnswersCount, totalXp, timeTakenSeconds);

        if (claimRes.status === 'already_claimed') {
          onShowToast(claimRes.message, 'warning');
          setAlreadyClaimedToday(true);
        } else if (claimRes.status === 'claimed_success') {
          const finalStreak = claimRes.newStreak || streakDays;
          if (claimRes.newStreak) setStreakDays(claimRes.newStreak);
          setClaimedXp(totalXp);
          setAlreadyClaimedToday(true);
          const todayKey = getTodayCycleKey();
          setCompletedClaims((prev) => [
            ...prev,
            {
              id: todayKey,
              userId: user.uid,
              dateKey: todayKey,
              challengeTitle: challenge.title,
              category: challenge.category,
              score: correctAnswersCount,
              xpEarned: totalXp,
              claimed: true,
              claimedAt: new Date().toISOString(),
            },
          ]);
          onShowToast(claimRes.message, 'celebration');

          // Fetch fresh leaderboard to show updated user rank
          try {
            const updatedLb = await getDailyTopExplorers(todayKey);
            setLeaderboard(updatedLb);
          } catch (lbErr) {
            console.warn('Leaderboard update deferred:', lbErr);
          }

          // Veteran Explorer badge check for logged-in user
          if (finalStreak >= 7) {
            localStorage.setItem(`unlocked_badge_stamp-veteran-explorer_${user.uid}`, 'true');
            try {
              const { doc, setDoc } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              await setDoc(doc(db, 'users', user.uid), { veteranBadgeUnlocked: true }, { merge: true });
            } catch (err) {
              console.warn('Could not persist badge to Firestore:', err);
            }
            setTimeout(() => {
              onShowToast("🎖️ Legendary Badge Unlocked: Veteran Explorer! (+350 XP)", "military_tech");
            }, 1600);
          }
        }
      } else {
        setClaimedXp(totalXp);
        const todayKey = getTodayCycleKey();

        // Guest streak logic
        const storedStreak = localStorage.getItem('daily_streak_guest') || '0';
        let currentStreak = parseInt(storedStreak, 10);
        const lastClaimDate = localStorage.getItem('daily_last_claim_date_guest');
        
        let newStreak = 1;
        if (lastClaimDate) {
          const lastDateObj = new Date(lastClaimDate);
          const todayDateObj = new Date(todayKey);
          const diffDays = Math.round((todayDateObj.getTime() - lastDateObj.getTime()) / (1000 * 3600 * 24));
          if (diffDays === 1) {
            newStreak = currentStreak + 1;
          } else if (diffDays === 0) {
            newStreak = currentStreak;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        localStorage.setItem('daily_streak_guest', String(newStreak));
        localStorage.setItem('daily_last_claim_date_guest', todayKey);
        localStorage.setItem(`daily_claimed_guest_${todayKey}`, 'true');
        setStreakDays(newStreak);

        const newClaim = {
          id: todayKey,
          userId: 'guest',
          dateKey: todayKey,
          challengeTitle: challenge.title,
          category: challenge.category,
          score: correctAnswersCount,
          xpEarned: totalXp,
          claimed: true,
          claimedAt: new Date().toISOString(),
        };

        const updatedClaims = [...completedClaims, newClaim];
        localStorage.setItem('daily_claims_guest', JSON.stringify(updatedClaims));
        setCompletedClaims(updatedClaims);
        
        onShowToast(`🎉 Daily Challenge Completed! +${totalXp} XP Claimed (Guest Session)`, 'celebration');

        // Add guest entry instantly to local leaderboard representation
        const guestEntry = {
          userId: 'guest',
          displayName: 'You (Guest)',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          timeTakenSeconds,
          score: correctAnswersCount,
          completedAt: new Date().toISOString(),
        };
        setLeaderboard((prev) => {
          const merged = [...prev.filter(x => x.userId !== 'guest'), guestEntry];
          merged.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.timeTakenSeconds - b.timeTakenSeconds;
          });
          return merged.slice(0, 5);
        });

        // Veteran Explorer badge check for guest
        if (newStreak >= 7) {
          localStorage.setItem(`unlocked_badge_stamp-veteran-explorer_guest`, 'true');
          setTimeout(() => {
            onShowToast("🎖️ Legendary Badge Unlocked: Veteran Explorer! (+350 XP)", "military_tech");
          }, 1600);
        }
      }

      setCurrentStep('completed');
    }
  };

  const handleShareStreak = async () => {
    triggerHaptic('medium');
    const shareText = `🔥 I'm on a ${streakDays}-day streak in Discover It! Just completed today's Daily Discovery Challenge: "${challenge?.title}". Try it now to master universal heritage and explore real-world locations! 🎯🗺️`;
    const shareTitle = `Discover It - Daily Explorer Streak`;
    const shareUrl = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        onShowToast('Streak shared successfully! 🚀', 'share');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share failed:', err);
          onShowToast('Could not share. Copied streak text instead!', 'info');
          try {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          } catch {}
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        onShowToast('Copied share text to clipboard! 📋', 'content_copy');
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
        onShowToast('Failed to copy. Try sharing manually!', 'error');
      }
    }
  };

  const handleToggleReminder = async () => {
    triggerHaptic('medium');
    if (!('Notification' in window)) {
      onShowToast('Your browser does not support notifications.', 'error');
      return;
    }

    if (Notification.permission === 'granted') {
      const nextState = !remindersEnabled;
      setRemindersEnabled(nextState);
      localStorage.setItem('daily_quest_reminders_enabled', String(nextState));
      onShowToast(
        nextState ? 'Daily reminders active! 🔔' : 'Daily reminders deactivated.',
        nextState ? 'notifications_active' : 'notifications_off'
      );
      if (nextState) {
        new Notification('Discover It', {
          body: '🔔 Daily Quest reminder active! We will alert you when tomorrow\'s learning quest is ready.',
          icon: '/app_icon.jpg'
        });
      }
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setRemindersEnabled(true);
        localStorage.setItem('daily_quest_reminders_enabled', 'true');
        onShowToast('Daily reminders active! 🔔', 'notifications_active');
        new Notification('Discover It', {
          body: '🔔 Daily Quest reminder active! We will alert you when tomorrow\'s learning quest is ready.',
          icon: '/app_icon.jpg'
        });
      } else {
        onShowToast('Notification permission was denied.', 'warning');
      }
    } else {
      onShowToast('Notification permission blocked. Enable in your browser settings to activate reminders.', 'warning');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();

    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Padding from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        dayNum: prevMonthTotalDays - i,
        isCurrentMonth: false,
        dateString: '',
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateString = `${year}-${monthStr}-${dayStr}`;

      days.push({
        dayNum: d,
        isCurrentMonth: true,
        dateString,
      });
    }

    // Padding for next month to complete the grid of 6 rows (42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        dateString: '',
      });
    }

    return days;
  };

  const renderCalendarView = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const days = getCalendarDays();
    const todayStr = getTodayCycleKey();

    const handlePrevMonth = () => {
      triggerHaptic('light');
      setCurrentCalendarDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
      triggerHaptic('light');
      setCurrentCalendarDate(new Date(year, month + 1, 1));
    };

    return (
      <div className="p-4 rounded-2xl bg-[#121214]/60 border border-[#26262b] space-y-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            <span>Progress Calendar</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white border border-[#2d2d34] transition-all cursor-pointer hover:bg-[#26262b]"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-zinc-200 font-mono select-none w-28 text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-lg bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white border border-[#2d2d34] transition-all cursor-pointer hover:bg-[#26262b]"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Weekday Names */}
        <div className="grid grid-cols-7 text-center text-[10px] font-mono font-bold text-[#9898a0] pb-1 border-b border-[#26262b]/60">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((dayObj, idx) => {
            if (!dayObj.isCurrentMonth) {
              return (
                <div
                  key={idx}
                  className="aspect-square flex items-center justify-center text-[10px] text-zinc-700 font-medium font-mono rounded-lg"
                >
                  {dayObj.dayNum}
                </div>
              );
            }

            const isCompleted = completedClaims.some((claim) => claim.dateKey === dayObj.dateString);
            const isToday = dayObj.dateString === todayStr;

            let cellClass = 'bg-[#18181c]/50 border border-transparent text-[#9898a0]';

            if (isCompleted) {
              cellClass = 'bg-orange-500/10 border border-orange-500/40 text-orange-400 font-bold';
            } else if (isToday) {
              cellClass = 'bg-[#1a1a1e] border border-dashed border-zinc-500 text-zinc-100 font-bold';
            }

            return (
              <div
                key={idx}
                className={`aspect-square relative flex flex-col items-center justify-center text-xs rounded-xl transition-all ${cellClass}`}
                title={isCompleted ? 'Challenge completed!' : isToday ? "Today's active challenge" : undefined}
              >
                <span className={isCompleted ? 'text-orange-300 font-bold' : ''}>
                  {dayObj.dayNum}
                </span>
                {isCompleted && (
                  <span className="material-symbols-outlined text-[10px] text-orange-400 font-bold absolute bottom-1 right-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                    local_fire_department
                  </span>
                )}
                {!isCompleted && isToday && (
                  <span className="absolute top-1 right-1 w-1 h-1 bg-emerald-400 rounded-full animate-ping"></span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-1.5 text-[10px] font-mono text-[#9898a0]">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-orange-400" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
            <span>Uncompleted</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Active Today</span>
          </div>
        </div>
      </div>
    );
  };

  const renderBadgeProgressBar = () => {
    const isUnlocked = streakDays >= 7;
    const progressPct = Math.min(100, (streakDays / 7) * 100);

    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1e1512] via-[#151418] to-[#121214] border border-orange-500/30 space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              isUnlocked 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-glow' 
                : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50'
            }`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                military_tech
              </span>
            </div>
            <div className="text-left">
              <span className="text-[9px] text-[#9898a0] uppercase block font-mono font-bold tracking-wider leading-none">
                Veteran Explorer Reward
              </span>
              <span className="text-xs font-bold text-white block mt-1 leading-none">
                {isUnlocked ? '🎖️ Veteran Explorer Badge Unlocked!' : 'Reach a 7-day streak to unlock'}
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            {streakDays}/7 Days ({Math.round(progressPct)}%)
          </span>
        </div>

        {/* The Progress Bar */}
        <div className="w-full bg-zinc-900/90 rounded-full h-3.5 overflow-hidden border border-zinc-800 p-[2px] shadow-inner">
          <div
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 h-full rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${progressPct}%` }}
          >
            {isUnlocked && (
              <span className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></span>
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#9898a0] leading-normal font-medium">
          {isUnlocked
            ? 'Outstanding consistency! The Veteran Explorer stamp is officially minted and active inside your Digital Passport.'
            : `Complete challenges for ${7 - streakDays} more consecutive day${7 - streakDays !== 1 ? 's' : ''} to mint this legendary badge and claim +350 XP!`}
        </p>
      </div>
    );
  };

  const handleGetHint = async () => {
    triggerHaptic('medium');
    const todayKey = getTodayCycleKey();

    if (hintUnlocked) {
      setShowHint(true);
      return;
    }

    if (userXp < 50) {
      onShowToast('Insufficient XP! You need at least 50 XP for a hint. 🪙', 'warning');
      return;
    }

    const newXp = userXp - 50;
    setUserXp(newXp);
    setHintUnlocked(true);
    setShowHint(true);

    localStorage.setItem(`hint_unlocked_${user?.uid || 'guest'}_${todayKey}`, 'true');
    if (user?.uid) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        await updateDoc(doc(db, 'users', user.uid), { xp: newXp });
      } catch (err) {
        console.warn('Could not deduct XP in Firestore:', err);
      }
    } else {
      localStorage.setItem('daily_xp_guest', String(newXp));
    }

    onShowToast('Subtle Clue Unlocked! -50 XP 🔍', 'lightbulb');
  };

  const renderHintSection = () => {
    if (!challenge) return null;

    return (
      <div className="p-4 rounded-2xl bg-[#121214]/65 border border-dashed border-orange-500/30 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              lightbulb
            </span>
            <span className="text-xs font-bold text-white font-headline">Subtle Clue Solver</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 bg-[#1a1a1e] px-2 py-0.5 rounded-md border border-[#2d2d34] font-bold">
            Balance: {userXp} XP
          </span>
        </div>

        {showHint ? (
          <div className="p-3.5 rounded-xl bg-orange-950/20 border border-orange-500/20 text-xs text-orange-200 leading-relaxed font-sans italic animate-fadeIn flex items-start gap-2.5">
            <span className="material-symbols-outlined text-orange-400 shrink-0 text-[18px]">psychology</span>
            <span>{challenge.hintClue || "No specific clue generated for this theme. Think conceptually!"}</span>
          </div>
        ) : (
          <button
            onClick={handleGetHint}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/35 hover:to-orange-600/35 text-amber-300 border border-amber-500/35 hover:border-orange-500/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">vpn_key</span>
            <span>Unlock Subtle Clue (Cost: 50 XP)</span>
          </button>
        )}
      </div>
    );
  };

  const renderLeaderboardSection = () => {
    if (leaderboard.length === 0) return null;

    return (
      <div className="p-4 rounded-2xl bg-[#121214]/60 border border-[#26262b] space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262b]/60 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">leaderboard</span>
            <span>Today's Top Explorers</span>
          </div>
          <span className="text-[9px] font-mono text-[#9898a0]">Fastest Correct Times</span>
        </div>

        <div className="space-y-2.5">
          {leaderboard.map((entry, idx) => {
            const isMe = entry.userId === user?.uid || (entry.userId === 'guest' && !user?.uid);
            return (
              <div
                key={entry.userId}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'bg-orange-500/10 border-orange-500/40 shadow-sm'
                    : 'bg-[#18181c]/40 border-[#26262b]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank Medallion */}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-black shrink-0 ${
                    idx === 0
                      ? 'bg-amber-400 text-black shadow-glow'
                      : idx === 1
                      ? 'bg-zinc-300 text-black'
                      : idx === 2
                      ? 'bg-orange-400 text-black'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {idx + 1}
                  </span>

                  {/* Avatar & Name */}
                  <img
                    src={entry.avatarUrl}
                    alt={entry.displayName}
                    className="w-7 h-7 rounded-lg object-cover border border-[#26262b]"
                  />
                  <span className={`text-xs font-bold ${isMe ? 'text-orange-400' : 'text-zinc-200'}`}>
                    {entry.displayName} {isMe && '(You)'}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  {/* Score Correctness indicator */}
                  <div className="flex items-center gap-0.5 text-[10px] font-bold text-[#9898a0]">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className={`material-symbols-outlined text-[11px] ${
                          i < entry.score ? 'text-emerald-400' : 'text-zinc-700'
                        }`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    ))}
                  </div>

                  {/* Speed elapsed */}
                  <span className="text-xs font-bold text-[#9898a0] bg-[#1a1a1e] px-2 py-0.5 rounded border border-[#2d2d34]/60">
                    {entry.timeTakenSeconds}s
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSocialFeedView = () => {
    if (feedLoading) {
      return (
        <div className="p-12 flex flex-col items-center justify-center space-y-3 text-center">
          <span className="material-symbols-outlined text-orange-400 text-3xl animate-spin">
            progress_activity
          </span>
          <p className="text-xs text-[#9898a0] font-semibold">
            Tuning into the explorer network...
          </p>
        </div>
      );
    }

    if (feedCompletions.length === 0) {
      return (
        <div className="p-12 flex flex-col items-center justify-center space-y-3 text-center border border-dashed border-[#26262b] rounded-2xl bg-[#121214]/40">
          <span className="material-symbols-outlined text-[#71717a] text-3xl">
            forum_off
          </span>
          <p className="text-xs text-[#9898a0] font-semibold">
            No recent global completions found. Be the first to share your journey!
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-[#26262b]/60 pb-2.5">
          <div>
            <h4 className="text-sm font-extrabold text-white font-headline flex items-center gap-1.5">
              <span className="material-symbols-outlined text-orange-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>public</span>
              <span>Live Global Completed Feed</span>
            </h4>
            <p className="text-[10px] text-[#9898a0] mt-0.5">Real-time status stream of active explorers</p>
          </div>
          <span className="text-[9px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20 font-bold uppercase animate-pulse">
            LIVE FEED
          </span>
        </div>

        <div className="space-y-3">
          {feedCompletions.map((entry, idx) => {
            const isMe = entry.userId === user?.uid || (entry.userId === 'guest' && !user?.uid);
            
            return (
              <div
                key={entry.userId + '-' + entry.completedAt + '-' + idx}
                className={`p-3.5 rounded-2xl border flex flex-col gap-3 transition-all duration-300 ${
                  isMe
                    ? 'bg-orange-950/15 border-orange-500/35 shadow-sm'
                    : 'bg-[#121214]/65 border-[#26262b]/80 hover:border-zinc-700/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={entry.avatarUrl}
                        alt={entry.displayName}
                        className="w-9 h-9 rounded-xl object-cover border border-[#2d2d34]"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#18181c] rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                        ✓
                      </span>
                    </div>
                    
                    <div className="text-left">
                      <span className={`text-xs font-bold block ${isMe ? 'text-orange-400' : 'text-zinc-200'}`}>
                        {entry.displayName} {isMe && '(You)'}
                      </span>
                      <span className="text-[10px] font-mono text-[#9898a0]">
                        {formatRelativeTime(entry.completedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Performance details */}
                    <div className="flex items-center gap-0.5 bg-[#1a1a1e] px-2 py-1 rounded-lg border border-[#2d2d34]/60">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className={`material-symbols-outlined text-[10px] ${
                            i < entry.score ? 'text-emerald-400 font-bold' : 'text-zinc-800'
                          }`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      ))}
                      <span className="text-[10px] font-mono font-bold text-zinc-300 ml-1.5 border-l border-zinc-800 pl-1.5">
                        {entry.timeTakenSeconds}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#141418]/60 border border-[#232328] text-left text-xs leading-relaxed text-[#c5c5cb] font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-[#9898a0] shrink-0 text-[16px] mt-0.5">explore</span>
                  <div className="min-w-0">
                    <span className="text-[9px] text-[#9898a0] block uppercase font-mono font-bold">Successfully Deciphered</span>
                    <span className="text-zinc-100 font-semibold line-clamp-1 block mt-0.5">
                      {entry.challengeTitle}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#18181c] rounded-3xl w-full max-w-2xl shadow-2xl border border-orange-500/40 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 bg-[#121214] border-b border-[#26262b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600/20 text-orange-400 border border-orange-500/40 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">local_fire_department</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold uppercase">
                  DAILY DISCOVERY
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Resets in {timeLeftStr}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="font-headline text-lg text-white font-bold">24-Hour AI Learning Quest</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                  <span className="material-symbols-outlined text-[12px] text-amber-400 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                  <span>{streakDays}d Streak</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Switcher for Quest vs Global Social Feed */}
        {challenge && !loading && (
          <div className="flex bg-[#121214] border-b border-[#26262b] p-1 gap-2 shrink-0">
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('quest');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'quest'
                  ? 'bg-orange-600/10 border border-orange-500/30 text-orange-400 font-bold font-headline'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: activeTab === 'quest' ? "'FILL' 1" : "'FILL' 0" }}>local_fire_department</span>
              <span>Daily Quest</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('feed');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-orange-600/10 border border-orange-500/30 text-orange-400 font-bold font-headline'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: activeTab === 'feed' ? "'FILL' 1" : "'FILL' 0" }}>forum</span>
              <span>Global Social Feed</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-center">
            <span className="material-symbols-outlined text-orange-400 text-4xl animate-spin">
              progress_activity
            </span>
            <p className="text-xs text-[#9898a0] font-semibold">
              Gemini AI is generating today's location-agnostic knowledge quest...
            </p>
          </div>
        ) : challenge ? (
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {activeTab === 'feed' ? (
              renderSocialFeedView()
            ) : (
              <>
            {/* STEP 1: THE LEARNING STORY */}
            {currentStep === 'story' && (
              <div className="space-y-4">
                {/* Hero Header Card */}
                <div className="relative rounded-2xl overflow-hidden h-48 w-full border border-[#26262b]">
                  <img
                    src={challenge.imageUrl}
                    alt={challenge.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#18181c] via-[#18181c]/40 to-transparent"></div>

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md text-orange-400 font-bold text-xs border border-white/10">
                      🌐 Location-Agnostic Quest
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md text-amber-300 font-bold text-xs border border-white/10">
                      {challenge.category}
                    </span>
                    {challenge.difficulty && (
                      <span className={`px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md font-bold text-xs border flex items-center gap-1.5 ${
                        challenge.difficulty === 'Easy'
                          ? 'text-emerald-400 border-emerald-500/30'
                          : challenge.difficulty === 'Hard'
                          ? 'text-rose-400 border-rose-500/30'
                          : 'text-amber-300 border-amber-500/30'
                      }`}>
                        <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {challenge.difficulty === 'Easy' ? 'signal_cellular_1_bar' : challenge.difficulty === 'Hard' ? 'signal_cellular_4_bar' : 'signal_cellular_3_bar'}
                        </span>
                        <span>{challenge.difficulty} Effort</span>
                      </span>
                    )}
                    {onNavigateToMapWithLocation && (
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          onClose();
                          onNavigateToMapWithLocation(challenge.category);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-orange-600 hover:bg-orange-500 backdrop-blur-md text-white font-bold text-xs border border-orange-400/30 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md"
                        title="Fly map camera and center daily quest cluster"
                      >
                        <span className="material-symbols-outlined text-[14px]">radar</span>
                        <span>Show on Map</span>
                      </button>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[10px] text-orange-400 font-mono font-bold uppercase tracking-wider block">
                      FEATURED UNIVERSAL KNOWLEDGE THEME
                    </span>
                    <h2 className="font-headline text-xl text-white font-extrabold leading-tight">
                      {challenge.theme}
                    </h2>
                  </div>
                </div>

                {/* Challenge Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26262b] pb-4">
                  <div>
                    <h1 className="font-headline text-2xl text-white font-bold">{challenge.title}</h1>
                    <p className="text-xs text-orange-400 font-semibold mt-1">{challenge.subtitle}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 bg-[#121214] border border-amber-500/20 px-3 py-2 rounded-xl">
                    <span className="material-symbols-outlined text-amber-500 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                    <div className="text-left font-mono">
                      <span className="text-[9px] uppercase text-[#9898a0] block font-bold leading-none">Consecutive Streak</span>
                      <span className="text-xs font-bold text-white leading-none mt-1 block">{streakDays} Day{streakDays !== 1 ? 's' : ''} Completed</span>
                    </div>
                  </div>
                </div>

                {/* AI Lore Story */}
                <div className="p-4 rounded-2xl bg-[#121214] border border-[#26262b] text-xs text-[#d1d1d6] leading-relaxed space-y-3">
                  {challenge.loreStory.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                {/* Key Learning Takeaway Box */}
                <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                    <span>Key Learning Takeaway</span>
                  </div>
                  <p className="text-xs text-orange-200 leading-relaxed font-sans">
                    {challenge.learningTakeaway}
                  </p>
                </div>

                {/* Daily Reminder Setup Block */}
                <div className="p-4 rounded-2xl bg-[#121214] border border-[#26262b] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20 shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        {remindersEnabled ? 'notifications_active' : 'notifications'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Daily Discovery Reminders</h4>
                      <p className="text-[10px] text-[#9898a0] mt-0.5">
                        Get notified automatically once a day when tomorrow's learning quest is ready!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleReminder}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all active:scale-95 cursor-pointer border ${
                      remindersEnabled
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#1a1a1e] border-[#2d2d34] text-zinc-300 hover:border-orange-500/40'
                    }`}
                  >
                    {remindersEnabled ? 'ACTIVE 🔔' : 'REMIND ME'}
                  </button>
                </div>

                {/* Monthly Progress Calendar */}
                {renderCalendarView()}

                {/* Veteran Explorer Streak Progress Bar */}
                {renderBadgeProgressBar()}

                {/* Subtle Clue Solver Hint Card */}
                {renderHintSection()}

                {/* Action CTA to Start Quiz */}
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    setQuizStartTime(Date.now());
                    setCurrentStep('quiz');
                  }}
                  className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">quiz</span>
                  <span>Start Knowledge Challenge (3 Questions)</span>
                </button>
              </div>
            )}

            {/* STEP 2: THE KNOWLEDGE QUIZ */}
            {currentStep === 'quiz' && currentQuestion && (
              <div className="space-y-4">
                {/* Question Progress Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#26262b]">
                  <span className="text-xs font-mono font-bold text-orange-400">
                    QUESTION {activeQuestionIdx + 1} OF {challenge.questions.length}
                  </span>
                  <div className="flex gap-1.5">
                    {challenge.questions.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-8 h-1.5 rounded-full transition-all ${
                          idx === activeQuestionIdx
                            ? 'bg-orange-500 shadow-sm'
                            : idx < activeQuestionIdx
                            ? 'bg-emerald-500'
                            : 'bg-[#26262b]'
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Question Text */}
                <div className="space-y-2">
                  <h3 className="font-headline text-lg text-white font-bold leading-snug">
                    {currentQuestion.question}
                  </h3>
                  <p className="text-[11px] text-[#9898a0]">
                    Select the correct answer based on the learning story you just read.
                  </p>
                </div>

                {/* Options List */}
                <div className="space-y-2.5 pt-1">
                  {currentQuestion.options.map((option: string, optIdx: number) => {
                    const isSelected = selectedOptionIdx === optIdx;
                    const isCorrect = optIdx === currentQuestion.correctIndex;

                    let btnClass = 'bg-[#121214] border-[#26262b] text-white hover:border-[#383842]';
                    if (isSelected) {
                      btnClass = 'bg-orange-600/20 border-orange-500 text-orange-300 ring-1 ring-orange-500/50';
                    }
                    if (isSubmitted) {
                      if (isCorrect) {
                        btnClass = 'bg-emerald-600/25 border-emerald-500 text-emerald-300 font-bold';
                      } else if (isSelected && !isCorrect) {
                        btnClass = 'bg-rose-600/25 border-rose-500 text-rose-300';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleOptionSelect(optIdx)}
                        disabled={isSubmitted}
                        className={`w-full p-4 rounded-2xl border text-xs font-semibold text-left transition-all flex items-center justify-between gap-3 active:scale-[0.99] cursor-pointer ${btnClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#1a1a1e] border border-[#26262b] text-[#9898a0] flex items-center justify-center font-mono text-[11px] shrink-0 font-bold">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{option}</span>
                        </div>

                        {isSubmitted && isCorrect && (
                          <span className="material-symbols-outlined text-emerald-400 text-[20px]">
                            check_circle
                          </span>
                        )}
                        {isSubmitted && isSelected && !isCorrect && (
                          <span className="material-symbols-outlined text-rose-400 text-[20px]">
                            cancel
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Card after submission */}
                {isSubmitted && (
                  <div className="p-4 rounded-2xl bg-[#121214] border border-[#26262b] space-y-1.5 animate-fadeIn">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block font-mono">
                      Educational Insight
                    </span>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}

                {/* Submit / Next Button */}
                {!isSubmitted ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={selectedOptionIdx === null}
                    className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>
                      {activeQuestionIdx < challenge.questions.length - 1
                        ? 'Next Question'
                        : 'Complete Challenge'}
                    </span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                )}

                {/* Subtle Clue Solver Hint Card inside Quiz */}
                <div className="pt-2 border-t border-[#26262b]/50">
                  {renderHintSection()}
                </div>
              </div>
            )}

            {/* STEP 3: CELEBRATION SCREEN */}
            {currentStep === 'completed' && (
              <div className="py-6 space-y-6 text-center animate-fadeIn">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-2xl mx-auto">
                    <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  </div>
                  <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono text-[10px] font-extrabold border-2 border-[#18181c]">
                    CLAIMED
                  </span>
                </div>

                <div>
                  <h2 className="font-headline text-2xl text-white font-extrabold">
                    Daily Challenge Completed!
                  </h2>
                  <p className="text-xs text-[#9898a0] mt-1">
                    You have mastered today's location-agnostic discovery lesson: "{challenge.title}".
                  </p>
                </div>

                {/* XP & Streak Rewards Grid */}
                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                  <div className="p-4 rounded-2xl bg-[#121214] border border-orange-500/30 text-center">
                    <span className="text-[10px] uppercase font-mono text-[#9898a0] block mb-1">
                      Total XP Gained
                    </span>
                    <span className="font-headline text-2xl text-orange-400 font-extrabold block">
                      +{claimedXp || (challenge.xpReward + 25)} XP
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#121214] border border-amber-500/30 text-center">
                    <span className="text-[10px] uppercase font-mono text-[#9898a0] block mb-1">
                      Explorer Streak
                    </span>
                    <span className="font-headline text-2xl text-amber-400 font-extrabold flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        local_fire_department
                      </span>
                      <span>{streakDays} Days</span>
                    </span>
                  </div>
                </div>

                {/* Badge Unlocked Card */}
                <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/30 flex items-center justify-center gap-3 max-w-sm mx-auto">
                  <span className="material-symbols-outlined text-orange-400 text-2xl">workspace_premium</span>
                  <div className="text-left">
                    <span className="text-[9px] uppercase text-orange-400 font-mono font-bold block">
                      Badge Unlocked
                    </span>
                    <span className="text-xs font-bold text-white block">{challenge.badgeReward}</span>
                  </div>
                </div>

                {/* Next Quest Countdown Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121214] to-[#131d18] border border-emerald-500/20 flex items-center justify-between gap-4 max-w-sm mx-auto shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                      <span className="material-symbols-outlined text-[20px] animate-pulse">schedule</span>
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] uppercase text-emerald-400 font-mono font-bold block tracking-wider leading-none">
                        Next Quest Unlock
                      </span>
                      <span className="text-xs font-bold text-zinc-300 block mt-1.5 leading-none">
                        New daily challenge loads in:
                      </span>
                    </div>
                  </div>
                  <div className="font-mono font-black text-emerald-400 text-xs tracking-wider bg-emerald-500/5 px-3 py-2 rounded-xl border border-emerald-500/10 shadow-inner shrink-0">
                    {timeLeftStr}
                  </div>
                </div>

                {/* Veteran Explorer Streak Progress Bar */}
                <div className="max-w-sm mx-auto w-full">
                  {renderBadgeProgressBar()}
                </div>

                {/* Progress Calendar */}
                <div className="max-w-sm mx-auto w-full">
                  {renderCalendarView()}
                </div>

                {/* Daily Top Explorers Leaderboard */}
                <div className="max-w-sm mx-auto w-full">
                  {renderLeaderboardSection()}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5 max-w-sm mx-auto pt-2">
                  <button
                    onClick={handleShareStreak}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
                  >
                    <span className="material-symbols-outlined text-[16px]">share</span>
                    <span>Share Streak with Friends</span>
                  </button>

                  <div className="flex gap-2 w-full">
                    {onNavigateToMapWithLocation && (
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          onClose();
                          onNavigateToMapWithLocation(challenge.category);
                        }}
                        className="flex-1 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 border border-orange-500/30 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">radar</span>
                        <span>Show on Map</span>
                      </button>
                    )}

                    <button
                      onClick={onClose}
                      className="flex-1 py-3.5 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
