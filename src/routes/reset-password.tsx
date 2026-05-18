import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — SHED" }] }),
});

type Stage = "checking" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase parses the recovery token from the URL hash and (a) sets a session
  // and (b) fires a PASSWORD_RECOVERY auth event. We accept either signal.
  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setStage("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setStage("ready");
      } else {
        // Give the SDK a brief moment to process the URL hash on first load.
        setTimeout(() => {
          if (!mounted) return;
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!mounted) return;
            setStage(d2.session ? "ready" : "invalid");
          });
        }, 600);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setBusy(false);
      // Avoid leaking raw auth provider details.
      setError("We couldn't update your password. The reset link may have expired — request a new one.");
      return;
    }
    // Sign out the recovery session so the user signs in with the new password.
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    setBusy(false);
    setStage("done");
    toast.success("Password updated. Sign in with your new password.");
    setTimeout(() => navigate({ to: "/login" }), 1200);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pt-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          SHED
        </p>
        <h1 className="mt-4 font-serif text-4xl">Set a new password.</h1>

        {stage === "checking" && (
          <p className="mt-6 text-sm text-muted-foreground">Verifying your reset link…</p>
        )}

        {stage === "invalid" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </div>
            <Link
              to="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {stage === "done" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
            Password updated. Redirecting to sign in…
          </div>
        )}

        {stage === "ready" && (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <p className="text-sm text-muted-foreground">
              Choose a new password. You'll be asked to sign in again after saving.
            </p>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                New password
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
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 bg-card"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="h-12 w-full text-sm">
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          <Link to="/login" className="hover:text-foreground">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
