import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface LocationAgnosticQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ActiveDailyChallenge {
  dateKey: string; // YYYY-MM-DD
  challengeId: string;
  title: string;
  subtitle: string;
  category: 'Universal Architecture' | 'Heritage Science' | 'Culinary Science' | 'Urban Cartography' | 'Acoustic Arts';
  theme: string;
  imageUrl: string;
  loreStory: string;
  learningTakeaway: string;
  questions: LocationAgnosticQuestion[];
  xpReward: number;
  badgeReward: string;
  createdAt: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  hintClue?: string;
}

export interface CompletionSubmissionResult {
  status: 'claimed_success' | 'already_claimed' | 'error';
  message: string;
  score?: number;
  xpEarned?: number;
  newTotalXp?: number;
  newStreak?: number;
  claimedAt?: string;
}

/**
 * Calculates current 24-hour cycle key (YYYY-MM-DD in IST / UTC+5:30)
 */
export function getTodayCycleKey(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 3600000 * 5.5);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns formatted time remaining until the next 24-hour reset (Midnight IST)
 */
export function getTimeUntilCycleReset(): { totalSeconds: number; formatted: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istNow = new Date(utc + 3600000 * 5.5);

  const istTomorrow = new Date(istNow);
  istTomorrow.setDate(istTomorrow.getDate() + 1);
  istTomorrow.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, istTomorrow.getTime() - istNow.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    totalSeconds,
    formatted: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
  };
}

const LOCATION_AGNOSTIC_THEMES = [
  {
    theme: 'Vimana vs. Gothic Vaults: Architectural Structural Physics',
    category: 'Universal Architecture',
    imageUrl: 'https://images.unsplash.com/photo-1548013146-72479768bbaa?w=600&auto=format&fit=crop&q=80',
  },
  {
    theme: 'Fermentation Science & Maillard Reactions in Heritage Flatbreads',
    category: 'Culinary Science',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  },
  {
    theme: 'Stepwell Engineering & Thermal Microclimates in Arid Civilizations',
    category: 'Heritage Science',
    imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80',
  },
  {
    theme: 'Grid vs. Organic Radiating Networks in Ancient Urban Planning',
    category: 'Urban Cartography',
    imageUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&auto=format&fit=crop&q=80',
  },
  {
    theme: 'Acoustic Resonance & Frequency Damping in Granite Sacred Pillars',
    category: 'Acoustic Arts',
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
  },
];

/**
 * Checks if a user has already completed/claimed the current day's challenge using Firestore
 */
export async function hasUserCompletedTodayChallenge(userId: string, dateKey?: string): Promise<boolean> {
  const activeDateKey = dateKey || getTodayCycleKey();

  try {
    const docRef = doc(db, 'users', userId, 'dailyChallengeClaims', activeDateKey);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().claimed === true) {
      return true;
    }
  } catch (err) {
    console.warn('Error checking daily challenge completion in Firestore:', err);
  }

  // Fallback check LocalStorage for fast offline feedback
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`daily_claimed_${userId}_${activeDateKey}`) === 'true';
  }

  return false;
}

/**
 * Saves the active daily challenge record in Firestore with a server timestamp
 */
