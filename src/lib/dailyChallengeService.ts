import { GoogleGenAI } from '@google/genai';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

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
}

export interface UserClaimResult {
  status: 'claimed_success' | 'already_claimed' | 'error';
  message: string;
  score?: number;
  xpEarned?: number;
  newTotalXp?: number;
  newStreak?: number;
  claimedAt?: string;
}

/**
 * Calculates current 24-hour cycle key (YYYY-MM-DD in IST timezone)
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
export function getCycleTimeRemaining(): { totalSeconds: number; formatted: string } {
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
 * Fetches the active 24-hour challenge from Firestore, or generates a new location-agnostic
 * quest via Gemini AI and persists it in Firestore.
 */
export async function getOrFetchActiveDailyChallenge(dateKey?: string): Promise<ActiveDailyChallenge> {
  const activeDateKey = dateKey || getTodayCycleKey();
  const firestorePath = `dailyChallenges/${activeDateKey}`;

  // Step 1: Check if Firestore already has today's active challenge
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
      };
    }
  } catch (err) {
    console.warn('Could not read daily challenge from Firestore, generating fallback/AI:', err);
  }

  // Step 2: Pick a random theme seed for location-agnostic generation
  let hash = 0;
  for (let i = 0; i < activeDateKey.length; i++) {
    hash = (hash << 5) - hash + activeDateKey.charCodeAt(i);
    hash |= 0;
  }
  const themeIndex = Math.abs(hash) % LOCATION_AGNOSTIC_THEMES.length;
  const selectedTheme = LOCATION_AGNOSTIC_THEMES[themeIndex];

  // Step 3: Use Gemini AI to fetch a location-agnostic knowledge quest
  let generatedChallenge: ActiveDailyChallenge;

  try {
    const ai = new GoogleGenAI();
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

Return ONLY a valid JSON object matching this schema:
{
  "dateKey": "${activeDateKey}",
  "title": "Universal Vaults: The Physics of Load-Bearing Arches",
  "subtitle": "Discover How Weight Redistribution Transformed Ancient Architecture",
  "category": "${selectedTheme.category}",
  "theme": "${selectedTheme.theme}",
  "imageUrl": "${selectedTheme.imageUrl}",
  "loreStory": "Across civilizations, builders faced a fundamental physics challenge: how to bridge large open spans without collapse...\\n\\nThe invention of the voussoir arch redistributed downward gravitational pull laterally into abutments...",
  "learningTakeaway": "Load-bearing arches convert tensile stress into compressive force along curved stones.",
  "questions": [
    {
      "id": 1,
      "question": "What central structural element locks a stone arch in place under compression?",
      "options": ["Keystone", "Flying buttress", "Corbel ledge", "Pendentive"],
      "correctIndex": 0,
      "explanation": "The keystone sits at the apex of the arch, transferring compressive weight to both sides."
    },
    {
      "id": 2,
      "question": "Which force do masonry stones withstand best in traditional architecture?",
      "options": ["Tension", "Compression", "Torsion", "Shear"],
      "correctIndex": 1,
      "explanation": "Natural stone has immensely high compressive strength, making curved arch geometry ideal."
    },
    {
      "id": 3,
      "question": "How do Gothic flying buttresses differ from Roman barrel vaults?",
      "options": ["They redirect diagonal thrust outside wall boundaries", "They eliminate the need for mortar", "They are made purely of timber", "They only exist underground"],
      "correctIndex": 0,
      "explanation": "Flying buttresses channel lateral outward thrust away from walls, allowing large stained glass windows."
    }
  ],
  "xpReward": 175,
  "badgeReward": "🔥 Daily Chronicler"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
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
      };
    } else {
      throw new Error('Empty AI response');
    }
  } catch (aiErr) {
    console.warn('Gemini AI daily challenge generation fallback used:', aiErr);
    generatedChallenge = {
      dateKey: activeDateKey,
      challengeId: `challenge_${activeDateKey}`,
      title: `24-Hour Challenge: ${selectedTheme.theme}`,
      subtitle: `Master universal principles of architectural physics and design`,
      category: selectedTheme.category as any,
      theme: selectedTheme.theme,
      imageUrl: selectedTheme.imageUrl,
      loreStory: `Across human history, monumental structures relied on fundamental principles of geometry, material science, and environment.\n\nUnderstanding how force, resonance, and climate shape ancient monuments allows modern explorers to decode heritage anywhere in the world.`,
      learningTakeaway: `Universal engineering patterns connect ancient monuments across continents.`,
      questions: getFallbackAgnosticQuestions(),
      xpReward: 175,
      badgeReward: '🔥 Daily Chronicler',
      createdAt: new Date().toISOString(),
    };
  }

  // Step 4: Persist newly generated active challenge in Firestore for the global 24-hour cycle
  try {
    const docRef = doc(db, 'dailyChallenges', activeDateKey);
    await setDoc(docRef, {
      ...generatedChallenge,
      serverCreatedAt: serverTimestamp(),
    });
  } catch (fsErr) {
    console.warn('Could not store active challenge in Firestore:', fsErr);
  }

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

