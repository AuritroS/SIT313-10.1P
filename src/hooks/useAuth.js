// src/hooks/useAuth.js
import { useEffect, useMemo, useState } from "react";
import { getApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

// If you already export `auth` and `app` from your firebase.js, you can import them instead:
// import { auth } from "../firebase";
// import { db } from "../firebase";

export default function useAuth() {
  // Firebase singletons (safe to call once)
  const app = useMemo(() => getApp(), []);
  const auth = useMemo(() => getAuth(app), [app]);
  const db = useMemo(() => getFirestore(app), [app]);

  // State we expose
  const [user, setUser] = useState(null);
  const [premium, setPremium] = useState(false);
  const [premiumSince, setPremiumSince] = useState(null);

  // Loading states
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // 1) Auth subscription
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, [auth]);

  // 2) Firestore profile subscription (users/{uid})
  useEffect(() => {
    // Reset when user changes
    setPremium(false);
    setPremiumSince(null);

    if (!user?.uid) {
      // Not signed in → no profile to watch
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() || {};
        setPremium(!!d.premium);
        setPremiumSince(d.premiumSince || null);
        setProfileLoading(false);
      },
      () => {
        // On error, fail closed (treat as not premium)
        setPremium(false);
        setPremiumSince(null);
        setProfileLoading(false);
      }
    );

    return () => unsubProfile();
  }, [db, user?.uid]);

  // Single loading flag for consumers
  const loading = authLoading || profileLoading;

  return { user, loading, premium, premiumSince };
}
