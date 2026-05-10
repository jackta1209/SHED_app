import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";
import { AssistantChat } from "@/components/AssistantChat";

export const Route = createFileRoute("/assistant")({
  component: () => (
    <AuthGate>
      <Assistant />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "AI Assistant — SHED" }] }),
});

function Assistant() {
  return (
    <AppLayout>
      <BackButton fallback="/dashboard" />
      <PageHeader
        eyebrow="Workspace"
        title="AI Practice Assistant"
        subtitle="Ask about your practice, goals, journal, and recent sessions."
      />

      <Section title="Quick actions & conversation">
        <AssistantChat />
      </Section>
    </AppLayout>
  );
}