/**
 * Checks if a user has already claimed today's daily challenge reward in Firestore
 */
export async function hasUserClaimedToday(userId: string, dateKey?: string): Promise<boolean> {
  const activeDateKey = dateKey || getTodayCycleKey();
  const claimPath = `users/${userId}/dailyChallengeClaims/${activeDateKey}`;

  try {
    const docRef = doc(db, 'users', userId, 'dailyChallengeClaims', activeDateKey);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().claimed === true) {
      return true;
    }
  } catch (err) {
    console.warn('Error checking daily challenge claim in Firestore:', err);
  }

  // Fallback check LocalStorage
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`daily_claimed_${userId}_${activeDateKey}`) === 'true';
  }

  return false;
}

/**
 * Claims today's Daily Discovery Challenge reward for the user once per 24-hour cycle.
 * Enforces the once-per-day restriction in Firestore and updates total XP and streak.
 */
export async function claimDailyChallengeReward(
  userId: string,
  challenge: ActiveDailyChallenge,
  score: number,
  xpEarned: number
): Promise<UserClaimResult> {
  const activeDateKey = challenge.dateKey || getTodayCycleKey();
  const claimPath = `users/${userId}/dailyChallengeClaims/${activeDateKey}`;

  // 1. Guard check: Has the user already claimed today?
  const alreadyClaimed = await hasUserClaimedToday(userId, activeDateKey);
  if (alreadyClaimed) {
    return {
      status: 'already_claimed',
      message: `You have already claimed today's (${activeDateKey}) Daily Discovery Challenge reward! Next challenge unlocks at midnight.`,
    };
  }

  try {
    const claimRef = doc(db, 'users', userId, 'dailyChallengeClaims', activeDateKey);
    const nowIso = new Date().toISOString();

    // 2. Write Claim Record
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
    });

    // Mark LocalStorage for offline speed
    if (typeof window !== 'undefined') {
      localStorage.setItem(`daily_claimed_${userId}_${activeDateKey}`, 'true');
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

      // Calculate streak: if last claimed yesterday, increment. If today, same. If older, reset to 1.
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
      message: `🎉 Challenge Claimed! +${xpEarned} XP awarded. Daily streak set to ${newStreak} days!`,
      score,
      xpEarned,
      newTotalXp,
      newStreak,
      claimedAt: nowIso,
    };
  } catch (error) {
    console.error('Error executing claimDailyChallengeReward in Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, claimPath);
    } catch (formattedErr) {
      return {
        status: 'error',
        message: 'Could not complete reward claim. Please check network connection.',
      };
    }
    return {
      status: 'error',
      message: 'Could not complete reward claim.',
    };
  }
}
