import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: () => (
    <AuthGate>
      <AccountPage />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Account — SHED" }] }),
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not signed in.");

      const { error: fnError } = await supabase.functions.invoke("delete-user-account", {
        method: "POST",
      });
      if (fnError) throw fnError;

      // Clear local sheet music IndexedDB store and any local app state.
      try {
        if (typeof indexedDB !== "undefined") {
          indexedDB.deleteDatabase("shed-sheet-music");
        }
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn("Local cleanup partial:", e);
      }

      await supabase.auth.signOut().catch(() => {});
      await signOut().catch(() => {});

      toast.success("Your account has been deleted.");
      navigate({ to: "/login" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Deletion failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const canDelete = confirmText.trim() === "DELETE" && !busy;

  return (
    <AppLayout>
      <BackButton fallback="/settings" />
      <PageHeader eyebrow="Manage" title="Account" subtitle={user?.email} />

      <Section title="Danger zone">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Permanently remove your account and every record connected to it: profile,
                practice sessions, journal entries, reflections, and settings. This cannot be
                undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setConfirmText("");
                  setError(null);
                  setOpen(true);
                }}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This will permanently delete your profile, all practice sessions, journal entries,
              reflections, and settings. Locally saved sheet music on this device will also be
              cleared. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Type DELETE to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={busy}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
