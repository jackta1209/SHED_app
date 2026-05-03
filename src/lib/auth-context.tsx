import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, prefsStore, type User, type UserPreferences } from "./store";

interface Ctx {
  user: User | null;
  prefs: UserPreferences | null;
  signIn: (email: string) => void;
  signUp: (email: string) => void;
  signOut: () => void;
  refreshPrefs: () => void;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    const u = auth.current();
    setUser(u);
    if (u) setPrefs(prefsStore.get(u.id));
  }, []);

  // apply theme
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark", "theme-minimal", "theme-warm", "theme-contrast", "theme-studio");
    const mode = prefs?.appearance_mode ?? "dark";
    const theme = prefs?.visual_theme ?? "minimal";
    const resolved =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode;
    root.classList.add(resolved);
    root.classList.add(`theme-${theme}`);
  }, [prefs?.appearance_mode, prefs?.visual_theme]);

  const value: Ctx = {
    user,
    prefs,
    signIn: (email) => {
      const u = auth.signIn(email);
      setUser(u);
      setPrefs(prefsStore.get(u.id));
    },
    signUp: (email) => {
      const u = auth.signUp(email);
      setUser(u);
      setPrefs(prefsStore.get(u.id));
    },
    signOut: () => {
      auth.signOut();
      setUser(null);
      setPrefs(null);
    },
    refreshPrefs: () => user && setPrefs(prefsStore.get(user.id)),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
