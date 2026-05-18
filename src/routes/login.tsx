import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { profileStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — SHED" }] }),
});

type Mode = "signin" | "signup" | "reset";

function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setInfo(null);

    if (mode === "reset") {
      // Note: configure the Supabase redirect URL allowlist to include
      // ${window.location.origin}/login in Cloud → Users → Auth Settings.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setInfo("If an account exists for that email, we've sent a password reset link. Check your inbox.");
      return;
    }

    if (!password) {
      setBusy(false);
      return;
    }

    const res = mode === "signup" ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      // Signup with email confirmation required.
      setInfo("Check your email to confirm your account before signing in.");
      toast.success("Confirmation email sent.");
      return;
    }
    const profile = await profileStore.get(data.user.id);
    navigate({ to: profile?.instrument ? "/dashboard" : "/profile/setup" });
  }

  const title =
    mode === "signin" ? "Welcome back." : mode === "signup" ? "Make space to practice." : "Reset your password.";
  const subtitle =
    mode === "signin"
      ? "Sign in to continue your work."
      : mode === "signup"
        ? "Create an account to start tracking sessions."
        : "Enter your email and we'll send you a reset link.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pt-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          SHED
        </p>
        <h1 className="mt-4 font-serif text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

        {info && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm text-foreground">
            {info}
          </div>
        )}

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-card"
              placeholder="you@example.com"
            />
          </div>
          {mode !== "reset" && (
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-card"
                placeholder="••••••••"
              />
            </div>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full text-sm">
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </Button>
        </form>

        <div className="mt-6 space-y-3 text-center text-sm">
          {mode === "signin" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setInfo(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setInfo(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  New here? Create an account
                </button>
              </div>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setInfo(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Have an account? Sign in
            </button>
          )}
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setInfo(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          )}
        </div>

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back home</Link>
        </p>
      </div>
    </div>
  );
}
