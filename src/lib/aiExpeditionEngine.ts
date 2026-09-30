import { MasterPlace, CustomExpeditionPlan, PlanStop, GeneratedQuest, AiPlaceExplainer } from '../types';
import { getPlacesByCluster, ALL_MASTER_PLACES_300, GEOGRAPHICAL_CLUSTERS } from '../data/masterPlacesIndex';

// Pre-defined badge icons
const BADGES = ['🏆 Coromandel Pioneer', '🔍 Heritage Detective', '📸 Lens Master', '☕ Chicory Connoisseur', '🏛️ Chisholm Scholar', '🌊 Coastal Voyager'];

export const generateCustomGeographicPlan = async (
  clusterKey: string,
  timeBudget: '1-hour' | '2-hours' | 'half-day' | 'full-day' = '2-hours',
  focusTheme: string = 'Heritage & Architecture',
  pace: string = 'Walking',
  customPreferences?: string
): Promise<CustomExpeditionPlan> => {
  const cluster = GEOGRAPHICAL_CLUSTERS.find((c) => c.id === clusterKey) || GEOGRAPHICAL_CLUSTERS[0];
  const candidatePlaces = getPlacesByCluster(clusterKey);
  
  const stopCount = timeBudget === '1-hour' ? 3 : timeBudget === '2-hours' ? 5 : timeBudget === 'half-day' ? 7 : 9;
  const sampleCandidateData = candidatePlaces.slice(0, 15).map((p) => ({
    num: p.number,
    name: p.name,
    zone: p.zone,
    lat: p.lat,
    lng: p.lng,
    category: p.category,
    lore: p.lore,
  }));

  try {
    const prompt = `You are the lead Heritage Cartographer and Expedition Architect for "Discover It Chennai".
Create an optimized, walking or transit expedition itinerary for the following geographical area in Chennai:
Cluster: "${cluster.name}" (Short Name: ${cluster.shortName})
Time Budget: ${timeBudget} (${stopCount} stops)
Theme: ${focusTheme}
Pace: ${pace}
User notes: ${customPreferences || 'None'}

Available Candidate Places from our 300-place master catalog in this zone:
${JSON.stringify(sampleCandidateData, null, 2)}

Respond with ONLY valid JSON adhering to this exact format:
{
  "title": "A captivating expedition title (e.g. 'The Crimson Vaults & Belfries of Old Black Town')",
  "tagline": "Atmospheric 1-sentence tagline",
  "totalDuration": "e.g. 2 hr 15 min",
  "totalDistance": "e.g. 2.4 km",
  "totalXp": 450,
  "overview": "2-sentence vivid narrative overview explaining why this route flows naturally",
  "insiderTip": "A genuine local insider tip for this neighborhood (best time, secret snack, hidden angle)",
  "stops": [
    {
      "stopNumber": 1,
      "placeNumber": 8,
      "placeName": "Madras High Court",
      "zone": "George Town",
      "lat": 13.0878,
      "lng": 80.2872,
      "timeAllocation": "25 mins",
      "mission": "Locate the small lighthouse minaret atop the red sandstone dome",
      "loreHook": "Notice the Italian terracotta tiles harmonised with Mughal sunshades",
      "xpReward": 90
    }
  ]
}
Ensure exactly ${stopCount} sequential, geographically logical stops.`;

    const res = await fetch('/api/ai/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    if (data.text) {
      const parsed = JSON.parse(data.text);
      return {
        id: `plan-${Date.now()}`,
        title: parsed.title || `${cluster.shortName} Heritage Odyssey`,
        tagline: parsed.tagline || cluster.tagline,
        cluster: cluster.name,
        totalDuration: parsed.totalDuration || '2 Hours',
        totalDistance: parsed.totalDistance || '2.1 km',
        totalXp: parsed.totalXp || 450,
        pace,
        theme: focusTheme,
        overview: parsed.overview || `A curated journey through ${cluster.shortName}.`,
        stops: parsed.stops || [],
        insiderTip: parsed.insiderTip || 'Carry a water bottle and visit early in the morning for soft lighting.',
        createdAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('AI Plan Generation fallback invoked:', err);
  }

  // Graceful Fallback Generator using real catalog
  const selectedPlaces = candidatePlaces.slice(0, stopCount);
  const fallbackStops: PlanStop[] = selectedPlaces.map((p, idx) => ({
    stopNumber: idx + 1,
    placeNumber: p.number,
    placeName: p.name,
    zone: p.zone,
    lat: p.lat,
    lng: p.lng,
    timeAllocation: `${15 + idx * 5} mins`,
    mission: `Verify and capture landmark #${p.number} via Live Lens`,
    loreHook: p.lore,
    xpReward: p.xp,
  }));

  return {
    id: `plan-fallback-${Date.now()}`,
    title: `${cluster.shortName} Expedition Trail`,
    tagline: cluster.tagline,
    cluster: cluster.name,
    totalDuration: timeBudget === '1-hour' ? '1 Hour' : timeBudget === '2-hours' ? '2 Hours' : 'Half Day',
    totalDistance: `${(stopCount * 0.45).toFixed(1)} km`,
    totalXp: fallbackStops.reduce((sum, s) => sum + s.xpReward, 0),
    pace,
    theme: focusTheme,
    overview: `An optimized trail discovering ${stopCount} key landmarks across ${cluster.shortName}.`,
    stops: fallbackStops,
    insiderTip: 'Start your walk at golden hour to experience cool sea breezes and tranquil courtyards.',
    createdAt: new Date().toISOString(),
  };
};

export const generateDynamicPlaceQuests = async (
  place: MasterPlace,
  count: number = 3
): Promise<GeneratedQuest[]> => {
  try {
    const prompt = `Generate ${count} immersive, atmospheric explorer quests for this Chennai landmark:
Place: #${place.number} "${place.name}" (${place.locator})
Zone: ${place.zone}
Cluster: ${place.cluster}
Category: ${place.category}
Lore: ${place.lore}
Style: ${place.architecturalStyle || 'Heritage'}

Create 3 distinct quest types:
1. photo_lens: Photo challenge with a specific vintage filter (e.g. '1924 Peaberry Sepia', 'Coromandel Cyanotype', 'Mylapore Temple Gold', 'Indo-Saracenic Oxide', '1850 Silver Gelatin')
2. riddle_solve: A cryptic 2-line rhyming riddle clue about an architectural/historical detail
3. audio_listen: Audio spatial verification quest

Respond with ONLY a JSON array of objects:
[
  {
    "title": "Short exciting quest title",
    "riddleClue": "Cryptic hint to guide the explorer",
    "objective": "Clear step-by-step physical action required at the spot",
    "challengeType": "photo_lens" | "riddle_solve" | "audio_listen",
    "requiredFilter": "peaberry-1924" | "coromandel-1880" | "mylapore-gold" | "saracenic-oxide" | "daguerreotype-1850",
    "xpReward": 120,
    "difficulty": "Easy" | "Moderate" | "Master",
    "badgeReward": "Badge Title"
  }
]`;

    const res = await fetch('/api/ai/generate-quests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    if (data.text) {
      const parsed = JSON.parse(data.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q: any, idx: number) => ({
          id: `quest-${place.number}-${Date.now()}-${idx}`,
          placeId: place.id,
          placeNumber: place.number,
          placeName: place.name,
          zone: place.zone,
          cluster: place.cluster,
          title: q.title || `Quest of ${place.name}`,
          riddleClue: q.riddleClue || `Seek the hidden markings near ${place.zone}.`,
          objective: q.objective || `Scan and document ${place.name}`,
          challengeType: q.challengeType || (idx === 0 ? 'photo_lens' : idx === 1 ? 'riddle_solve' : 'audio_listen'),
          requiredFilter: q.requiredFilter || 'peaberry-1924',
          xpReward: q.xpReward || place.xp + (idx * 20),
          difficulty: q.difficulty || (idx === 0 ? 'Easy' : idx === 1 ? 'Moderate' : 'Master'),
          badgeReward: q.badgeReward || BADGES[idx % BADGES.length],
          isCompleted: false,
        }));
      }
    }
  } catch (err) {
    console.warn('AI Quest Generation fallback invoked:', err);
  }

  // Robust Fallback Quests
  return [
    {
      id: `quest-${place.number}-1`,
      placeId: place.id,
      placeNumber: place.number,
      placeName: place.name,
      zone: place.zone,
      cluster: place.cluster,
      title: `${place.name} Live Lens Challenge`,
      riddleClue: `Point your lens where ${place.zone}'s shadows meet tropical daylight.`,
      objective: `Photograph the main facade using the "1924 Peaberry Sepia" or "Indo-Saracenic Oxide" vintage filter.`,
      challengeType: 'photo_lens',
      requiredFilter: 'peaberry-1924',
      xpReward: place.xp + 30,
      difficulty: 'Easy',
      badgeReward: '📸 Coromandel Lensman',
      isCompleted: false,
    },
    {
      id: `quest-${place.number}-2`,
      placeId: place.id,
      placeNumber: place.number,
      placeName: place.name,
      zone: place.zone,
      cluster: place.cluster,
      title: `Secret Architectural Cipher of #${place.number}`,
      riddleClue: `Count the arches or pillars holding ancient memories from ${place.architecturalStyle || 'yesteryear'}.`,
      objective: `Decipher the historical year inscription or foundational stone at the entrance.`,
      challengeType: 'riddle_solve',
      xpReward: place.xp + 50,
      difficulty: 'Moderate',
      badgeReward: '🔍 Heritage Detective',
      isCompleted: false,
    },
    {
      id: `quest-${place.number}-3`,
      placeId: place.id,
      placeNumber: place.number,
      placeName: place.name,
      zone: place.zone,
      cluster: place.cluster,
      title: `Belfry & Soundscape Synchronizer`,
      riddleClue: `Listen closely to the spatial chimes echoing across ${place.zone}.`,
      objective: `Listen to the full spatial audio guide and verify GPS check-in within 50 meters.`,
      challengeType: 'audio_listen',
      xpReward: place.xp + 70,
      difficulty: 'Master',
      badgeReward: '🏆 Master of Madras Lore',
      isCompleted: false,
    },
  ];
};

