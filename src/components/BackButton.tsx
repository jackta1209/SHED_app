import { useRouter, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackButton({
  fallback = "/dashboard",
  label = "Back",
  confirm,
}: {
  fallback?: string;
  label?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();

  function handle() {
    if (confirm && !window.confirm(confirm)) return;
    if (router.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: fallback });
    }
  }

  return (
    <button
      onClick={handle}
      className="-ml-2 mb-4 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      aria-label="Go back"
    >
      <ChevronLeft size={18} /> {label}
    </button>
  );
}
