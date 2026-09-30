import { GoogleGenAI } from '@google/genai';
import { ALL_MASTER_PLACES_1000 } from '../data/masterPlacesIndex';
import { CHENNAI_FOOD_GEMS_300 } from '../data/foodGems300';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface DailyChallengeQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DailyChallenge {
  dateKey: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  locationName: string;
  zone: string;
  category: 'Heritage' | 'Architecture' | 'Food Lore' | 'Hidden Gem' | 'Sacred Sites';
  imageUrl: string;
  loreStory: string;
  learningTakeaway: string;
  questions: DailyChallengeQuestion[];
  xpReward: number;
  badgeReward: string;
  generatedAt: string;
}

export interface UserDailyChallengeStatus {
  dateKey: string;
  isCompleted: boolean;
  score: number;
  xpEarned: number;
  completedAt?: string;
  streakDays: number;
}

/**
 * Returns today's date key in YYYY-MM-DD format (IST / Chennai timezone)
 */
export function getTodayDateKey(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 3600000 * 5.5);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates or retrieves today's AI-curated Daily Discovery Challenge using Gemini AI
 */
export async function fetchOrGenerateDailyChallenge(dateKey?: string): Promise<DailyChallenge> {
  const targetDateKey = dateKey || getTodayDateKey();

  // Try fetching cached challenge from LocalStorage first for instant loading
  const cacheKey = `daily_challenge_${targetDateKey}`;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.warn("Failed to parse cached daily challenge:", err);
      }
    }
  }

  // Deterministically select a seed place from master catalog based on date string
  let seedIndex = 0;
  for (let i = 0; i < targetDateKey.length; i++) {
    seedIndex += targetDateKey.charCodeAt(i);
  }
  const seedPlace = ALL_MASTER_PLACES_1000[seedIndex % ALL_MASTER_PLACES_1000.length];

  try {
    const ai = new GoogleGenAI();
    const prompt = `You are the Master Heritage Chronicler and Chief Learning Architect for "Discover It".
Generate a unique, highly engaging, learning-based Daily Discovery Challenge knowledge quest for today (${targetDateKey}).

Featured Seed Location:
Place: #${seedPlace.number} "${seedPlace.name}" (${seedPlace.locator})
Zone: ${seedPlace.zone} (${seedPlace.cluster})
Category: ${seedPlace.category}
Lore Context: ${seedPlace.lore}

Instructions:
1. Select an intriguing, educational historical/architectural/cultural aspect about this place or surrounding Chennai region.
2. Craft a captivating quest title and subtitle.
3. Write a rich, immersive 2-paragraph learning story explaining the historical, cultural, or architectural context.
4. Highlight a concise "learningTakeaway" bullet summary (1-2 sentences).
5. Create exactly 3 progressive multiple-choice learning quiz questions directly tested by the learning story.
   Each question must have 4 short choices (options) and 1 correctIndex (0, 1, 2, or 3), plus a brief educational explanation.

Respond with ONLY valid JSON obeying this exact structure:
{
  "dateKey": "${targetDateKey}",
  "title": "Daily Discovery: The Secret Chisholm Clock Tower Mystery",
  "subtitle": "Uncover Victorian Gothic Vaults & Chola Bronze Legends",
  "locationName": "${seedPlace.name}",
  "zone": "${seedPlace.zone}",
  "category": "${seedPlace.category === 'Food Lore' ? 'Food Lore' : seedPlace.category === 'Architecture' ? 'Architecture' : seedPlace.category === 'Sacred Sites' ? 'Sacred Sites' : 'Heritage'}",
  "imageUrl": "${seedPlace.imageUrl || 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80'}",
  "loreStory": "Deep inside the heritage corridors... [Paragraph 1]\\n\\nIn the late 19th century... [Paragraph 2]",
  "learningTakeaway": "Discover how Indo-Saracenic architecture fused Victorian brickwork with Dravidian arches.",
  "questions": [
    {
      "id": 1,
      "question": "What architectural innovation distinguishes this landmark?",
      "options": ["Indo-Saracenic trefoil arches", "Corinthian marble columns", "Dravidian granite gopurams", "Modernist glass facade"],
      "correctIndex": 0,
      "explanation": "Robert Chisholm pioneered trefoil brick arches combined with Indian motifs."
    },
    {
      "id": 2,
      "question": "Which century does the foundational structure date back to?",
      "options": ["17th Century", "19th Century", "12th Century", "20th Century"],
      "correctIndex": 1,
      "explanation": "Constructed during the late 19th-century boom of Madras civil infrastructure."
    },
    {
      "id": 3,
      "question": "What primary material was imported for the vaulting?",
      "options": ["Teak and crimson glass", "Granite from Pallavaram", "Marble from Sowcarpet", "Italian terracotta"],
      "correctIndex": 0,
      "explanation": "Burma teak and imported European stained glass adorned the vaulted hall."
    }
  ],
  "xpReward": 150,
  "badgeReward": "🔥 Daily Chronicler"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as DailyChallenge;
      const challenge: DailyChallenge = {
        dateKey: targetDateKey,
        title: parsed.title || `Daily Discovery: ${seedPlace.name}`,
        subtitle: parsed.subtitle || `Uncover the hidden lore of ${seedPlace.zone}`,
        locationName: parsed.locationName || seedPlace.name,
        zone: parsed.zone || seedPlace.zone,
        category: (parsed.category as any) || 'Heritage',
        imageUrl: seedPlace.imageUrl || 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80',
        loreStory: parsed.loreStory || seedPlace.lore,
        learningTakeaway: parsed.learningTakeaway || `Key learning from ${seedPlace.name} in ${seedPlace.zone}.`,
        questions: parsed.questions && parsed.questions.length === 3 ? parsed.questions : getFallbackQuestions(seedPlace),
        xpReward: parsed.xpReward || 150,
        badgeReward: parsed.badgeReward || '🔥 Daily Chronicler',
        generatedAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(challenge));
      }
      return challenge;
    }
  } catch (err) {
    console.warn("AI Daily Challenge generation fallback:", err);
  }

  // Graceful Fallback Challenge using seedPlace data
  const fallbackChallenge: DailyChallenge = {
    dateKey: targetDateKey,
    title: `Daily Challenge: #${seedPlace.number} ${seedPlace.name}`,
    subtitle: `Daily Heritage & Architectural Discovery in ${seedPlace.zone}`,
    locationName: seedPlace.name,
    zone: seedPlace.zone,
    category: (seedPlace.category as any) || 'Heritage',
    imageUrl: seedPlace.imageUrl || 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80',
    loreStory: `${seedPlace.lore}\n\nLocated in ${seedPlace.zone}, ${seedPlace.name} represents a vital landmark in the cultural tapestry of Chennai. Visitors and chroniclers observe unique architectural craftsmanship, historical provenance, and community traditions passed down through generations.`,
    learningTakeaway: `Every place carries layers of history, craft, and human connection waiting to be uncovered through observant exploration.`,
    questions: getFallbackQuestions(seedPlace),
    xpReward: 150,
    badgeReward: '🔥 Daily Chronicler',
    generatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(cacheKey, JSON.stringify(fallbackChallenge));
  }
  return fallbackChallenge;
}

