import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { profileStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — SHED" }] }),
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (mode === "signup") signUp(email);
    else signIn(email);
    // navigate after micro-tick so context updates
    setTimeout(() => {
      const u = JSON.parse(localStorage.getItem("shed.user") || "null");
      if (u && profileStore.get(u.id)) navigate({ to: "/dashboard" });
      else navigate({ to: "/profile/setup" });
    }, 30);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pt-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          SHED
        </p>
        <h1 className="mt-4 font-serif text-4xl">
          {mode === "signin" ? "Welcome back." : "Make space to practice."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to continue your work." : "Create an account to start tracking sessions."}
        </p>

        <form onSubmit={submit} className="mt-10 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
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
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-card"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="h-12 w-full text-sm">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          Local-only auth for this MVP. Connect Lovable Cloud to enable real accounts.
        </p>
      </div>
    </div>
  );
}
