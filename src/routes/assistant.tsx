import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/assistant")({
  component: () => (
    <AuthGate>
      <Assistant />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "AI Assistant — SHED" }] }),
});

const QUICK_ACTIONS: { label: string; action: string; message: string }[] = [
  {
    label: "Test AI connection",
    action: "test_connection",
    message:
      "Reply briefly to confirm the SHED AI connection is working. One sentence.",
  },
  {
    label: "Suggest today's practice",
    action: "suggest_today",
    message:
      "Based on my recent SHED data, suggest today's practice using the standard format (Today's focus / Practice plan / Why / Tool suggestions / Measurable target).",
  },
  {
    label: "Summarize my recent journal",
    action: "summarize_journal",
    message:
      "Summarize the themes, struggles, and breakthroughs in my recent journal entries.",
  },
  {
    label: "Review my last 7 days",
    action: "review_week",
    message:
      "Review my last 7 days of practice sessions and journal entries. What patterns do you see?",
  },
  {
    label: "What should I focus on next?",
    action: "focus_next",
    message:
      "Based on my recent SHED data, what should I focus on next, and what am I neglecting?",
  },
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function Assistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(message: string, action?: string) {
    if (loading) return;
    const text = message.trim();
    if (!text) return;
    setError(null);
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: action ? `${action.replace(/_/g, " ")}` : text }]);
    setInput("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "ai-practice-assistant",
        { body: { message: text, action } },
      );
      if (invokeErr) throw new Error(invokeErr.message);
      const reply: string | undefined = data?.reply;
      const errMsg: string | undefined = data?.error;
      if (errMsg) throw new Error(errMsg);
      if (!reply) throw new Error("Empty response from assistant.");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assistant request failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <BackButton fallback="/dashboard" />
      <PageHeader
        eyebrow="Workspace"
        title="AI Practice Assistant"
        subtitle="Ask about your practice, goals, journal, and recent sessions."
      />

      <Section title="Quick actions">
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.action}
              onClick={() => send(q.message, q.action)}
              disabled={loading}
              className="rounded-xl border border-border bg-card p-3 text-left text-xs hover:border-primary disabled:opacity-50"
            >
              <Sparkles size={12} className="mb-1 text-muted-foreground" />
              <p className="font-medium leading-snug">{q.label}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Conversation">
        <div className="space-y-3">
          {messages.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Ask anything — practice planning, journal patterns, what to focus on,
              how to structure a session, which SHED tool fits a problem. The
              assistant reads your profile, recent sessions, journal, reflections,
              and repertoire when available.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[90%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[95%] whitespace-pre-wrap rounded-2xl border border-border bg-card px-4 py-3 text-sm"
              }
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Thinking…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+72px)] pt-3 backdrop-blur md:pb-3">
        <div className="mx-auto flex w-full max-w-md items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about your practice…"
            className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
          <Button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-md text-[10px] leading-snug text-muted-foreground">
          Your assistant only uses your authenticated SHED data. AI calls run
          server-side through Supabase — your OpenAI key is never exposed to the
          browser.
        </p>
      </div>
    </AppLayout>
  );
}
