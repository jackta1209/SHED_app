import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { profileStore } from "@/lib/store";

export function AuthGate({
  children,
  requireProfile = true,
}: {
  children: ReactNode;
  requireProfile?: boolean;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!requireProfile) {
      setChecked(true);
      return;
    }
    profileStore.get(user.id).then((p) => {
      if (!p || !p.instrument) navigate({ to: "/profile/setup" });
      else setChecked(true);
    });
  }, [user, loading, requireProfile, navigate]);

  if (loading || !user || !checked) return null;
  return <>{children}</>;
}
