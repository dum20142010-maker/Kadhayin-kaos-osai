import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { SessionPlacedArtifact } from '../types';

export interface SharedArSession {
  id: string;
  sessionCode: string;
  hostUserId: string;
  hostUserName: string;
  placeName: string;
  centerLat: number;
  centerLng: number;
  createdAt: string;
  expiresAt: string;
  placedArtifacts: SessionPlacedArtifact[];
  activeParticipantsCount: number;
  lastPingAt: string;
}

const SESSIONS_COLLECTION = 'sharedArSessions';

/**
 * Generates an easy-to-read, 6-character alphanumeric session code (e.g. KAOS-8F2A)
 */
function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KAOS-${code}`;
}

/**
 * Creates a new temporary local Shared-View AR Session for real-time artifact placement sync
 */
export async function createSharedArSession(
  hostUser: { uid: string; displayName?: string | null; email?: string | null },
  coords: { lat: number; lng: number } | null,
  placeName: string = 'Madras Heritage Zone',
  initialPlacedArtifacts: SessionPlacedArtifact[] = []
): Promise<SharedArSession> {
  const sessionCode = generateSessionCode();
  const sessionId = `session-${sessionCode.toLowerCase().replace('-', '')}-${Date.now()}`;
  const now = new Date();
  const expires = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3-hour temporary session

  const newSession: SharedArSession = {
    id: sessionId,
    sessionCode,
    hostUserId: hostUser.uid || 'anon-host',
    hostUserName: hostUser.displayName || hostUser.email?.split('@')[0] || 'Madras Explorer',
    placeName,
    centerLat: coords?.lat || 13.0336,
    centerLng: coords?.lng || 80.2694,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    placedArtifacts: initialPlacedArtifacts,
    activeParticipantsCount: 1,
    lastPingAt: now.toISOString(),
  };

  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await setDoc(docRef, newSession);
    return newSession;
  } catch (err) {
    console.warn('Error creating Firestore Shared AR Session:', err);
    // Return local in-memory session if offline
    return newSession;
  }
}

/**
 * Updates 3D artifact placements in an active Shared-View session (real-time broadcast to all peers)
 */
export async function updateSharedArSessionPlacements(
  sessionId: string,
  placedArtifacts: SessionPlacedArtifact[]
): Promise<void> {
  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await updateDoc(docRef, {
      placedArtifacts,
      lastPingAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error updating Shared AR Session placements:', err);
  }
}

/**
 * Subscribes to real-time updates for a Shared-View session
 */
export function subscribeSharedArSession(
  sessionId: string,
  onUpdate: (session: SharedArSession | null) => void
): () => void {
  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as SharedArSession);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.warn('Error in Shared AR Session subscription:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to attach Shared AR Session listener:', err);
    return () => {};
  }
}

/**
 * Finds and joins an existing Shared-View session by code or ID
 */
export async function joinSharedArSession(
  codeOrId: string
): Promise<SharedArSession | null> {
  const cleanInput = codeOrId.trim().toUpperCase();

  try {
    // 1. Try querying by sessionCode (e.g. "KAOS-8F2A")
    const q = query(
      collection(db, SESSIONS_COLLECTION),
      where('sessionCode', '==', cleanInput)
    );
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      const session = docSnap.data() as SharedArSession;

      // Check expiration
      if (new Date(session.expiresAt) < new Date()) {
        throw new Error('This temporary Shared-View AR session has expired.');
      }

      // Increment active participant count
      try {
        await updateDoc(doc(db, SESSIONS_COLLECTION, session.id), {
          activeParticipantsCount: increment(1),
          lastPingAt: new Date().toISOString(),
        });
      } catch (incErr) {}

      return session;
    }

    // 2. Try direct doc ID match
    const docRef = doc(db, SESSIONS_COLLECTION, codeOrId.trim());
    const directSnap = await getDoc(docRef);
    if (directSnap.exists()) {
      const session = directSnap.data() as SharedArSession;
      if (new Date(session.expiresAt) < new Date()) {
        throw new Error('This temporary Shared-View AR session has expired.');
      }
      return session;
    }

    return null;
  } catch (err: any) {
    console.warn('Error joining Shared AR Session:', err);
    throw err;
  }
}

/**
 * Leaves a Shared-View session (decrements participant count)
 */
export async function leaveSharedArSession(sessionId: string): Promise<void> {
  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await updateDoc(docRef, {
      activeParticipantsCount: increment(-1),
      lastPingAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error leaving Shared AR Session:', err);
  }
}
