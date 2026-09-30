import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  increment,
  query,
  limit,
} from 'firebase/firestore';
import { Anchored3dArtifact } from '../types';

// Geodesic distance calculation in meters and kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Initial seeded world artifacts placed by legendary Chennai explorers
const SEED_WORLD_ARTIFACTS: Anchored3dArtifact[] = [
  {
    id: 'world-kapaleeshwarar-bell-01',
    artifactId: 'kapaleeshwarar-bell',
    artifactName: 'Kapaleeshwarar Temple Ghanta',
    lat: 13.0336,
    lng: 80.2694,
    altitude: 14,
    accuracy: 3,
    placeName: 'Kapaleeshwarar Temple Tank, Mylapore',
    zone: 'Mylapore Heritage Zone',
    scale: 1.15,
    rotationY: 0.4,
    posX: 0.15,
    posY: 0.0,
    posZ: -1.8,
    surfaceY: 0.0,
    surfacePitch: -1.2,
    surfaceRoll: 0.5,
    isRestingOnGround: true,
    placedByUserId: 'explorer-scribe-42',
    placedByUserName: 'Srividya (Mylapore Chronicler)',
    anchoredAt: '2026-09-28T06:30:00.000Z',
    notes: 'Anchored beside the eastern gopuram steps. Resonates at 432Hz with temple morning abhishekam.',
    resonancesCount: 38,
    soundscapeId: 'temple-chimes',
    frequencyNote: '432 Hz Fundamental Harmonic Chime',
  },
  {
    id: 'world-coromandel-conch-02',
    artifactId: 'coromandel-shankha',
    artifactName: 'Coromandel Sea Conch',
    lat: 13.0498,
    lng: 80.2824,
    altitude: 4,
    accuracy: 4,
    placeName: 'Marina Beach Old Lighthouse Promontory',
    zone: 'Marina Coastal Strip',
    scale: 1.25,
    rotationY: 1.8,
    posX: -0.4,
    posY: 0.0,
    posZ: -2.1,
    surfaceY: 0.0,
    surfacePitch: 0.8,
    surfaceRoll: -0.4,
    isRestingOnGround: true,
    placedByUserId: 'explorer-maritime-09',
    placedByUserName: 'Capt. Sundaram (Coast Navigator)',
    anchoredAt: '2026-09-28T14:15:00.000Z',
    notes: 'Rests in the shoreline sand facing the Bay of Bengal surf.',
    resonancesCount: 52,
    soundscapeId: 'marina-waves',
    frequencyNote: '128 Hz Sub-bass Ocean Resonance',
  },
  {
    id: 'world-davarah-tumbler-03',
    artifactId: 'madras-davarah-tumbler',
    artifactName: 'Madras Brass Davarah Tumbler',
    lat: 13.0371,
    lng: 80.2662,
    altitude: 12,
    accuracy: 3,
    placeName: "Rayar's Mess, Mylapore Lane",
    zone: 'Mylapore Food Quarter',
    scale: 1.0,
    rotationY: 0.2,
    posX: 0.35,
    posY: 0.0,
    posZ: -1.6,
    surfaceY: 0.0,
    surfacePitch: 0.0,
    surfaceRoll: 0.0,
    isRestingOnGround: true,
    placedByUserId: 'explorer-kaapi-11',
    placedByUserName: 'Anirudh V. (Kaapi Connoisseur)',
    anchoredAt: '2026-09-29T02:00:00.000Z',
    notes: 'Left on the thinnai stone bench. Hot peaberry chicory aroma echoes in the morning breeze.',
    resonancesCount: 64,
    soundscapeId: 'filter-coffee',
    frequencyNote: 'High-Q Sizzle & Ceramic Liquid Ping',
  },
  {
    id: 'world-armenian-belfry-04',
    artifactId: 'armenian-belfry-chime',
    artifactName: '1754 Whitechapel Belfry Bell',
    lat: 13.0906,
    lng: 80.2889,
    altitude: 8,
    accuracy: 4,
    placeName: 'Armenian Church Belfry Courtyard, George Town',
    zone: 'George Town Spice Sector',
    scale: 1.1,
    rotationY: -0.6,
    posX: 0.0,
    posY: 0.0,
    posZ: -2.4,
    surfaceY: 0.0,
    surfacePitch: -0.5,
    surfaceRoll: 0.2,
    isRestingOnGround: true,
    placedByUserId: 'explorer-belfry-07',
    placedByUserName: 'Karthik V. (Heritage Architect)',
    anchoredAt: '2026-09-27T10:45:00.000Z',
    notes: 'Resting on the shaded brick courtyard under the mango tree. Cast in London in 1754.',
    resonancesCount: 29,
    soundscapeId: 'belfry',
    frequencyNote: '216 Hz Low Bronze Toll & Reverberation',
  },
];

