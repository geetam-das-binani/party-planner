
import { CheckCircle2, Circle, LoaderCircle, Sparkles } from "lucide-react";

const AGENTS = [
  { id: "venue", title: "Venue Agent", description: "Finding venues" },
  { id: "food", title: "Food Agent", description: "Searching food options" },
  {
    id: "decoration",
    title: "Decoration Agent",
    description: "Finding decoration shops",
  },
  { id: "final", title: "Planning Agent", description: "Preparing final plan" },
];

function statusFor(agentId, events) {
  let status = "waiting";

  for (const event of events) {
    const name = String(
      event.agent || event.agentName || event.node || ""
    ).toLowerCase();
    const type = String(event.type || event.status || "").toLowerCase();

    const matches =
      name.includes(agentId) ||
      (agentId === "final" &&
        (name.includes("planner") || name.includes("final")));

    if (!matches) continue;

    if (/complete|finish|done/.test(type)) status = "completed";
    else if (/start|tool|progress/.test(type)) status = "running";
  }

  return status;
}

export default function AgentProgress({ events }) {
  return (
    <section className="panel">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="font-semibold">AI team</h2>
          <p className="text-sm text-slate-500">Live agent activity</p>
        </div>
      </div>

      <div className="space-y-5">
        {AGENTS.map((agent) => {
          const status = statusFor(agent.id, events);

          return (
            <div key={agent.id} className="flex gap-3">
              {status === "completed" ? (
                <CheckCircle2 className="text-emerald-600" size={21} />
              ) : status === "running" ? (
                <LoaderCircle
                  className="animate-spin text-violet-600"
                  size={21}
                />
              ) : (
                <Circle className="text-slate-300" size={21} />
              )}

              <div>
                <p className="font-medium">{agent.title}</p>
                <p className="text-sm text-slate-500">
                  {status === "completed"
                    ? "Completed"
                    : status === "running"
                      ? "Working..."
                      : agent.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {events.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent activity
          </p>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {events.slice(-8).reverse().map((event, index) => (
              <p
                key={`${event.type || "event"}-${index}`}
                className="break-words text-xs leading-5 text-slate-600"
              >
                {event.message ||
                  event.description ||
                  `${event.agent || event.node || "Agent"}: ${event.type || "Update"}`}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
