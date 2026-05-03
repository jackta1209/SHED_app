import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "SHED — Focused practice for musicians" },
      { name: "description", content: "A focused practice space for musicians. Plan, practice, track, reflect, adjust." },
    ],
  }),
});

function Landing() {
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
            Go to<br />
            <span className="italic text-primary">the shed.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">
            A focused practice space for serious musicians. One environment for
            timing, tracking, journaling, and reflection — without the noise of ten other apps.
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              The loop
            </p>
            <p className="mt-2 font-serif text-2xl text-foreground">
              Plan · Practice · Track · Reflect · Adjust
            </p>
          </div>
          <Link
            to="/login"
            className="block w-full rounded-xl bg-primary px-5 py-4 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Enter the shed
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Built for developing musicians, students, and pros.
          </p>
        </div>
      </div>
    </div>
  );
}
