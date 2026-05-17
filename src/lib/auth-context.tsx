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
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    const loadPrefs = (userId: string) => {
      setPrefsLoaded(false);
      settingsStore.get(userId).then((next) => {
        if (!mounted) return;
        setPrefs(next);
        setPrefsLoaded(true);
      }).catch(() => {
        if (!mounted) return;
        setPrefs(null);
        setPrefsLoaded(true);
      });
    };

    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!mounted) return;
      if (error) console.error("Error restoring auth session:", error);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadPrefs(s.user.id);
      else {
        setPrefs(null);
        setPrefsLoaded(true);
      }
      setLoading(false);

      const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (nextSession?.user) {
          // defer DB call to avoid auth deadlock
          setTimeout(() => loadPrefs(nextSession.user.id), 0);
        } else {
          setPrefs(null);
          setPrefsLoaded(true);
        }
      });
      subscription = sub.subscription;
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
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
      clearLastActive();
      await supabase.auth.signOut();
    },
    refreshPrefs: async () => {
      if (user) setPrefs(await settingsStore.get(user.id));
    },
  };

  // Inactivity auto-logout. Disabled when no user, or when preference is null ("manual only").
  const timeoutMinutes =
    prefs?.inactivity_timeout_minutes === undefined
      ? DEFAULT_INACTIVITY_MINUTES
      : prefs.inactivity_timeout_minutes;
  useInactivityLogout({
    active: !!user && !loading && prefsLoaded,
    timeoutMinutes: user ? timeoutMinutes : null,
    onTimeout: () => {
      clearLastActive();
      supabase.auth.signOut().catch(() => {});
    },
  });

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
