import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { settingsStore, type UserSettings } from "./store";
import { useInactivityLogout, clearLastActive, DEFAULT_INACTIVITY_MINUTES } from "./inactivity";
import type { Session, User } from "@supabase/supabase-js";

interface Ctx {
  user: User | null;
  session: Session | null;
  prefs: UserSettings | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshPrefs: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer DB call to avoid auth deadlock
        setTimeout(() => {
          settingsStore.get(s.user.id).then(setPrefs);
        }, 0);
      } else {
        setPrefs(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) settingsStore.get(s.user.id).then(setPrefs);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
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
    session,
    prefs,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshPrefs: async () => {
      if (user) setPrefs(await settingsStore.get(user.id));
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
