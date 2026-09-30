import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

export interface UserDbProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  coverUrl?: string;
  pronouns?: string;
  location?: string;
  website?: string;
  interests?: string[];
  xp?: number;
  streak?: number;
  isVip: boolean;
  vipTermsAccepted?: boolean;
  vipTermsVersion?: string;
  vipActivatedAt?: string;
  blackMemberId?: string;
  availabilityStatus?: string;
  bio?: string;
  hapticIntensity?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserDbProfile | null;
  isVip: boolean;
  isGuest: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserDbProfile | null>(null);
  const [isVip, setIsVip] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user document strictly from Firestore users/{uid}
  const fetchUserProfileFromDb = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserDbProfile;
        setUserProfile(data);
        const vipStatus = Boolean(data.isVip);
        setIsVip(vipStatus);
        localStorage.setItem(`kaos_vip_active_${uid}`, JSON.stringify(vipStatus));
        if (data.blackMemberId) {
          localStorage.setItem(`kaos_vip_member_id_${uid}`, data.blackMemberId);
        }
        return data;
      }
    } catch (err) {
      console.warn("Could not fetch user profile from Firestore:", err);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfileFromDb(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setIsGuest(false);
        // Ensure user document exists in Firestore and sync real profile
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const initialDoc: UserDbProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Explorer',
              xp: 1280,
              streak: 14,
              isVip: false,
              vipTermsAccepted: false,
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, initialDoc);
            setUserProfile(initialDoc);
            setIsVip(false);
            localStorage.setItem(`kaos_vip_active_${currentUser.uid}`, JSON.stringify(false));
          } else {
            const data = userSnap.data() as UserDbProfile;
            setUserProfile(data);
            const vipStatus = Boolean(data.isVip);
            setIsVip(vipStatus);
            localStorage.setItem(`kaos_vip_active_${currentUser.uid}`, JSON.stringify(vipStatus));
            if (data.blackMemberId) {
              localStorage.setItem(`kaos_vip_member_id_${currentUser.uid}`, data.blackMemberId);
            }
          }

          // Auto-migrate any anonymous/guest exploration data into Firestore
          try {
            const localPinsRaw = localStorage.getItem('kaos_custom_map_pins');
            if (localPinsRaw) {
              const localPins = JSON.parse(localPinsRaw);
              if (Array.isArray(localPins)) {
                for (const pin of localPins) {
                  if (pin?.id) {
                    await setDoc(doc(db, 'users', currentUser.uid, 'savedPins', pin.id), pin, { merge: true });
                  }
                }
              }
            }
          } catch {}
        } catch (err: any) {
          console.warn("User profile sync deferred:", err?.message || err);
        }
      } else {
        // Reset state on logout
        setUserProfile(null);
        setIsVip(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const continueAsGuest = () => {
    setIsGuest(true);
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Explorer',
              xp: 1280,
              streak: 14,
              isVip: false,
              vipTermsAccepted: false,
              createdAt: new Date().toISOString()
            });
          }
        } catch (dbErr) {
          console.warn("Google sign-in document sync deferred:", dbErr);
        }
      }
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.message?.includes('popup-closed-by-user')
      ) {
        console.warn("Google sign-in popup was closed by user.");
        throw error;
      }
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      const code = error?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        throw new Error('Invalid email or password.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      }
      console.error("Email sign-in error:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      const currentUser = credential.user;
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email || email,
            displayName: name || 'Explorer',
            xp: 1280,
            streak: 14,
            isVip: false,
            vipTermsAccepted: false,
            createdAt: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("Sign-up document creation deferred:", dbErr);
        }
      }
    } catch (error: any) {
      const code = error?.code;
      if (code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Try signing in instead.');
      } else if (code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      console.error("Sign-up error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isVip,
        isGuest,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        continueAsGuest,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
