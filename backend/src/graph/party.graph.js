import { StateGraph, START, END, StateSchema } from "@langchain/langgraph";

import { z } from "zod";

import { venueAgent } from "../agents/venue.agent.js";

import { foodAgent } from "../agents/food.agent.js";

import { decorationAgent } from "../agents/decoration.agent.js";

import { finalAgent } from "../agents/final.agent.js";

import { publishAgentEvent } from "../events/eventBus.js";

const PartyState = new StateSchema({
  userId: z.string(),

  sessionId: z.string(),

  message: z.string(),

  request: z.any(),

  preferences: z.any(),

  history: z.array(z.any()),

  venue: z.string().optional(),

  food: z.string().optional(),

  decoration: z.string().optional(),

  finalPlan: z.string().optional(),
});

async function venueNode(state) {
  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_started",

      agent: "venue",

      message: "Venue Agent started",
    },
  );

  const result = await venueAgent.invoke({
    messages: [
      {
        role: "user",

        content: `
Party request:

${JSON.stringify(state.request)}

User preferences:

${JSON.stringify(state.preferences)}

Conversation:

${JSON.stringify(state.history)}

Find suitable venues.
`,
      },
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];

  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_completed",

      agent: "venue",

      message: "Venue Agent completed",
    },
  );

  return {
    venue: lastMessage.content,
  };
}
async function foodNode(state) {
  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_started",

      agent: "food",

      message: "Food Agent started",
    },
  );

  const result = await foodAgent.invoke({
    messages: [
      {
        role: "user",

        content: `
Party request:

${JSON.stringify(state.request)}

User preferences:

${JSON.stringify(state.preferences)}

Conversation:

${JSON.stringify(state.history)}

Find suitable food providers.
`,
      },
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];

  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_completed",

      agent: "food",

      message: "Food Agent completed",
    },
  );

  return {
    food: lastMessage.content,
  };
}

async function decorationNode(state) {
  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_started",

      agent: "decoration",

      message: "Decoration Agent started",
    },
  );

  const result = await decorationAgent.invoke({
    messages: [
      {
        role: "user",

        content: `
Party request:

${JSON.stringify(state.request)}

User preferences:

${JSON.stringify(state.preferences)}

Conversation:

${JSON.stringify(state.history)}

Find decoration providers.
`,
      },
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];

  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_completed",

      agent: "decoration",

      message: "Decoration Agent completed",
    },
  );

  return {
    decoration: lastMessage.content,
  };
}
async function finalNode(state) {
  await publishAgentEvent(
    state.sessionId,

    {
      type: "agent_started",

      agent: "final",

      message: "Final Planner started",
    },
  );

  const result = await finalAgent.invoke({
    messages: [
      {
        role: "user",

        content: `
Create the final party plan.

Request:

${JSON.stringify(state.request)}

Preferences:

${JSON.stringify(state.preferences)}

Venue Agent:

${state.venue}

Food Agent:

${state.food}

Decoration Agent:

${state.decoration}
`,
      },
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];

  await publishAgentEvent(
    state.sessionId,

    {
      type: "final",

      message: "Final party plan ready",

      content: lastMessage.content,
    },
  );

  return {
    finalPlan: lastMessage.content,
  };
}

const workflow = new StateGraph(PartyState);

workflow.addNode("partyVenue", venueNode);

workflow.addNode("partyFood", foodNode);

workflow.addNode("partyDecoration", decorationNode);

workflow.addNode("final", finalNode);

workflow.addEdge(START, "partyVenue");

workflow.addEdge(START, "partyFood");

workflow.addEdge(START, "partyDecoration");

workflow.addEdge("partyVenue", "final");

workflow.addEdge("partyFood", "final");

workflow.addEdge("partyDecoration", "final");

workflow.addEdge("final", END);

export const partyGraph = workflow.compile();
