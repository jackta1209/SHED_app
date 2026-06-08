import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Hit The Shed™ — The Practice Workspace for Musicians" },
      { name: "description", content: "SHED brings your practice tools into one focused workspace — timer, journal, metronome, slow downer, reader, analytics, AI, and distraction tracking." },
      { property: "og:title", content: "Hit The Shed™ — The Practice Workspace for Musicians" },
      { property: "og:description", content: "SHED brings your practice tools into one focused workspace — timer, journal, metronome, slow downer, reader, analytics, AI, and distraction tracking." },
      { name: "twitter:title", content: "Hit The Shed™ — The Practice Workspace for Musicians" },
      { name: "twitter:description", content: "SHED brings your practice tools into one focused workspace — timer, journal, metronome, slow downer, reader, analytics, AI, and distraction tracking." },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  // Do NOT gate the entire page on `loading`. Restrictive in-app browsers
  // (Google Search app, Gmail, Instagram, etc.) can leave
  // supabase.auth.getSession() pending indefinitely because storage is
  // restricted, which previously caused the landing page to render blank.
  // The hero must always render; only the CTA reacts to auth state.



  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-16">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            SHED · v0.1
          </span>
        </div>

        <div className="mt-20">
          <h1 className="font-serif text-[68px] leading-[0.95] text-foreground">
            Welcome to<br />
            <span className="italic text-primary">the shed.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">
            Everything you need for a productive practice session in one focused
            workspace — built to help you lock in and stay consistent.
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="font-serif text-xl leading-snug text-foreground">
              “Fold here in the shed, so you don’t get cooked on the bandstand.”
            </p>
          </div>
          {loading ? (
            <span
              aria-busy="true"
              className="block w-full rounded-xl bg-primary px-5 py-4 text-center text-sm font-medium text-primary-foreground opacity-70"
            >
              Loading…
            </span>
          ) : (
            <Link
              to={user ? "/dashboard" : "/login"}
              className="block w-full rounded-xl bg-primary px-5 py-4 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Enter the shed
            </Link>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Built for developing musicians, students, and pros.
          </p>
          <p className="text-center text-[11px] text-muted-foreground">
            © 2026 Jack Ta. Hit The Shed™ is a trademark of Jack Ta.
          </p>
        </div>
      </div>
    </div>
  );
}