export async function saveActiveDailyChallenge(challenge: ActiveDailyChallenge): Promise<void> {
  const activeDateKey = challenge.dateKey || getTodayCycleKey();
  const firestorePath = `dailyChallenges/${activeDateKey}`;

  try {
    const docRef = doc(db, 'dailyChallenges', activeDateKey);
    await setDoc(docRef, {
      ...challenge,
      serverCreatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not store active challenge in Firestore:', err);
    try {
      handleFirestoreError(err, OperationType.WRITE, firestorePath);
    } catch {}
  }
}

/**
 * Fetches today's active location-agnostic knowledge quest from Firestore, or generates
 * a new one from Gemini AI and persists the record with a timestamp.
 */
export async function fetchDailyKnowledgeQuest(dateKey?: string): Promise<ActiveDailyChallenge> {
  const activeDateKey = dateKey || getTodayCycleKey();

  // Deterministic difficulty generator for fallbacks or entries missing the field
  const difficulties: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];
  let hash = 0;
  for (let i = 0; i < activeDateKey.length; i++) {
    hash = (hash << 5) - hash + activeDateKey.charCodeAt(i);
    hash |= 0;
  }
  const deterministicDifficulty = difficulties[Math.abs(hash) % 3];

  const fallbackHints = [
    "Consider how structural geometry allows columns to support heavy vertical loads without buckling.",
    "Look closely at the biochemical process of yeast active cultures combined with high heat fermentation.",
    "Think about how thermal microclimates are created underground via evaporation and shadows.",
    "Examine how ancient grids divided urban sectors systematically to control flow and resources.",
    "Contemplate how resonant granite frequencies amplify and propagate pitch under acoustic pressure."
  ];
  const deterministicHint = fallbackHints[Math.abs(hash) % fallbackHints.length];

  // 1. Check if Firestore already contains today's active challenge
  try {
    const docRef = doc(db, 'dailyChallenges', activeDateKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        dateKey: activeDateKey,
        challengeId: data.challengeId || `challenge_${activeDateKey}`,
        title: data.title,
        subtitle: data.subtitle,
        category: data.category || 'Universal Architecture',
        theme: data.theme || 'Heritage Science',
        imageUrl: data.imageUrl,
        loreStory: data.loreStory,
        learningTakeaway: data.learningTakeaway,
        questions: data.questions,
        xpReward: data.xpReward || 175,
        badgeReward: data.badgeReward || '🔥 Daily Chronicler',
        createdAt: data.createdAt || new Date().toISOString(),
        difficulty: data.difficulty || deterministicDifficulty,
        hintClue: data.hintClue || deterministicHint,
      };
    }
  } catch (err) {
    console.warn('Could not read daily challenge from Firestore:', err);
  }

  const themeIndex = Math.abs(hash) % LOCATION_AGNOSTIC_THEMES.length;
  const selectedTheme = LOCATION_AGNOSTIC_THEMES[themeIndex];

  // 3. Fetch a new location-agnostic knowledge quest from Gemini AI via server proxy
  let generatedChallenge: ActiveDailyChallenge;

  try {
    const prompt = `You are the Lead Learning Architect & Universal Heritage Scientist for "Discover It".
Generate a location-agnostic, universal, highly educational 24-hour Daily Discovery Challenge for date (${activeDateKey}).

Theme: "${selectedTheme.theme}"
Category: "${selectedTheme.category}"

Requirements:
1. Make it LOCATION-AGNOSTIC and conceptual (focused on architectural physics, culinary science, urban design, acoustic engineering, or material conservation).
2. Title must be catchy and educational.
3. Write a compelling 2-paragraph loreStory introducing the science/history principles.
4. Provide a 1-sentence learningTakeaway summary.
5. Create 3 progressive multiple-choice questions testing core concepts with 4 options each, correctIndex (0-3), and explanations.
6. Rate the difficulty of this quest as either "Easy", "Medium", or "Hard".
7. Write a subtle, intriguing hintClue (1-2 sentences).

Return ONLY valid JSON.`;

    const res = await fetch('/api/ai/daily-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    if (data.text) {
      const parsed = JSON.parse(data.text);
      generatedChallenge = {
        dateKey: activeDateKey,
        challengeId: `challenge_${activeDateKey}`,
        title: parsed.title || `24-Hour Challenge: ${selectedTheme.theme}`,
        subtitle: parsed.subtitle || `Master universal heritage principles`,
        category: parsed.category || selectedTheme.category,
        theme: parsed.theme || selectedTheme.theme,
        imageUrl: selectedTheme.imageUrl,
        loreStory: parsed.loreStory || 'Universal principles of heritage and science.',
        learningTakeaway: parsed.learningTakeaway || 'Key architectural and cultural insight.',
        questions: parsed.questions && parsed.questions.length === 3 ? parsed.questions : getFallbackAgnosticQuestions(),
        xpReward: parsed.xpReward || 175,
        badgeReward: parsed.badgeReward || '🔥 Daily Chronicler',
        createdAt: new Date().toISOString(),
        difficulty: parsed.difficulty || deterministicDifficulty,
        hintClue: parsed.hintClue || deterministicHint,
      };
    } else {
      throw new Error('Empty AI response');
    }
  } catch (aiErr) {
    console.warn('Daily challenge fallback:', aiErr);
    generatedChallenge = {
      dateKey: activeDateKey,
      challengeId: `challenge_${activeDateKey}`,
      title: `24-Hour Challenge: ${selectedTheme.theme}`,
      subtitle: `Master universal principles of architectural physics and design`,
      category: selectedTheme.category as any,
      theme: selectedTheme.theme,
      imageUrl: selectedTheme.imageUrl,
      loreStory: `Across human history, monumental structures relied on fundamental principles of geometry, material science, and environment.`,
      learningTakeaway: `Universal engineering patterns connect ancient monuments across continents.`,
      questions: getFallbackAgnosticQuestions(),
      xpReward: 175,
      badgeReward: '🔥 Daily Chronicler',
      createdAt: new Date().toISOString(),
      difficulty: deterministicDifficulty,
      hintClue: deterministicHint,
    };
  }

  // 4. Save to Firestore
  await saveActiveDailyChallenge(generatedChallenge);

  return generatedChallenge;
}

