
import { useRef, useState } from "react";
import {
  Bot,
  CalendarHeart,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import PartyForm from "./components/PartyForm";
import AgentProgress from "./components/AgentProgress";
import ChatMessages from "./components/ChatMessages";
import PlanResult from "./components/PlanResult";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const INITIAL_PARTY = {
  type: "birthday",
  location: "Kolkata",
  guests: 30,
  budget: 50000,
  venueType: "any",
  cuisine: "any",
  theme: "",
};

const makeId = () => crypto.randomUUID();

export default function App() {
  const [party, setParty] = useState(INITIAL_PARTY);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [finalPlan, setFinalPlan] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef(null);
  const bufferRef = useRef("");
  const receivedFinalRef = useRef(false);

  const userIdRef = useRef("user123");
  const sessionIdRef = useRef(makeId());

  function clearConversation() {
    if (loading) return;

    setMessages([]);
    setEvents([]);
    setFinalPlan(null);
    setError("");
    setChatInput("");
    sessionIdRef.current = makeId();
  }

  function processEvent(event) {
    setEvents((previous) => [...previous, event]);

    if (
      ["error", "agent_error", "failed"].includes(
        String(event.type || "").toLowerCase()
      )
    ) {
      setError(event.message || "An agent encountered an error.");
    }

    const plan =
      event.finalPlan ??
      event.final_plan ??
      event.plan ??
      (event.type === "final_plan" ? event.data : null);

    if (plan !== null && plan !== undefined) {
      receivedFinalRef.current = true;
      setFinalPlan(plan);

      const content =
        typeof plan === "string"
          ? plan
          : plan.content || plan.text || JSON.stringify(plan, null, 2);

      setMessages((previous) => [
        ...previous.filter((message) => !message.pending),
        { id: makeId(), role: "assistant", content },
      ]);
    }
  }

  function processSSEChunk(chunk) {
    bufferRef.current += chunk;

    const blocks = bufferRef.current.split(/\r?\n\r?\n/);
    bufferRef.current = blocks.pop() || "";

    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (!data || data === "[DONE]") continue;

      try {
        processEvent(JSON.parse(data));
      } catch {
        console.warn("Invalid SSE event:", data);
      }
    }
  }

  async function sendMessage(message, partyDetails = party) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setEvents([]);
    setFinalPlan(null);
    receivedFinalRef.current = false;
    bufferRef.current = "";

    setMessages((previous) => [
      ...previous,
      { id: makeId(), role: "user", content: trimmed },
      {
        id: makeId(),
        role: "assistant",
        content: "Coordinating the AI agents...",
        pending: true,
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_URL}/api/party/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify({
          userId: userIdRef.current,
          sessionId: sessionIdRef.current,
          message: trimmed,
          party: partyDetails,
          request: partyDetails,
        }),
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) || `HTTP ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("Streaming is not supported by this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        processSSEChunk(decoder.decode(value, { stream: true }));
      }

      processSSEChunk(decoder.decode());

      // Handle an event that ended without a blank-line delimiter.
      if (bufferRef.current.trim()) {
        const data = bufferRef.current
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (data && data !== "[DONE]") {
          try {
            processEvent(JSON.parse(data));
          } catch {
            console.warn("Invalid final SSE event:", data);
          }
        }
      }

      if (!receivedFinalRef.current) {
        setMessages((previous) => [
          ...previous.filter((message) => !message.pending),
          {
            id: makeId(),
            role: "assistant",
            content:
              "The stream ended without a final plan. Check that your backend sends a completed event containing finalPlan.",
          },
        ]);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Request failed.");

        setMessages((previous) => [
          ...previous.filter((message) => !message.pending),
          {
            id: makeId(),
            role: "assistant",
            content:
              "I couldn't complete your request. Check the backend connection and try again.",
          },
        ]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handlePartySubmit(event) {
    event.preventDefault();

    const prompt = [
      `Plan a ${party.type} party in ${party.location}.`,
      `Guests: ${party.guests}.`,
      `Budget: ₹${party.budget}.`,
      `Preferred venue: ${party.venueType}.`,
      `Food preference: ${party.cuisine}.`,
      party.theme ? `Additional requirements: ${party.theme}.` : "",
      "Search for real options and state when information is unavailable.",
    ]
      .filter(Boolean)
      .join(" ");

    sendMessage(prompt, party);
  }

  function handleChatSubmit(event) {
    event.preventDefault();

    const message = chatInput.trim();
    if (!message || loading) return;

    setChatInput("");
    sendMessage(message);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-600 p-2.5 text-white">
              <CalendarHeart size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold">PartyPilot AI</h1>
              <p className="text-xs text-slate-500">
                Multi-agent party planner
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearConversation}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">New conversation</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-3xl bg-gradient-to-r from-violet-700 to-indigo-600 p-6 text-white sm:p-9">
          <div className="mb-3 flex items-center gap-2 text-sm text-violet-100">
            <Sparkles size={17} />
            AI-powered event planning
          </div>
          <h2 className="text-3xl font-bold sm:text-4xl">
            Your perfect party starts here.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100 sm:text-base">
            Our venue, food, and decoration agents search for real options
            and combine their findings into a practical party plan.
          </p>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-4">
            <section className="panel">
              <h2 className="mb-1 text-lg font-semibold">Party details</h2>
              <p className="mb-5 text-sm text-slate-500">
                Customize your event.
              </p>
              <PartyForm
                party={party}
                setParty={setParty}
                onSubmit={handlePartySubmit}
                loading={loading}
              />
            </section>

            <AgentProgress events={events} />
          </aside>

          <section className="space-y-6 lg:col-span-8">
            <div className="panel">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                  <Bot size={22} />
                </div>
                <div>
                  <h2 className="font-semibold">Planning assistant</h2>
                  <p className="text-sm text-slate-500">
                    Ask questions or refine your plan.
                  </p>
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-5 py-12 text-center">
                  <Sparkles className="mx-auto mb-3 text-violet-600" size={28} />
                  <h3 className="font-medium">Ready to plan your event?</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                    Fill in the form to generate a plan, or ask a question
                    below.
                  </p>
                </div>
              ) : (
                <div className="max-h-[600px] space-y-5 overflow-y-auto py-2">
                  <ChatMessages messages={messages} />
                </div>
              )}

              <form
                onSubmit={handleChatSubmit}
                className="mt-5 flex items-end gap-2 border-t pt-4"
              >
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Ask for changes to your party plan..."
                  rows={2}
                  className="field min-h-12 flex-1 resize-y"
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={loading || !chatInput.trim()}
                  aria-label="Send message"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  <Send size={19} />
                </button>
              </form>

              {loading && (
                <p className="mt-3 text-xs text-slate-500">
                  Agents are working. Watch their live progress.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <p className="font-semibold">Request failed</p>
                <p className="mt-1 break-words">{error}</p>
                <p className="mt-2 text-xs">
                  Check that Express is running, the API route is correct,
                  and CORS allows your Vite origin.
                </p>
              </div>
            )}

            <PlanResult plan={finalPlan} />
          </section>
        </div>

        <footer className="py-8 text-center text-xs text-slate-400">
          PartyPilot AI · Multi-agent workflows
        </footer>
      </div>
    </main>
  );
}
