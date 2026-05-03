import { Link, useLocation } from "@tanstack/react-router";
import { Home, Timer, BookOpen, Wrench, Settings } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/session/new", icon: Timer, label: "Practice" },
  { to: "/journal", icon: BookOpen, label: "Journal" },
  { to: "/tools", icon: Wrench, label: "Tools" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppLayout({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8">{children}</div>
      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border bg-background/85 backdrop-blur-xl">
          <ul className="flex items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)] pt-2">
            {tabs.map((t) => {
              const active =
                loc.pathname === t.to ||
                (t.to !== "/dashboard" && loc.pathname.startsWith(t.to));
              const Icon = t.icon;
              return (
                <li key={t.to} className="flex-1">
                  <Link
                    to={t.to}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-medium tracking-wide uppercase transition-colors ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.6} />
                    <span>{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6">
      {eyebrow && (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h1 className="font-serif text-4xl leading-[1.05] text-foreground">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
