import { AiCallsView } from "@/components/calls/active-calls-panel";

export const dynamic = "force-dynamic";

export default function CallsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-semibold">AI Calls</h1>
        <p className="text-muted-foreground text-sm">
          Place outbound AI calls and watch live conversations.
        </p>
      </div>
      <AiCallsView />
    </div>
  );
}