export const getAiPlaceExplainer = async (place: MasterPlace): Promise<AiPlaceExplainer> => {
  try {
    const prompt = `You are an elite Chennai Heritage Historian and Local Lore Expert.
Provide an in-depth biography, history, heritage, and a custom quest for this landmark:
Name: "${place.name}"
Category: "${place.category}"
Zone: "${place.zone}"
Cluster: "${place.cluster}"
Current Short Lore: "${place.lore}"
Locator details: "${place.locator}"

Your response must be a single JSON object in this exact format:
{
  "bio": "A rich 2-3 sentence historical biography and description of the place, detailing its founding, importance, and cultural status.",
  "history": "In-depth historical narrative of the place, vintage timeline details, and historical context of the site.",
  "heritage_explainer": "An in-depth explanation of the legacy, architectural details (like Indo-Saracenic columns, Dravidian carvings, colonial arches), and the heritage significance of the site.",
  "quest": "A detailed narrative description of the custom exploration quest designed for this site, explaining the significance of what the user is exploring.",
  "vintageTrivia": [
    "A fascinating historical trivia point 1 from the past.",
    "A fascinating historical trivia point 2 from the past.",
    "A fascinating historical trivia point 3 from the past."
  ],
  "questTitle": "An evocative name for an AI-guided exploration quest at this site (e.g. 'Echoes of the Senate Rotunda')",
  "questDifficulty": "Easy", // Must be one of: "Easy", "Moderate", "Master"
  "questObjective": "A specific, exciting action the explorer must do (e.g., locate the 1880 sandstone plaque on the eastern wing)",
  "questRiddleClue": "A rhyming, cryptic 2-line clue to help them find the target.",
  "questXpReward": 150
}

Return ONLY valid JSON.`;

    const res = await fetch('/api/ai/place-explainer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    if (data.text) {
      let cleanText = data.text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      }
      
      const parsed = JSON.parse(cleanText);
      return {
        bio: parsed.bio || `A prominent landmark in ${place.zone}, ${place.name} is key to Chennai's unique heritage.`,
        history: parsed.history || `Dating back several decades, this landmark has witnessed the rich history and modern growth of the ${place.zone} district.`,
        heritage_explainer: parsed.heritage_explainer || parsed.historyHeritageExplainer || `This site exhibits unique design elements characteristic of ${place.category} in the region, featuring distinctive craftsmanship.`,
        quest: parsed.quest || `Explore the historic surroundings of ${place.name} to unlock its hidden architectural and cultural stories.`,
        vintageTrivia: Array.isArray(parsed.vintageTrivia) ? parsed.vintageTrivia : [
          `Known historically as a crucial hub for local communities in ${place.zone}.`,
          `Stands as an architectural testament to the late 19th and early 20th century developments.`,
          `Highly recommended by curators for visitors interested in ${place.category.toLowerCase()}.`
        ],
        questTitle: parsed.questTitle || `Mystery of ${place.name}`,
        questDifficulty: parsed.questDifficulty || 'Moderate',
        questObjective: parsed.questObjective || `Locate the core plaque or historic sign at ${place.name}.`,
        questRiddleClue: parsed.questRiddleClue || `Find where the old walls tell their ancient tale, and verify your presence to prevail.`,
        questXpReward: parsed.questXpReward || 150
      };
    }
  } catch (err: any) {
    console.error('[getAiPlaceExplainer] Exception:', err);
  }

  // Fallback
  return {
    bio: `A prominent landmark in ${place.zone}, ${place.name} is key to Chennai's unique heritage and local cultural background.`,
    history: `Dating back several decades, it has witnessed the rapid modern expansion of ${place.zone}.`,
    heritage_explainer: `Exhibiting classic traits of ${place.category}, this structure represents a harmonious blend of styles.`,
    quest: `Embark on a walking exploration of ${place.name} and pay close attention to its entrance facade.`,
    vintageTrivia: [
      `Dating back several decades, it has witnessed the rapid modern expansion of ${place.zone}.`,
      `Features unique craftsmanship that reflects the local cultural and historical sensibilities.`,
      `Part of the curated 1,000+ Master Catalog of Chennai's secrets.`
    ],
    questTitle: `The Legacy of ${place.name}`,
    questDifficulty: 'Moderate',
    questObjective: `Find the main architectural marker or dedication plaque at ${place.name}.`,
    questRiddleClue: `In the heart of ${place.zone} this relic does stand; seek the inscription carved by hand.`,
    questXpReward: 120
  };
};

export const searchMasterPlacesWithGemini = async (
  queryText: string,
  candidates: MasterPlace[]
): Promise<number[]> => {
  try {
    const searchScopeLimit = 250;
    const limitedCandidates = candidates.slice(0, searchScopeLimit);
    const minimalCandidates = limitedCandidates.map((p) => ({
      n: p.number,
      g: p.name,
      z: p.zone,
      c: p.category
    }));

    const prompt = `You are a lightweight semantic search routing engine.
User search: "${queryText}"
Candidates index:
${JSON.stringify(minimalCandidates)}

Return a raw JSON array containing ONLY the numbers (integers) of matching candidates.
If no matches, return []. Do not include markdown code block syntax.`;

    const res = await fetch('/api/ai/search-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    if (data.text) {
      let cleanText = data.text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      }
      
      const parsed = JSON.parse(cleanText);
      if (Array.isArray(parsed)) {
        return parsed.filter((n) => typeof n === 'number');
      }
    }
  } catch (err: any) {
    const q = queryText.toLowerCase().trim();
    return candidates
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.zone.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.lore.toLowerCase().includes(q)
      )
      .slice(0, 30)
      .map((p) => p.number);
  }
  return [];
};