// Save or Update a Cloud-Anchored Real-World 3D Artifact
export async function saveWorldArtifact(artifact: Anchored3dArtifact): Promise<void> {
  const collectionRef = collection(db, 'anchoredWorldArtifacts');
  const docRef = doc(collectionRef, artifact.id);

  const cleanData: Anchored3dArtifact = {
    ...artifact,
    resonancesCount: artifact.resonancesCount || 0,
    isRestingOnGround: true,
  };

  await setDoc(docRef, cleanData);
}

// Resonate / Like an anchored artifact
export async function resonateWithWorldArtifact(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'anchoredWorldArtifacts', id);
    await updateDoc(docRef, {
      resonancesCount: increment(1),
    });
  } catch (err) {
    console.warn('Could not increment resonance in Firestore:', err);
  }
}

// Real-Time Listener for Cloud-Anchored Artifacts in the User's Area
export function subscribeNearbyWorldArtifacts(
  userCoords: { lat: number; lng: number } | null,
  maxRadiusKm: number = 25,
  onUpdate: (artifacts: (Anchored3dArtifact & { distanceKm: number; distanceFormatted: string })[]) => void
): () => void {
  const collectionRef = collection(db, 'anchoredWorldArtifacts');
  const q = query(collectionRef, limit(60));

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      let list: Anchored3dArtifact[] = [];

      if (snapshot.empty) {
        // Seed default artifacts if database collection is empty
        list = [...SEED_WORLD_ARTIFACTS];
        try {
          for (const item of SEED_WORLD_ARTIFACTS) {
            await setDoc(doc(collection(db, 'anchoredWorldArtifacts'), item.id), item);
          }
        } catch (e) {
          // ignore seed write permissions error if any
        }
      } else {
        snapshot.forEach((d) => {
          list.push(d.data() as Anchored3dArtifact);
        });
      }

      // Compute distances relative to user's real-world GPS coordinates
      const uLat = userCoords?.lat || 13.0674; // Fallback central Chennai
      const uLng = userCoords?.lng || 80.2650;

      const processed = list.map((art) => {
        const distKm = calculateDistanceKm(uLat, uLng, art.lat, art.lng);
        const distFormatted =
          distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
        return {
          ...art,
          distanceKm: distKm,
          distanceFormatted: distFormatted,
        };
      });

      // Sort by proximity (closest real-world artifacts first)
      processed.sort((a, b) => a.distanceKm - b.distanceKm);

      onUpdate(processed);
    },
    (error) => {
      console.warn('Real-time cloud AR persistence error:', error);
      // Fallback to seeded items
      const uLat = userCoords?.lat || 13.0674;
      const uLng = userCoords?.lng || 80.2650;
      const fallbackList = SEED_WORLD_ARTIFACTS.map((art) => {
        const distKm = calculateDistanceKm(uLat, uLng, art.lat, art.lng);
        return {
          ...art,
          distanceKm: distKm,
          distanceFormatted: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
        };
      }).sort((a, b) => a.distanceKm - b.distanceKm);

      onUpdate(fallbackList);
    }
  );

  return unsubscribe;
}