function getFallbackAgnosticQuestions(): LocationAgnosticQuestion[] {
  return [
    {
      id: 1,
      question: 'Which structural component distributes weight laterally down arch pillars?',
      options: ['Keystone', 'Pediment', 'Frieze', 'Minaret'],
      correctIndex: 0,
      explanation: 'The keystone locks the arch and transfers downward force laterally to abutments.',
    },
    {
      id: 2,
      question: 'What property makes granite and stone ideal for ancient monumental foundations?',
      options: ['High Compressive Strength', 'High Elasticity', 'Lightweight Buoyancy', 'Thermal Flexibility'],
      correctIndex: 0,
      explanation: 'Granite withstands massive vertical compressive loads without deforming.',
    },
    {
      id: 3,
      question: 'How do natural passive cooling courtyards regulate temperature in tropical architecture?',
      options: ['Stack Effect Convection', 'Solar Heat Absorption', 'Refrigerated Insulation', 'Vacuum Pressurization'],
      correctIndex: 0,
      explanation: 'Hot air rises out of open courtyard roofs, pulling cooler shade air through lower chambers.',
    },
  ];
}

export async function submitDailyChallengeCompletion(
  userId: string,
  challenge: ActiveDailyChallenge,
  score: number,
  xpEarned: number,
  timeTakenSeconds?: number
): Promise<CompletionSubmissionResult> {
  const activeDateKey = challenge.dateKey || getTodayCycleKey();
  const claimPath = `users/${userId}/dailyChallengeClaims/${activeDateKey}`;

  // 1. One-time-per-day restriction check
  const alreadyCompleted = await hasUserCompletedTodayChallenge(userId, activeDateKey);
  if (alreadyCompleted) {
    return {
      status: 'already_claimed',
      message: `You have already completed today's (${activeDateKey}) Daily Discovery Challenge! Next challenge unlocks at midnight.`,
    };
  }

  try {
    const claimRef = doc(db, 'users', userId, 'dailyChallengeClaims', activeDateKey);
    const nowIso = new Date().toISOString();
    const finalTime = timeTakenSeconds || 45;

    // 2. Write completion claim document to Firestore
    await setDoc(claimRef, {
      id: activeDateKey,
      userId,
      dateKey: activeDateKey,
      challengeTitle: challenge.title,
      category: challenge.category,
      score,
      xpEarned,
      claimed: true,
      claimedAt: nowIso,
      serverClaimedAt: serverTimestamp(),
      timeTakenSeconds: finalTime,
    });

    // Mark LocalStorage for offline speed
    if (typeof window !== 'undefined') {
      localStorage.setItem(`daily_claimed_${userId}_${activeDateKey}`, 'true');
    }

    // Write to central leaderboard
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const displayName = userSnap.exists() ? (userSnap.data().displayName || 'Explorer') : 'Explorer';
      const avatarUrl = userSnap.exists() ? (userSnap.data().avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80') : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

      const lbRef = doc(db, 'dailyChallenges', activeDateKey, 'leaderboard', userId);
      await setDoc(lbRef, {
        userId,
        displayName,
        avatarUrl,
        timeTakenSeconds: finalTime,
        score,
        completedAt: nowIso,
      });

      // Also write global completion feed entry
      try {
        const feedRef = doc(collection(db, 'dailyChallengeCompletions'));
        await setDoc(feedRef, {
          userId,
          displayName,
          avatarUrl,
          timeTakenSeconds: finalTime,
          score,
          completedAt: nowIso,
          challengeTitle: challenge.title,
        });
      } catch (feedErr) {
        console.warn('Could not write global social feed completion entry:', feedErr);
      }
    } catch (lbErr) {
      console.warn('Could not write global leaderboard entry:', lbErr);
    }

    // 3. Atomically update user's total XP and streak in Firestore
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    let newTotalXp = xpEarned;
    let newStreak = 1;

    if (userSnap.exists()) {
      const data = userSnap.data();
      const currentXp = data.xp || 0;
      const currentStreak = data.streak || 1;
      const lastDate = data.lastDailyChallengeDate;

      newTotalXp = currentXp + xpEarned;

      if (lastDate) {
        const lastDateObj = new Date(lastDate);
        const todayDateObj = new Date(activeDateKey);
        const diffDays = Math.round((todayDateObj.getTime() - lastDateObj.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          newStreak = currentStreak + 1;
        } else if (diffDays === 0) {
          newStreak = currentStreak;
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = currentStreak + 1;
      }

      await setDoc(
        userRef,
        {
          xp: newTotalXp,
          streak: newStreak,
          lastDailyChallengeDate: activeDateKey,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    return {
      status: 'claimed_success',
      message: `🎉 Daily Challenge Completed! +${xpEarned} XP awarded. Daily streak set to ${newStreak} days!`,
      score,
      xpEarned,
      newTotalXp,
      newStreak,
      claimedAt: nowIso,
    };
  } catch (error) {
    console.error('Error executing submitDailyChallengeCompletion in Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, claimPath);
    } catch {}
    return {
      status: 'error',
      message: 'Could not complete daily challenge submission. Please check network connection.',
    };
  }
}

// Aliases for compatibility
export const getOrFetchActiveDailyChallenge = fetchDailyKnowledgeQuest;
export const hasUserClaimedToday = hasUserCompletedTodayChallenge;
export const claimDailyChallengeReward = submitDailyChallengeCompletion;
export const getCycleTimeRemaining = getTimeUntilCycleReset;
export type UserClaimResult = CompletionSubmissionResult;

export async function getUserStreak(userId: string): Promise<number> {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().streak || 0;
    }
  } catch (err) {
    console.warn('Error fetching user streak:', err);
  }
  return 0;
}

export interface DailyChallengeClaim {
  id: string;
  userId: string;
  dateKey: string;
  challengeTitle: string;
  category: string;
  score: number;
  xpEarned: number;
  claimed: boolean;
  claimedAt: string;
}

export async function getUserChallengeClaims(userId: string): Promise<DailyChallengeClaim[]> {
  try {
    const claimsRef = collection(db, 'users', userId, 'dailyChallengeClaims');
    const snap = await getDocs(claimsRef);
    const claims: DailyChallengeClaim[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      claims.push({
        id: doc.id,
        userId: data.userId || '',
        dateKey: data.dateKey || '',
        challengeTitle: data.challengeTitle || '',
        category: data.category || '',
        score: data.score || 0,
        xpEarned: data.xpEarned || 0,
        claimed: data.claimed || false,
        claimedAt: data.claimedAt || '',
      });
    });
    return claims;
  } catch (err) {
    console.warn('Error fetching user daily challenge claims:', err);
    return [];
  }
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  timeTakenSeconds: number;
  score: number;
  completedAt: string;
  isSeed?: boolean;
}

export async function getDailyTopExplorers(dateKey: string): Promise<LeaderboardEntry[]> {
  const seedEntries: LeaderboardEntry[] = [
    {
      userId: 'seed_karthik',
      displayName: 'Karthik R.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 34,
      score: 3,
      completedAt: new Date(dateKey + 'T07:12:00Z').toISOString(),
      isSeed: true,
    },
    {
      userId: 'seed_ananya',
      displayName: 'Ananya S.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 42,
      score: 3,
      completedAt: new Date(dateKey + 'T08:05:00Z').toISOString(),
      isSeed: true,
    },
    {
      userId: 'seed_vikram',
      displayName: 'Vikram K.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 51,
      score: 2,
      completedAt: new Date(dateKey + 'T09:41:00Z').toISOString(),
      isSeed: true,
    },
    {
      userId: 'seed_priya',
      displayName: 'Priya Narayanan',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 59,
      score: 3,
      completedAt: new Date(dateKey + 'T06:30:00Z').toISOString(),
      isSeed: true,
    },
    {
      userId: 'seed_sid',
      displayName: 'Siddharth M.',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 67,
      score: 2,
      completedAt: new Date(dateKey + 'T10:14:00Z').toISOString(),
      isSeed: true,
    }
  ];

  try {
    const lbRef = collection(db, 'dailyChallenges', dateKey, 'leaderboard');
    const snap = await getDocs(lbRef);
    const realEntries: LeaderboardEntry[] = [];
    
    snap.forEach((doc) => {
      const data = doc.data();
      realEntries.push({
        userId: doc.id,
        displayName: data.displayName || 'Explorer',
        avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        timeTakenSeconds: data.timeTakenSeconds || 60,
        score: data.score || 0,
        completedAt: data.completedAt || '',
      });
    });

    const merged = [...realEntries];
    seedEntries.forEach(seed => {
      if (!merged.some(real => real.userId === seed.userId)) {
        merged.push(seed);
      }
    });

    merged.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.timeTakenSeconds - b.timeTakenSeconds;
    });

    return merged.slice(0, 5);
  } catch (err) {
    console.warn('Error fetching daily leaderboard:', err);
    return seedEntries.slice(0, 5);
  }
}

