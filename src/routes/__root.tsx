import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SHED — The Practice Workspace for Musicians" },
      { name: "description", content: "SHED brings your practice tools into one focused workspace — timer, journal, metronome, slow downer, reader, analytics, AI, and distraction tracking." },
      { name: "theme-color", content: "#28251f" },
      { property: "og:title", content: "SHED — The Practice Workspace for Musicians" },
      { property: "og:description", content: "SHED brings your practice tools into one focused workspace — timer, journal, metronome, slow downer, reader, analytics, AI, and distraction tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SHED — The Practice Workspace for Musicians" },
      { name: "twitter:description", content: "SHED brings your practice tools into one focused workspace — timer, journal, metronome, slow downer, reader, analytics, AI, and distraction tracking." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ZOUMEo30uQd3Aw3qhIQ8he3x0pg1/social-images/social-1779281437565-ChatGPT_Image_May_20,_2026,_08_48_38_AM.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ZOUMEo30uQd3Aw3qhIQ8he3x0pg1/social-images/social-1779281437565-ChatGPT_Image_May_20,_2026,_08_48_38_AM.webp" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark theme-minimal">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster theme="dark" position="top-center" />
    </AuthProvider>
  );
}
