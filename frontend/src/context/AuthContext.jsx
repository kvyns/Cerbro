import { createContext, useContext, useEffect, useState } from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

// ── Cookie helpers ────────────────────────────────────────────────────────────
const COOKIE_KEY = "cerbro_user";

function writeUserCookie(user) {
  if (!user) {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  const payload = JSON.stringify({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  });
  // 30-day expiry, cleared explicitly on logout
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(payload)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function readUserCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Seed from cookie so UI renders immediately — Firebase confirms async
  const cached = readUserCookie();
  const [user, setUser] = useState(cached);
  const [loading, setLoading] = useState(!cached); // skip spinner if cached

  useEffect(() => {
    // Ensure session survives browser restarts
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      writeUserCookie(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const register = (email, password, displayName) =>
    createUserWithEmailAndPassword(auth, email, password).then((cred) => {
      if (displayName) {
        return updateProfile(cred.user, { displayName }).then(() => cred);
      }
      return cred;
    });

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

  const logout = async () => {
    writeUserCookie(null);
    return signOut(auth);
  };

  const getIdToken = () => user?.getIdToken?.() ?? Promise.resolve(null);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