export interface FeedEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  timeTakenSeconds: number;
  completedAt: string;
  challengeTitle: string;
  isSeed?: boolean;
}

export async function getRecentGlobalCompletions(): Promise<FeedEntry[]> {
  const seedFeedEntries: FeedEntry[] = [
    {
      userId: 'seed_karthik',
      displayName: 'Karthik R.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 34,
      score: 3,
      completedAt: new Date(Date.now() - 3 * 60000).toISOString(),
      challengeTitle: "Vimana vs. Gothic Vaults: Architectural Structural Physics",
      isSeed: true,
    },
    {
      userId: 'seed_ananya',
      displayName: 'Ananya S.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 42,
      score: 3,
      completedAt: new Date(Date.now() - 12 * 60000).toISOString(),
      challengeTitle: "Fermentation Science in Heritage Flatbreads",
      isSeed: true,
    },
    {
      userId: 'seed_vikram',
      displayName: 'Vikram K.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 51,
      score: 2,
      completedAt: new Date(Date.now() - 25 * 60000).toISOString(),
      challengeTitle: "Stepwell Engineering & Thermal Microclimates",
      isSeed: true,
    },
    {
      userId: 'seed_priya',
      displayName: 'Priya Narayanan',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 59,
      score: 3,
      completedAt: new Date(Date.now() - 41 * 60000).toISOString(),
      challengeTitle: "Vimana vs. Gothic Vaults: Architectural Structural Physics",
      isSeed: true,
    },
    {
      userId: 'seed_sid',
      displayName: 'Siddharth M.',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 67,
      score: 2,
      completedAt: new Date(Date.now() - 65 * 60000).toISOString(),
      challengeTitle: "Acoustic Resonance & Sacred Pillars",
      isSeed: true,
    },
    {
      userId: 'seed_elizabeth',
      displayName: 'Elizabeth T.',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 45,
      score: 3,
      completedAt: new Date(Date.now() - 95 * 60000).toISOString(),
      challengeTitle: "Grid vs. Organic Radiating Networks in Ancient Urban Planning",
      isSeed: true,
    },
    {
      userId: 'seed_rahul',
      displayName: 'Rahul Verma',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 71,
      score: 3,
      completedAt: new Date(Date.now() - 130 * 60000).toISOString(),
      challengeTitle: "Stepwell Engineering & Thermal Microclimates",
      isSeed: true,
    },
    {
      userId: 'seed_meera',
      displayName: 'Meera Iyer',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 38,
      score: 3,
      completedAt: new Date(Date.now() - 180 * 60000).toISOString(),
      challengeTitle: "Acoustic Resonance & Sacred Pillars",
      isSeed: true,
    },
    {
      userId: 'seed_arjun',
      displayName: 'Arjun Sen',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 82,
      score: 2,
      completedAt: new Date(Date.now() - 240 * 60000).toISOString(),
      challengeTitle: "Fermentation Science in Heritage Flatbreads",
      isSeed: true,
    },
    {
      userId: 'seed_saira',
      displayName: 'Saira Banu',
      avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=150&q=80',
      timeTakenSeconds: 49,
      score: 3,
      completedAt: new Date(Date.now() - 320 * 60000).toISOString(),
      challengeTitle: "Grid vs. Organic Radiating Networks in Ancient Urban Planning",
      isSeed: true,
    }
  ];

  try {
    const feedRef = collection(db, 'dailyChallengeCompletions');
    const q = query(feedRef, orderBy('completedAt', 'desc'), limit(15));
    const snap = await getDocs(q);
    const realEntries: FeedEntry[] = [];
    
    snap.forEach((doc) => {
      const data = doc.data();
      realEntries.push({
        userId: data.userId || doc.id,
        displayName: data.displayName || 'Explorer',
        avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        timeTakenSeconds: data.timeTakenSeconds || 60,
        score: data.score || 0,
        completedAt: data.completedAt || '',
        challengeTitle: data.challengeTitle || 'Daily Challenge',
      });
    });

    const merged = [...realEntries];
    seedFeedEntries.forEach(seed => {
      if (!merged.some(real => real.userId === seed.userId)) {
        merged.push(seed);
      }
    });

    // Sort by completedAt descending
    merged.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    return merged.slice(0, 10);
  } catch (err) {
    console.warn('Error fetching global completions feed:', err);
    return seedFeedEntries.slice(0, 10);
  }
}



