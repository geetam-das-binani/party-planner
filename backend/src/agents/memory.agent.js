import { createAgent, toolStrategy } from "langchain";

import { llm } from "../llm/model.js";

import { z } from "zod";

const MemorySchema = z.object({
  vegetarian: z.boolean().nullable(),

  preferredVenueType: z.string().nullable(),

  preferredCuisine: z.string().nullable(),

  preferredTheme: z.string().nullable(),

  otherPreferences: z.array(z.string()),
});

export const memoryAgent = createAgent({
  name: "memory_agent",

  model: llm,

  tools: [],

  responseFormat: toolStrategy(MemorySchema),

  systemPrompt: `
You extract durable party-planning
preferences from user messages.

Only extract preferences that are
actually stated or clearly implied.

Do NOT invent preferences.

Examples:

"I am vegetarian"

means:

vegetarian = true

"I prefer outdoor venues"

means:

preferredVenueType = outdoor

If something isn't present,
return null.

Do not store temporary details
such as today's budget unless it
is clearly a persistent preference.
`,
});
