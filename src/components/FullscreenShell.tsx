import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  active: boolean;
  onToggle: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Wraps children in a div. When `active`, the div is portalled to document.body
 * as a fixed overlay covering the viewport. The same React subtree instance is
 * preserved across toggles so component state (PDF page, zoom, playback, etc.)
 * is not reset.
 */
export function FullscreenShell({ active, onToggle, title, children }: Props) {
  // Lock body scroll & handle Escape while fullscreen.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [active, onToggle]);

  const inner = (
    <>
      {active && (
        <div className="flex items-center justify-between border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
          <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
            {title ?? "Fullscreen"}
          </p>
          <Button size="sm" variant="ghost" onClick={onToggle} aria-label="Exit fullscreen">
            <X size={14} className="mr-1" /> Close
          </Button>
        </div>
      )}
      <div className={active ? "flex-1 overflow-auto p-3" : ""}>{children}</div>
    </>
  );

  if (active && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-background">{inner}</div>,
      document.body,
    );
  }
  return <>{inner}</>;
}

export function FullscreenButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onToggle}
      aria-label={active ? "Exit fullscreen" : "Enter fullscreen"}
      title={active ? "Exit fullscreen" : "Fullscreen"}
    >
      {active ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
    </Button>
  );
}
