import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { profileStore } from "@/lib/store";

export function AuthGate({ children, requireProfile = true }: { children: ReactNode; requireProfile?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (requireProfile && !profileStore.get(user.id)) {
      navigate({ to: "/profile/setup" });
    }
  }, [user, requireProfile, navigate]);

  if (!user) return null;
  return <>{children}</>;
}