function getFallbackQuestions(seedPlace: any): DailyChallengeQuestion[] {
  return [
    {
      id: 1,
      question: `What zone in Chennai is ${seedPlace.name} located in?`,
      options: [seedPlace.zone, 'Mylapore', 'George Town', 'Besant Nagar'],
      correctIndex: 0,
      explanation: `${seedPlace.name} is situated in the ${seedPlace.zone} neighborhood.`
    },
    {
      id: 2,
      question: `What primary category does ${seedPlace.name} belong to in the master catalog?`,
      options: [seedPlace.category, 'Nature Reserve', 'Modern Mall', 'Airport Terminal'],
      correctIndex: 0,
      explanation: `Cataloged under ${seedPlace.category} for its distinct cultural value.`
    },
    {
      id: 3,
      question: `What is a key feature of this location's history or lore?`,
      options: [
        seedPlace.lore.slice(0, 45) + '...',
        'Built entirely out of plastic blocks in 2010',
        'Used exclusively as a temporary warehouse',
        'Located underground beneath the ocean'
      ],
      correctIndex: 0,
      explanation: seedPlace.lore
    }
  ];
}

/**
 * Loads user completion status for today's challenge from Firestore or LocalStorage
 */
export async function getUserDailyChallengeStatus(userId?: string): Promise<UserDailyChallengeStatus> {
  const todayKey = getTodayDateKey();

  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'dailyChallenges', todayKey);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          dateKey: todayKey,
          isCompleted: data.isCompleted || false,
          score: data.score || 0,
          xpEarned: data.xpEarned || 0,
          completedAt: data.completedAt,
          streakDays: data.streakDays || 1,
        };
      }
    } catch (err) {
      console.warn("Could not fetch daily challenge status from Firestore:", err);
    }
  }

  // Fallback check LocalStorage
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(`daily_status_${todayKey}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {}
    }
  }

  return {
    dateKey: todayKey,
    isCompleted: false,
    score: 0,
    xpEarned: 0,
    streakDays: 1,
  };
}

/**
 * Saves completed Daily Challenge result to Firestore & LocalStorage
 */
export async function saveUserDailyChallengeCompletion(
  userId: string | undefined,
  challenge: DailyChallenge,
  score: number,
  totalXp: number,
  streakDays: number
): Promise<void> {
  const todayKey = challenge.dateKey;
  const status: UserDailyChallengeStatus = {
    dateKey: todayKey,
    isCompleted: true,
    score,
    xpEarned: totalXp,
    completedAt: new Date().toISOString(),
    streakDays,
  };

  // LocalStorage save
  if (typeof window !== 'undefined') {
    localStorage.setItem(`daily_status_${todayKey}`, JSON.stringify(status));
  }

  // Firestore save
  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'dailyChallenges', todayKey);
      await setDoc(docRef, {
        ...status,
        challengeTitle: challenge.title,
        locationName: challenge.locationName,
      });

      // Increment total XP & update streak on user profile
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentXp = userSnap.data().xp || 0;
        await setDoc(userRef, {
          xp: currentXp + totalXp,
          lastDailyChallengeDate: todayKey,
          streak: streakDays,
        }, { merge: true });
      }
    } catch (err) {
      console.warn("Firestore daily challenge completion save deferred:", err);
    }
  }
}
