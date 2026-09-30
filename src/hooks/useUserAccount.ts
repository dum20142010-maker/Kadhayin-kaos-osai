import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserDbProfile } from '../context/AuthContext';

export interface UseUserAccountResult {
  profile: UserDbProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updatedFields: Partial<UserDbProfile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

/**
 * Custom hook that synchronizes profile data (display name, bio, avatar URL)
 * between the Firestore 'users' collection and the frontend state for the authenticated user.
 */
export function useUserAccount(): UseUserAccountResult {
  const { user, userProfile, refreshAuthProfile } = useAuth() as any;
  const [profile, setProfile] = useState<UserDbProfile | null>(userProfile || null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize with Firestore document in real-time
  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserDbProfile;
          setProfile(data);
        } else {
          setProfile(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('Error listening to user profile in useUserAccount:', err);
        setError('Failed to sync profile data from database.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Update profile data in Firestore and state
  const updateProfile = useCallback(
    async (updatedFields: Partial<UserDbProfile>): Promise<boolean> => {
      if (!user?.uid) {
        setError('No authenticated user found.');
        return false;
      }

      try {
        setError(null);
        const userRef = doc(db, 'users', user.uid);
        
        // Fetch current doc to merge safely
        const snap = await getDoc(userRef);
        const currentData = snap.exists() ? snap.data() : {};

        const mergedData = {
          ...currentData,
          ...updatedFields,
          uid: user.uid,
          email: user.email || currentData.email || '',
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userRef, mergedData, { merge: true });
        setProfile(mergedData as UserDbProfile);

        if (typeof refreshAuthProfile === 'function') {
          await refreshAuthProfile();
        }

        return true;
      } catch (err: any) {
        console.warn('Error updating profile in useUserAccount:', err);
        setError(err.message || 'Failed to save profile changes.');
        return false;
      }
    },
    [user?.uid, user?.email, refreshAuthProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserDbProfile);
      }
    } catch (err) {
      console.warn('Error refreshing profile:', err);
    }
  }, [user?.uid]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile,
  };
}
